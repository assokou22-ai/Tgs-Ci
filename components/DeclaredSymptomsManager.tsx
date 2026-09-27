import React, { useState } from 'react';
import { DeclaredSymptomsDetails, DeclaredSymptomCategory } from '../types.ts';
import { SparklesIcon, ExclamationTriangleIcon, ChevronDownIcon } from './icons.tsx';

interface DeclaredSymptomsManagerProps {
  details?: DeclaredSymptomsDetails;
  problemDescription: string;
  onChange: (updatedDetails: DeclaredSymptomsDetails, autoSummary?: string) => void;
  onDescriptionChange: (desc: string) => void;
  powersOn?: boolean;
}

interface CategoryOption {
  id: DeclaredSymptomCategory;
  label: string;
  badge: string;
  icon: string;
  description: string;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'no_power',
    label: "Ne s'allume plus (No power)",
    badge: 'Carte Mère / Alimentation',
    icon: '⚡',
    description: 'Aucune réaction, voyant éteint, aucun souffle de ventilateur.',
    color: 'border-red-500/40 bg-red-500/10 text-red-400'
  },
  {
    id: 'liquid',
    label: "Contact liquide / Oxydation",
    badge: 'Urgence Chimique',
    icon: '💧',
    description: 'Liquide renversé, projection, humidité excessive ou corrosion.',
    color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
  },
  {
    id: 'screen',
    label: "Écran & Affichage",
    badge: 'Dalle / Flex / GPU',
    icon: '🖥️',
    description: 'Écran noir, rétroéclairage faible, lignes, fissure ou clignotement.',
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
  },
  {
    id: 'battery',
    label: "Batterie & Charge",
    badge: 'Alimentation / PMIC',
    icon: '🔋',
    description: 'Ne prend pas la charge, décharge brutale, batterie gonflée.',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-400'
  },
  {
    id: 'system_reboot',
    label: "Redémarrages & Système",
    badge: 'macOS / SSD / Kernel',
    icon: '🔄',
    description: 'Bootloop, dossier avec point d’interrogation, blocage sur la pomme.',
    color: 'border-purple-500/40 bg-purple-500/10 text-purple-400'
  },
  {
    id: 'other',
    label: "Autre panne spécifique",
    badge: 'Composant / Périphérique',
    icon: '✏️',
    description: 'Clavier, trackpad, connectique USB-C, son, Wi-Fi, surchauffe...',
    color: 'border-slate-500/40 bg-slate-500/10 text-slate-300'
  }
];

