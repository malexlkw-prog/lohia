import React from 'react';
import { Contradiction, LoreEntity } from '../types/lore';
import { AlertTriangle, X, Check, ArrowRight } from 'lucide-react';

interface ContradictionsModalProps {
  contradictions: Contradiction[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (contradictionId: string, chosenVersionText: string, entityId: string) => void;
  onInspectEntity: (entityId: string) => void;
}

export const ContradictionsModal: React.FC<ContradictionsModalProps> = ({
  contradictions,
  isOpen,
  onClose,
  onResolve,
  onInspectEntity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#090d18] border border-amber-500/40 rounded-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#060913]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Contradições na Memória da LOH
              </h2>
              <p className="text-xs text-zinc-400">
                A IA identificou divergências no cânone. Marcos deve definir a versão oficial.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of contradictions */}
        <div className="p-6 overflow-y-auto space-y-6">
          {contradictions.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              Nenhuma contradição pendente na memória da LOH. O cânone está harmonizado.
            </div>
          ) : (
            contradictions.map(item => (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono uppercase text-amber-400">
                      ⚠ Divergência Detectada
                    </span>
                    <h3 className="text-base font-semibold text-white mt-0.5">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {item.details}
                    </p>
                  </div>
                  <button
                    onClick={() => onInspectEntity(item.entityId)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline shrink-0"
                  >
                    Ver detalhes
                  </button>
                </div>

                {/* Conflict Options (Version A vs Version B) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Version A */}
                  <div className="p-3.5 rounded-lg border border-zinc-700/60 bg-zinc-950/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-xs font-mono text-zinc-400 font-medium">
                        Versão A (Registro Tradicional)
                      </div>
                      <div className="text-sm text-zinc-200 mt-1">
                        {item.versionA}
                      </div>
                    </div>
                    <button
                      onClick={() => onResolve(item.id, item.versionA, item.entityId)}
                      className="w-full py-1.5 px-3 rounded-md bg-zinc-800 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                    >
                      Definir como Cânone Oficial
                    </button>
                  </div>

                  {/* Version B */}
                  <div className="p-3.5 rounded-lg border border-zinc-700/60 bg-zinc-950/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-xs font-mono text-zinc-400 font-medium">
                        Versão B (Anais Históricos)
                      </div>
                      <div className="text-sm text-zinc-200 mt-1">
                        {item.versionB}
                      </div>
                    </div>
                    <button
                      onClick={() => onResolve(item.id, item.versionB, item.entityId)}
                      className="w-full py-1.5 px-3 rounded-md bg-zinc-800 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                    >
                      Definir como Cânone Oficial
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
