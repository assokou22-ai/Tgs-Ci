import React, { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase.ts';
import { useToastContext } from '../context/ToastContext.tsx';

// Gestion des comptes Google autorisés à accéder aux données de l'atelier.
// Les règles Firestore n'autorisent que les propriétaires et les membres actifs listés ici.

interface Member {
    email: string;
    role: 'admin' | 'staff';
    active: boolean;
    name?: string;
    addedBy?: string;
    addedAt?: string;
}

const OWNER_EMAILS = ['assokou22@gmail.com', 'thegoodstore@gmail.com', 'thegoodstoreci@gmail.com'];

const TeamAccessManager: React.FC = () => {
    const { showToast } = useToastContext();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<'admin' | 'staff'>('staff');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!auth.currentUser) { setError("Connectez-vous avec votre compte Google pour gérer l'équipe."); return; }
        setLoading(true);
        setError(null);
        try {
            const snap = await getDocs(collection(db, 'members'));
            const list: Member[] = [];
            snap.forEach(d => {
                const data = d.data() as Partial<Member>;
                list.push({ email: d.id, role: data.role === 'admin' ? 'admin' : 'staff', active: data.active !== false, name: data.name, addedBy: data.addedBy, addedAt: data.addedAt });
            });
            list.sort((a, b) => a.email.localeCompare(b.email));
            setMembers(list);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg.toLowerCase().includes('permission')
                ? "Accès refusé : seuls les propriétaires et les administrateurs peuvent consulter l'équipe. Vérifiez aussi que les nouvelles règles Firestore sont publiées."
                : `Lecture impossible : ${msg}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (m: Member) => {
        try {
            await setDoc(doc(db, 'members', m.email), {
                email: m.email, role: m.role, active: m.active, name: m.name || '',
                addedBy: m.addedBy || auth.currentUser?.email || '', addedAt: m.addedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            return true;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast(msg.toLowerCase().includes('permission') ? "Action réservée aux administrateurs." : `Erreur : ${msg}`, 'error');
            return false;
        }
    };

    const add = async () => {
        const clean = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { showToast('Adresse e-mail invalide.', 'error'); return; }
        if (OWNER_EMAILS.includes(clean)) { showToast('Ce compte est propriétaire : il a déjà un accès complet.', 'info'); return; }
        if (await save({ email: clean, role, active: true, name: name.trim() })) {
            showToast(`Accès accordé à ${clean}.`, 'success');
            setEmail(''); setName(''); setRole('staff');
            load();
        }
    };

    const toggle = async (m: Member) => {
        if (await save({ ...m, active: !m.active })) {
            showToast(m.active ? `Accès suspendu pour ${m.email}.` : `Accès réactivé pour ${m.email}.`, 'success');
            load();
        }
    };

    const changeRole = async (m: Member, r: 'admin' | 'staff') => {
        if (await save({ ...m, role: r })) load();
    };

    const remove = async (m: Member) => {
        if (!window.confirm(`Retirer définitivement l'accès de ${m.email} ?`)) return;
        try {
            await deleteDoc(doc(db, 'members', m.email));
            showToast(`Accès retiré pour ${m.email}.`, 'success');
            load();
        } catch {
            showToast('Action réservée aux administrateurs.', 'error');
        }
    };

    return (
        <section className="bg-gray-800/50 p-6 rounded-2xl shadow-xl border border-gray-700/80 space-y-5">
            <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Équipe autorisée (accès aux données)</h3>
                <p className="text-xs text-gray-400 mt-1">
                    Seuls les comptes Google listés ici (et les comptes propriétaires) peuvent lire et modifier les fiches,
                    le stock et les factures, sur le web comme sur l'application Android.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="adresse@gmail.com" type="email"
                    className="md:col-span-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom (facultatif)"
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'staff')}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    <option value="staff">Employé</option>
                    <option value="admin">Administrateur</option>
                </select>
            </div>
            <button onClick={add} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider">
                Autoriser ce compte
            </button>

            {error && <p className="text-xs text-amber-400">{error}</p>}
            {loading && <p className="text-xs text-gray-400">Chargement…</p>}

            <div className="space-y-2">
                {OWNER_EMAILS.map(o => (
                    <div key={o} className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                        <span className="text-sm text-white">{o}</span>
                        <span className="text-[10px] font-black uppercase text-emerald-400">Propriétaire</span>
                    </div>
                ))}
                {members.map(m => (
                    <div key={m.email} className="flex flex-wrap items-center justify-between gap-2 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                        <div>
                            <p className={`text-sm ${m.active ? 'text-white' : 'text-gray-500 line-through'}`}>{m.email}</p>
                            {m.name && <p className="text-[11px] text-gray-400">{m.name}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <select value={m.role} onChange={e => changeRole(m, e.target.value as 'admin' | 'staff')}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white">
                                <option value="staff">Employé</option>
                                <option value="admin">Administrateur</option>
                            </select>
                            <button onClick={() => toggle(m)} className={`px-3 py-1 rounded-lg text-xs font-bold ${m.active ? 'bg-amber-600/80 text-white' : 'bg-emerald-600/80 text-white'}`}>
                                {m.active ? 'Suspendre' : 'Réactiver'}
                            </button>
                            <button onClick={() => remove(m)} className="px-3 py-1 rounded-lg text-xs font-bold bg-red-700/80 text-white">Retirer</button>
                        </div>
                    </div>
                ))}
                {!loading && !error && members.length === 0 && (
                    <p className="text-xs text-gray-400">Aucun employé ajouté pour l'instant.</p>
                )}
            </div>
        </section>
    );
};

export default TeamAccessManager;
