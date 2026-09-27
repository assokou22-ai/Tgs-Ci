import React, { useState } from 'react';
import { ShieldAlert, LogIn, Sparkles, KeyRound } from 'lucide-react';
import { useToastContext } from '../context/ToastContext.tsx';
import BackgroundAnimation from './BackgroundAnimation.tsx';

interface LoginScreenProps {
  onSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
    const { showToast } = useToastContext();
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Accept '2019', 'TGS2025', 'TGSCI2025', or 'admin' as fallback
        const normalizedInput = password.trim();
        if (normalizedInput === '2019' || normalizedInput === 'TGS2025' || normalizedInput === 'TGSCI2025' || normalizedInput === 'admin' || normalizedInput === 'TGSCI') {
            setTimeout(() => {
                localStorage.setItem('tgs-ci-portal-authenticated', 'true');
                showToast("Connexion réussie", "success");
                onSuccess();
            }, 600);
        } else {
            setTimeout(() => {
                setIsSubmitting(false);
                setPassword('');
                showToast("Mot de passe incorrect", "error");
            }, 600);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <BackgroundAnimation />
            
            <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl z-10 animate-fade-in relative">
                {/* Visual Accent */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                        <KeyRound className="w-8 h-8 text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight italic">RéparerMonMac</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Atelier TGS - Côte d'Ivoire</p>
                </div>

                <div className="bg-zinc-900/50 rounded-2xl p-4 mb-6 border border-white/5 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Portail Sécurisé</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                            L'accès aux options d'exploitation et de gestion de l'application requiert une clé d'activation administrateur.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
                            Mot de passe administrateur
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Clé système..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 px-5 text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                            required
                            autoFocus
                            disabled={isSubmitting}
                        />
                        <div className="mt-2 text-right">
                            <span className="text-[9px] text-zinc-500 italic">Indice: 2019</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !password}
                        className="w-full py-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 font-black rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-white/5"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <LogIn className="w-4 h-4" />
                                Connecter l'application
                            </>
                        )}
                    </button>
                </form>
            </div>

            <footer className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-8 z-10 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Système de sécurité certifié TGS-CI</span>
            </footer>
        </div>
    );
};

export default LoginScreen;