const formatSymptomsSummary = (d: DeclaredSymptomsDetails): string => {
  const parts: string[] = [];
  const cats = d.selectedCategories || [];

  if (cats.includes('no_power')) {
    let np = "• PANNE : Ne s'allume plus (No power / Aucune réaction)";
    if (d.noPowerIncidentDate) {
      const dateFr = new Date(d.noPowerIncidentDate).toLocaleDateString('fr-FR');
      np += `\n  - Début du problème : depuis le ${dateFr}`;
    }
    const cond = d.noPowerCondition === 'autre' ? d.noPowerCustomCondition : d.noPowerCondition;
    if (cond) {
      np += `\n  - Circonstances : ${cond}`;
    }
    parts.push(np);
  }

  if (cats.includes('liquid')) {
    let liq = "• CONTACT LIQUIDE & OXYDATION :";
    if (d.liquidIncidentDate) {
      const dateFr = new Date(d.liquidIncidentDate).toLocaleDateString('fr-FR');
      liq += `\n  - Date du contact : ${dateFr}`;
    }
    const lType = d.liquidType === 'autre' ? d.liquidCustomType : d.liquidType;
    if (lType) {
      liq += `\n  - Nature du liquide : ${lType}`;
    }
    if (d.liquidPoweredAfter) {
      liq += `\n  - Rallumé après l'incident : ${d.liquidPoweredAfter === 'oui' ? 'OUI (Alerte court-circuit)' : d.liquidPoweredAfter === 'non' ? 'NON (Non rallumé)' : 'Inconnu'}`;
    }
    if (d.liquidPluggedAfter) {
      liq += `\n  - Mis en charge après l'incident : ${d.liquidPluggedAfter === 'oui' ? 'OUI (Alerte mise sous tension)' : d.liquidPluggedAfter === 'non' ? 'NON (Non branché)' : 'Inconnu'}`;
    }
    if (d.liquidDryingAttempted) {
      liq += `\n  - Tentative de séchage : ${d.liquidDryingAttempted}`;
    }
    parts.push(liq);
  }

  if (cats.includes('screen')) {
    let scr = "• AFFICHAGE & ÉCRAN :";
    if (d.screenIssueType) {
      scr += `\n  - Symptôme : ${d.screenIssueType}`;
    }
    if (d.screenCause) {
      scr += `\n  - Cause supposée : ${d.screenCause}`;
    }
    parts.push(scr);
  }

  if (cats.includes('battery')) {
    let bat = "• BATTERIE & CHARGE :";
    if (d.batteryIssueType) {
      bat += `\n  - Anomalie : ${d.batteryIssueType}`;
    }
    if (d.batteryChargerType) {
      bat += `\n  - Chargeur utilisé : ${d.batteryChargerType === 'apple_original' ? 'Chargeur Apple officiel' : d.batteryChargerType === 'generique_tiers' ? 'Adaptateur tiers / générique' : 'Inconnu'}`;
    }
    parts.push(bat);
  }

  if (cats.includes('system_reboot')) {
    let sys = "• COMPORTEMENT SYSTÈME & DÉMARRAGE :";
    if (d.systemIssueType) {
      sys += `\n  - Comportement : ${d.systemIssueType}`;
    }
    parts.push(sys);
  }

  if (cats.includes('other')) {
    if (d.customProblem && d.customProblem.trim()) {
      parts.push(`• AUTRE PANNE SPÉCIFIQUE :\n  - ${d.customProblem.trim()}`);
    }
  }

  if (d.additionalNotes && d.additionalNotes.trim()) {
    parts.push(`• REMARQUES COMPLÉMENTAIRES :\n  ${d.additionalNotes.trim()}`);
  }

  return parts.join('\n\n');
};

