import React from 'react';
import { DocumentNature } from '../types.ts';
import { ShieldCheckIcon, MacbookIcon } from './icons.tsx';
import { WARRANTY_PRESETS } from '../utils/warrantyPresets.ts';

interface WarrantyConfigSectionProps {
  documentNature: DocumentNature;
  onChangeDocumentNature: (nature: DocumentNature) => void;
  warranty: string;
  onChangeWarranty: (warranty: string) => void;
  warrantyConditions: string;
  onChangeWarrantyConditions: (conditions: string) => void;
  includeWarrantyBlock: boolean;
  onChangeIncludeWarrantyBlock: (include: boolean) => void;
  isProforma?: boolean;
}

const WarrantyConfigSection: React.FC<WarrantyConfigSectionProps> = ({
  documentNature,
  onChangeDocumentNature,
  warranty,
  onChangeWarranty,
  warrantyConditions,
  onChangeWarrantyConditions,
  includeWarrantyBlock,
  onChangeIncludeWarrantyBlock,
  isProforma = false,
}) => {
  const handleNatureSelect = (nature: DocumentNature) => {
    onChangeDocumentNature(nature);
    const preset = WARRANTY_PRESETS[nature];
    if (preset) {
      // Si la garantie actuelle est vide ou correspond à une ancienne valeur par défaut, proposer la durée type
      if (!warranty || warranty === '3 mois sur la pièce changée' || warranty === '30 jours' || warranty === '6 Mois SAV Local') {
        onChangeWarranty(preset.durations[0] || '');
      }
      // Si les conditions sont vides ou identiques à un preset, mettre à jour avec le preset approprié
      if (!warrantyConditions || warrantyConditions.trim() === '') {
        onChangeWarrantyConditions(preset.conditions);
      }
    }
  };

  const applyPresetConditions = (nature: DocumentNature) => {
    const preset = WARRANTY_PRESETS[nature];
    if (preset) {
      onChangeWarrantyConditions(preset.conditions);
      if (!warranty || warranty.trim() === '') {
        onChangeWarranty(preset.durations[0]);
      }
    }
  };

  const clearConditions = () => {
    onChangeWarrantyConditions('');
  };

  const parsedLines = warrantyConditions
    ? warrantyConditions.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return (
    <div className="border border-white/10 bg-slate-900/60 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* 1. Sélection de la nature de l'opération */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase text-slate-300 flex items-center gap-2">
            <MacbookIcon className="w-4 h-4 text-blue-400" />
            Nature du document & de l'objet
          </label>
          <span className="text-[10px] text-slate-400">
            {isProforma ? 'Devis Proforma' : 'Facture'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleNatureSelect('macbook')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex flex-col gap-1 ${
              documentNature === 'macbook'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-sm">💻 Ordinateur</span>
            <span className="text-[10px] font-normal opacity-80">MacBook vente</span>
          </button>

          <button
            type="button"
            onClick={() => handleNatureSelect('pieces')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex flex-col gap-1 ${
              documentNature === 'pieces'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-sm">🧩 Pièces</span>
            <span className="text-[10px] font-normal opacity-80">Écran, batterie...</span>
          </button>

          <button
            type="button"
            onClick={() => handleNatureSelect('reparation')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex flex-col gap-1 ${
              documentNature === 'reparation'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-sm">🔧 Réparation</span>
            <span className="text-[10px] font-normal opacity-80">Intervention SAV</span>
          </button>

          <button
            type="button"
            onClick={() => handleNatureSelect('autre')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex flex-col gap-1 ${
              documentNature === 'autre'
                ? 'bg-blue-600/30 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-sm">✍️ Autre</span>
            <span className="text-[10px] font-normal opacity-80">Précision libre</span>
          </button>
        </div>
      </div>

      {/* 2. Gestion complète de la Garantie */}
      <div className="pt-3 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase text-slate-300 flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
            Garantie & Mentions (100% Modifiables)
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWarrantyBlock}
              onChange={e => onChangeIncludeWarrantyBlock(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-white/20"
            />
            <span className="text-[11px] font-bold text-slate-300">
              Afficher sur le document
            </span>
          </label>
        </div>

        {includeWarrantyBlock && (
          <>
            {/* Puces de choix rapide de durée */}
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Durée de garantie appliquée :</span>
                <span className="text-slate-500 lowercase">cliquez pour choisir ou modifiez librement</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {WARRANTY_PRESETS[documentNature].durations.map(dur => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => onChangeWarranty(dur)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      warranty === dur
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {dur}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={warranty}
                onChange={e => onChangeWarranty(e.target.value)}
                placeholder="Ex: 6 Mois SAV Local, 3 Mois Pièces & Main d'œuvre, Sans garantie..."
                className="w-full p-2.5 bg-slate-800/80 rounded-xl text-white border border-white/10 text-xs font-bold outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Conditions & mentions spécifiques */}
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Conditions & Mentions à imprimer sur le document :
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-500">Modèles rapides :</span>
                  <button
                    type="button"
                    onClick={() => applyPresetConditions('macbook')}
                    className="text-[10px] px-2 py-0.5 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded border border-blue-700/50"
                  >
                    MacBook Vente
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetConditions('reparation')}
                    className="text-[10px] px-2 py-0.5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 rounded border border-amber-700/50"
                  >
                    Réparation
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetConditions('pieces')}
                    className="text-[10px] px-2 py-0.5 bg-violet-900/40 hover:bg-violet-800/60 text-violet-300 rounded border border-violet-700/50"
                  >
                    Pièces
                  </button>
                  <button
                    type="button"
                    onClick={clearConditions}
                    className="text-[10px] px-2 py-0.5 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded border border-red-700/50"
                  >
                    Vider
                  </button>
                </div>
              </div>

              <textarea
                value={warrantyConditions}
                onChange={e => onChangeWarrantyConditions(e.target.value)}
                rows={4}
                placeholder="Entrez chaque mention ou condition de garantie sur une ligne distincte..."
                className="w-full p-2.5 bg-slate-800/80 rounded-xl text-white border border-white/10 text-xs font-mono leading-relaxed outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Astuce : Chaque ligne renseignée deviendra une puce sur le document client. Seul ce qui est écrit ici sera imprimé !
              </p>
            </div>

            {/* Aperçu direct de ce qui figurera sur le document */}
            {(warranty.trim() || parsedLines.length > 0) && (
              <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-[11px] space-y-1">
                <div className="text-[9px] font-black uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span>Aperçu document client :</span>
                </div>
                {warranty.trim() && (
                  <div className="text-slate-200 font-bold">
                    • Garantie : <span className="text-white font-extrabold">{warranty.trim()}</span>
                  </div>
                )}
                {parsedLines.map((line, idx) => (
                  <div key={idx} className="text-slate-300 text-[10px]">
                    {line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!includeWarrantyBlock && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300/80">
            L'encart Garantie & Mentions ne sera <strong>pas affiché</strong> sur le document envoyé au client.
          </div>
        )}
      </div>
    </div>
  );
};

export default WarrantyConfigSection;