const DeclaredSymptomsManager: React.FC<DeclaredSymptomsManagerProps> = ({
  details,
  problemDescription,
  onChange,
  onDescriptionChange,
  powersOn
}) => {
  const current: DeclaredSymptomsDetails = details || { selectedCategories: [] };
  const selectedCats = current.selectedCategories || [];

  const [activeTab, setActiveTab] = useState<DeclaredSymptomCategory | null>(() => {
    if (selectedCats.length > 0) return selectedCats[0];
    if (powersOn === false) return 'no_power';
    return null;
  });

  const [showAutoSyncMessage, setShowAutoSyncMessage] = useState(false);

  // Toggle category
  const toggleCategory = (catId: DeclaredSymptomCategory) => {
    let nextCats: DeclaredSymptomCategory[];
    if (selectedCats.includes(catId)) {
      nextCats = selectedCats.filter(c => c !== catId);
      if (activeTab === catId) {
        setActiveTab(nextCats.length > 0 ? nextCats[0] : null);
      }
    } else {
      nextCats = [...selectedCats, catId];
      setActiveTab(catId);
    }

    const updated: DeclaredSymptomsDetails = {
      ...current,
      selectedCategories: nextCats
    };

    const autoText = formatSymptomsSummary(updated);
    onChange(updated, autoText);
  };

  // Update specific field
  const updateField = <K extends keyof DeclaredSymptomsDetails>(key: K, value: DeclaredSymptomsDetails[K]) => {
    const updated: DeclaredSymptomsDetails = {
      ...current,
      [key]: value
    };

    const autoText = formatSymptomsSummary(updated);
    onChange(updated, autoText);
  };

  const handleApplySummary = () => {
    const summary = formatSymptomsSummary(current);
    if (summary.trim()) {
      onDescriptionChange(summary);
      setShowAutoSyncMessage(true);
      setTimeout(() => setShowAutoSyncMessage(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER AVEC BADGE EXPLICATIF */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <h3 className="text-xs font-black text-apple-blue uppercase tracking-[0.2em] flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-apple-blue" />
            Symptômes déclarés & Circonstances de la panne
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sélectionnez les catégories observées. Les questions contextuelles sont <strong className="text-slate-300">facultatives</strong> mais optimisent l'expertise technique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedCats.length > 0 && (
            <button
              type="button"
              onClick={handleApplySummary}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Générer automatiquement la synthèse dans la description de panne"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              Actualiser Synthèse
            </button>
          )}
        </div>
      </div>

      {showAutoSyncMessage && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <span>✓</span> Synthèse automatique insérée dans la description du problème !
        </div>
      )}

      {/* BOUTONS DES CATÉGORIES PRINCIPALES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {CATEGORIES.map(cat => {
          const isSelected = selectedCats.includes(cat.id);
          const isCurrentTab = activeTab === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                if (!isSelected) {
                  toggleCategory(cat.id);
                } else {
                  setActiveTab(cat.id);
                }
              }}
              className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[90px] ${
                isSelected
                  ? isCurrentTab
                    ? `${cat.color} ring-2 ring-white/40 shadow-xl scale-[1.02]`
                    : `${cat.color} ring-1 ring-white/10 opacity-90 shadow-md`
                  : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/20 hover:bg-black/50'
              }`}
            >
              <div className="flex items-start justify-between w-full">
                <span className="text-xl">{cat.icon}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleCategory(cat.id);
                  }}
                  className="w-4 h-4 accent-apple-blue rounded cursor-pointer mt-0.5"
                />
              </div>
              <div className="mt-2">
                <div className="text-[11px] font-black leading-tight">{cat.label}</div>
                <div className="text-[8px] opacity-75 font-bold uppercase tracking-wider mt-0.5">{cat.badge}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* PANNEAUX CONTEXTUELS PAR PROBLÈME COCHÉ */}
      {selectedCats.length > 0 && activeTab && (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-5 animate-slide-up">
          {/* SÉLECTEUR D'ONGLETS SI PLUSIEURS COCHÉS */}
          {selectedCats.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5 custom-scrollbar">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0 mr-1">Configurer :</span>
              {selectedCats.map(catId => {
                const catInfo = CATEGORIES.find(c => c.id === catId);
                const isActive = activeTab === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => setActiveTab(catId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-black shadow-md font-black'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{catInfo?.icon}</span>
                    <span>{catInfo?.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 1. NE S'ALLUME PLUS (NO POWER) */}
          {activeTab === 'no_power' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-wider">
                <span>⚡</span>
                <span>Questionnaire : Ne s'allume plus (No power)</span>
                <span className="text-[9px] text-slate-500 font-bold ml-auto lowercase italic">(facultatif mais utile)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Depuis quelle date ? */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Depuis quelle date le problème a-t-il commencé ?
                  </label>
                  <input
                    type="date"
                    value={current.noPowerIncidentDate || ''}
                    onChange={(e) => updateField('noPowerIncidentDate', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-mono outline-none focus:border-red-500 transition-all"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block ml-1">Date estimée ou jour exact de la coupure</span>
                </div>

                {/* Dans quelles conditions ? */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Dans quelles conditions / circonstances ?
                  </label>
                  <div className="relative">
                    <select
                      value={current.noPowerCondition || ''}
                      onChange={(e) => updateField('noPowerCondition', e.target.value)}
                      className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-red-500 transition-all appearance-none"
                    >
                      <option value="">-- Sélectionner une circonstance --</option>
                      <option value="Éteint normalement le soir, ne s'est plus allumé le matin">Éteint normalement le soir, ne s'est plus allumé le matin</option>
                      <option value="Coupure de courant / orage pendant le branchement secteur">Coupure de courant / orage pendant le branchement secteur</option>
                      <option value="Chauffe excessive ou odeur de chaud avant coupure subite">Chauffe excessive ou odeur de chaud avant coupure subite</option>
                      <option value="Suite à une mise à jour macOS">Suite à une mise à jour macOS</option>
                      <option value="Après une chute ou choc mécanique">Après une chute ou choc mécanique</option>
                      <option value="Non utilisé depuis plusieurs mois">Non utilisé depuis plusieurs mois</option>
                      <option value="Circonstance indéterminée">Circonstance indéterminée</option>
                      <option value="autre">Autre circonstance...</option>
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none opacity-40">
                      <ChevronDownIcon className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Condition personnalisée si "autre" */}
                {current.noPowerCondition === 'autre' && (
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Préciser la circonstance de la coupure
                    </label>
                    <input
                      type="text"
                      value={current.noPowerCustomCondition || ''}
                      onChange={(e) => updateField('noPowerCustomCondition', e.target.value)}
                      placeholder="Ex: Le chargeur a fait une étincelle, utilisation dans la voiture..."
                      className="w-full p-3 bg-black/50 border border-red-500/40 rounded-xl text-xs text-white outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Raccourcis cliquables rapides pour les circonstances */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[9px] font-bold text-slate-500 mr-1 self-center">Suggestions rapides :</span>
                {[
                  "Éteint normalement la veille",
                  "Orage / Surtension secteur",
                  "Surchauffe avant extinction",
                  "Inutilisé depuis longtemps"
                ].map(sugg => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => updateField('noPowerCondition', sugg)}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[9px] font-bold border border-white/5 transition-all active:scale-95"
                  >
                    + {sugg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. CONTACT LIQUIDE */}
          {activeTab === 'liquid' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-cyan-400 font-black text-xs uppercase tracking-wider">
                <span>💧</span>
                <span>Questionnaire : Contact liquide & Désoxydation</span>
                <span className="text-[9px] text-slate-500 font-bold ml-auto lowercase italic">(facultatif mais utile)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date / délai */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Depuis quand (Date du liquide) ?
                  </label>
                  <input
                    type="date"
                    value={current.liquidIncidentDate || ''}
                    onChange={(e) => updateField('liquidIncidentDate', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-mono outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                {/* Quel liquide ? */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Quel type de liquide ?
                  </label>
                  <select
                    value={current.liquidType || ''}
                    onChange={(e) => updateField('liquidType', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-cyan-500 transition-all"
                  >
                    <option value="">-- Choisir le liquide --</option>
                    <option value="Eau claire">Eau claire</option>
                    <option value="Café / Thé (chaud)">Café / Thé (chaud)</option>
                    <option value="Soda / Jus sucré (très corrosif)">Soda / Jus sucré (très corrosif)</option>
                    <option value="Bière / Vin / Alcool">Bière / Vin / Alcool</option>
                    <option value="Lait / Produit gras">Lait / Produit gras</option>
                    <option value="Produit de nettoyage / Vitres">Produit de nettoyage / Vitres</option>
                    <option value="autre">Autre liquide...</option>
                  </select>
                </div>

                {/* Tentative de séchage */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Action de séchage entreprise ?
                  </label>
                  <select
                    value={current.liquidDryingAttempted || ''}
                    onChange={(e) => updateField('liquidDryingAttempted', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-cyan-500 transition-all"
                  >
                    <option value="">-- Non spécifié --</option>
                    <option value="Aucune intervention (laissé éteint)">Aucune intervention (laissé éteint)</option>
                    <option value="Mis dans du riz">Mis dans du riz</option>
                    <option value="Sèche-cheveux / Chaleur">Sèche-cheveux / Chaleur</option>
                    <option value="Démonté par le client ou un tiers">Démonté par le client ou un tiers</option>
                  </select>
                </div>

                {current.liquidType === 'autre' && (
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={current.liquidCustomType || ''}
                      onChange={(e) => updateField('liquidCustomType', e.target.value)}
                      placeholder="Préciser le liquide (ex: soupe, parfum, eau de mer...)"
                      className="w-full p-3 bg-black/50 border border-cyan-500/40 rounded-xl text-xs text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Questions critiques : Rallumé ? Mis en charge ? */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Rallumé ? */}
                <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-2">
                  <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    L'appareil a-t-il été rallumé depuis le contact liquide ?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'oui', label: 'Oui', alert: true },
                      { val: 'non', label: 'Non', alert: false },
                      { val: 'inconnu', label: 'Inconnu', alert: false }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateField('liquidPoweredAfter', opt.val as 'oui' | 'non' | 'inconnu')}
                        className={`py-2 px-3 rounded-lg text-xs font-black uppercase transition-all border ${
                          current.liquidPoweredAfter === opt.val
                            ? opt.val === 'oui'
                              ? 'bg-red-600 border-red-500 text-white shadow-lg'
                              : 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {current.liquidPoweredAfter === 'oui' && (
                    <p className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 mt-1">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                      Attention : Allumage après liquide = risque élevé de court-circuit sur les rails PMIC.
                    </p>
                  )}
                </div>

                {/* Mis en charge ? */}
                <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-2">
                  <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    L'appareil a-t-il été branché au chargeur depuis ?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'oui', label: 'Oui' },
                      { val: 'non', label: 'Non' },
                      { val: 'inconnu', label: 'Inconnu' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateField('liquidPluggedAfter', opt.val as 'oui' | 'non' | 'inconnu')}
                        className={`py-2 px-3 rounded-lg text-xs font-black uppercase transition-all border ${
                          current.liquidPluggedAfter === opt.val
                            ? opt.val === 'oui'
                              ? 'bg-red-600 border-red-500 text-white shadow-lg'
                              : 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {current.liquidPluggedAfter === 'oui' && (
                    <p className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 mt-1">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                      Attention : Chargeur branché = électrolyse accélérée et corrosion des pistes cuivre.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. ÉCRAN & AFFICHAGE */}
          {activeTab === 'screen' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-wider">
                <span>🖥️</span>
                <span>Questionnaire : Écran & Affichage</span>
                <span className="text-[9px] text-slate-500 font-bold ml-auto lowercase italic">(facultatif mais utile)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Type d'anomalie d'affichage
                  </label>
                  <select
                    value={current.screenIssueType || ''}
                    onChange={(e) => updateField('screenIssueType', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Choisir le défaut --</option>
                    <option value="Écran noir mais son de démarrage ou clavier allumé">Écran noir mais son de démarrage ou clavier allumé</option>
                    <option value="Lignes verticales / horizontales colorées">Lignes verticales / horizontales colorées</option>
                    <option value="Scintillement / Artefacts graphiques">Scintillement / Artefacts graphiques</option>
                    <option value="Dalle fissurée / Impact interne / Taches d'encre">Dalle fissurée / Impact interne / Taches d'encre</option>
                    <option value="Rétroéclairage absent (image très sombre visible à la lampe)">Rétroéclairage absent (image très sombre visible à la lampe)</option>
                    <option value="S'éteint au-delà d'un certain angle d'ouverture (Flexgate)">S'éteint au-delà d'un certain angle d'ouverture (Flexgate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Cause supposée ou circonstance
                  </label>
                  <select
                    value={current.screenCause || ''}
                    onChange={(e) => updateField('screenCause', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Cause supposée --</option>
                    <option value="Choc / Chute de l'ordinateur">Choc / Chute de l'ordinateur</option>
                    <option value="Objet oublié sur le clavier à la fermeture">Objet oublié sur le clavier à la fermeture</option>
                    <option value="Pression dans un sac de transport">Pression dans un sac de transport</option>
                    <option value="Apparition spontanée sans choc physique">Apparition spontanée sans choc physique</option>
                    <option value="Après nettoyage avec liquide sur l'écran">Après nettoyage avec liquide sur l'écran</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. BATTERIE & CHARGE */}
          {activeTab === 'battery' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                <span>🔋</span>
                <span>Questionnaire : Batterie & Charge</span>
                <span className="text-[9px] text-slate-500 font-bold ml-auto lowercase italic">(facultatif mais utile)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Comportement de la batterie
                  </label>
                  <select
                    value={current.batteryIssueType || ''}
                    onChange={(e) => updateField('batteryIssueType', e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="">-- Problème constaté --</option>
                    <option value="Ne charge plus du tout (bloqué à 0% ou 1%)">Ne charge plus du tout (bloqué à 0% ou 1%)</option>
                    <option value="Se coupe dès que le chargeur est débranché">Se coupe dès que le chargeur est débranché</option>
                    <option value="Autonomie très faible (< 30 minutes)">Autonomie très faible (&lt; 30 minutes)</option>
                    <option value="Batterie gonflée (trackpad dur ou coque déformée)">Batterie gonflée (trackpad dur ou coque déformée)</option>
                    <option value="Voyant du chargeur clignote ou ne s'allume pas">Voyant du chargeur clignote ou ne s'allume pas</option>
                    <option value="Message d'alerte macOS : Réparation recommandée">Message d'alerte macOS : Réparation recommandée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Type de chargeur habituellement utilisé
                  </label>
                  <select
                    value={current.batteryChargerType || ''}
                    onChange={(e) => updateField('batteryChargerType', e.target.value as 'apple_original' | 'generique_tiers' | 'inconnu')}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="">-- Type d'adaptateur secteur --</option>
                    <option value="apple_original">Chargeur Apple d'origine</option>
                    <option value="generique_tiers">Adaptateur tiers / générique / non Apple</option>
                    <option value="inconnu">Chargeur inconnu / non vérifié</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 5. REDÉMARRAGES & SYSTÈME */}
          {activeTab === 'system_reboot' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase tracking-wider">
                <span>🔄</span>
                <span>Questionnaire : Redémarrages & Système</span>
                <span className="text-[9px] text-slate-500 font-bold ml-auto lowercase italic">(facultatif mais utile)</span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Comportement anormal au démarrage
                </label>
                <select
                  value={current.systemIssueType || ''}
                  onChange={(e) => updateField('systemIssueType', e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white font-bold outline-none focus:border-purple-500 transition-all"
                >
                  <option value="">-- Sélectionner le symptôme système --</option>
                  <option value="Redémarre en boucle après quelques secondes (Bootloop)">Redémarre en boucle après quelques secondes (Bootloop)</option>
                  <option value="Affiche un dossier clignotant avec point d'interrogation (SSD non détecté)">Affiche un dossier clignotant avec point d'interrogation (SSD non détecté)</option>
                  <option value="Bloqué sur le logo Apple ou barre de chargement infinie">Bloqué sur le logo Apple ou barre de chargement infinie</option>
                  <option value="Kernel Panic (message multilingue demandant de redémarrer)">Kernel Panic (message multilingue demandant de redémarrer)</option>
                  <option value="Ventilateurs tournent à fond dès l'allumage">Ventilateurs tournent à fond dès l'allumage</option>
                  <option value="Extinction brutale après quelques minutes d'utilisation">Extinction brutale après quelques minutes d'utilisation</option>
                </select>
              </div>
            </div>
          )}

          {/* 6. AUTRE PANNE */}
          {activeTab === 'other' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-slate-300 font-black text-xs uppercase tracking-wider">
                <span>✏️</span>
                <span>Autre panne spécifique déclarée</span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Décrivez précisément la panne spécifique
                </label>
                <input
                  type="text"
                  value={current.customProblem || ''}
                  onChange={(e) => updateField('customProblem', e.target.value)}
                  placeholder="Ex: Clavier bloqué sur certaines touches, Wi-Fi grisé, Port USB-C gauche HS..."
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          )}

          {/* NOTES COMPLÉMENTAIRES TOUJOURS ACCESSIBLES */}
          <div className="pt-3 border-t border-white/5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Précisions & Notes complémentaires du client (Facultatif)
            </label>
            <input
              type="text"
              value={current.additionalNotes || ''}
              onChange={(e) => updateField('additionalNotes', e.target.value)}
              placeholder="Ex: Contient des données professionnelles urgentes, mot de passe session fourni..."
              className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-white/30 transition-all"
            />
          </div>
        </div>
      )}

      {/* SYNTHÈSE / DESCRIPTION DE LA PANNE DIRECTE */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between ml-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Description textuelle finale de la panne * (Transmise sur le bon de prise en charge et le rapport)
          </label>
          {selectedCats.length > 0 && (
            <span className="text-[10px] text-blue-400 font-bold">
              Alimentée par le questionnaire interactif
            </span>
          )}
        </div>
        <textarea
          rows={3}
          value={problemDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Décrivez ici la panne déclarée par le client..."
          className="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:border-apple-blue transition-all font-sans leading-relaxed"
          required
        />
      </div>
    </div>
  );
};

export default DeclaredSymptomsManager;
