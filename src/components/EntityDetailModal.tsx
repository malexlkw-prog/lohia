import React, { useState } from 'react';
import { LoreEntity } from '../types/lore';
import { X, ArrowRight, History, Edit3, Trash2, AlertTriangle, Link2, Calendar, Plus } from 'lucide-react';

interface EntityDetailModalProps {
  entity: LoreEntity | null;
  allEntities: LoreEntity[];
  onClose: () => void;
  onEdit: (entity: LoreEntity) => void;
  onDelete: (id: string, name?: string) => void;
  onSelectEntity: (entity: LoreEntity) => void;
  onAddTrajectory?: (entity: LoreEntity) => void;
  onResolveConflict?: (entity: LoreEntity) => void;
}

export const EntityDetailModal: React.FC<EntityDetailModalProps> = ({
  entity,
  allEntities,
  onClose,
  onEdit,
  onDelete,
  onSelectEntity,
  onAddTrajectory,
  onResolveConflict,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!entity) return null;

  const relatedEntities = allEntities.filter(e => 
    entity.relatedEntityIds?.includes(e.id)
  );

  const getStatusColor = (status: LoreEntity['status']) => {
    switch (status) {
      case 'canon':
        return 'text-blue-400';
      case 'proposta':
        return 'text-emerald-400';
      case 'rascunho':
        return 'text-zinc-400';
      case 'conflitante':
        return 'text-amber-400';
      case 'antiga':
        return 'text-zinc-500';
      default:
        return 'text-zinc-400';
    }
  };

  const getStatusLabel = (status: LoreEntity['status']) => {
    switch (status) {
      case 'canon':
        return 'Cânone Oficial';
      case 'proposta':
        return 'Proposta de Produção';
      case 'rascunho':
        return 'Rascunho';
      case 'conflitante':
        return 'Conflitante';
      case 'antiga':
        return 'Versão Antiga';
      default:
        return status;
    }
  };

  const handleExecuteDelete = () => {
    onDelete(entity.id, entity.name);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#090d18] border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/60 bg-[#060913]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <span className="capitalize">{entity.type}</span>
              <span aria-hidden="true">•</span>
              <span className={getStatusColor(entity.status)}>
                {getStatusLabel(entity.status)}
              </span>
              {entity.period && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="text-zinc-300">{entity.period}</span>
                </>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {entity.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Alert Banner if conflicting */}
        {entity.status === 'conflitante' && (
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Esta informação possui divergências cronológicas ou narrativas registradas.</span>
            </div>
            {onResolveConflict && (
              <button
                onClick={() => onResolveConflict(entity)}
                className="text-xs font-medium text-amber-400 hover:text-amber-200 underline ml-2 shrink-0 cursor-pointer"
              >
                Definir Cânone
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-zinc-300 leading-relaxed">
          {/* Main Description */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
              Registro Canônico
            </h3>
            <p className="whitespace-pre-line text-zinc-200">
              {entity.description}
            </p>
          </div>

          {/* Sub Details */}
          {entity.subDetails && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/60">
              {entity.subDetails.role && (
                <div>
                  <span className="text-xs font-mono text-zinc-500 block mb-1">Papel / Título</span>
                  <span className="text-white">{entity.subDetails.role}</span>
                </div>
              )}
              {entity.subDetails.participants && entity.subDetails.participants.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-zinc-500 block mb-1">Participantes / Figuras</span>
                  <div className="flex flex-wrap gap-2 text-zinc-300">
                    {entity.subDetails.participants.map((p, idx) => (
                      <span key={idx} className="bg-zinc-800/60 px-2.5 py-1 rounded text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entity.subDetails.locations && entity.subDetails.locations.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-zinc-500 block mb-1">Locais Relacionados</span>
                  <div className="flex flex-wrap gap-2 text-zinc-300">
                    {entity.subDetails.locations.map((loc, idx) => (
                      <span key={idx} className="bg-zinc-800/60 px-2.5 py-1 rounded text-xs">
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entity.subDetails.consequences && (
                <div>
                  <span className="text-xs font-mono text-zinc-500 block mb-1">Consequências Históricas</span>
                  <p className="text-zinc-300">{entity.subDetails.consequences}</p>
                </div>
              )}
              {entity.subDetails.powers && entity.subDetails.powers.length > 0 && (
                <div>
                  <span className="text-xs font-mono text-zinc-500 block mb-1">Poderes / Habilidades</span>
                  <div className="flex flex-wrap gap-2 text-zinc-300">
                    {entity.subDetails.powers.map((pow, idx) => (
                      <span key={idx} className="bg-blue-950/40 border border-blue-800/40 text-blue-300 px-2.5 py-1 rounded text-xs">
                        {pow}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entity.subDetails.notes && (
                <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800/60 text-xs text-zinc-400">
                  <span className="font-mono text-zinc-500 block mb-1">Observações de Marcos</span>
                  {entity.subDetails.notes}
                </div>
              )}
            </div>
          )}

          {/* Character Trajectory & Milestones Section */}
          {(entity.type === 'personagem' || (entity.subDetails?.trajectory && entity.subDetails.trajectory.length > 0)) && (
            <div className="pt-2 border-t border-zinc-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Trajetória & Marcos Temporais ({entity.subDetails?.trajectory?.length || 0})
                </h3>
                {onAddTrajectory && (
                  <button
                    type="button"
                    onClick={() => onAddTrajectory(entity)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Informação</span>
                  </button>
                )}
              </div>

              {entity.subDetails?.trajectory && entity.subDetails.trajectory.length > 0 ? (
                <div className="space-y-2.5 relative pl-4 border-l-2 border-blue-500/40 ml-1 mt-2">
                  {entity.subDetails.trajectory.map(milestone => (
                    <div
                      key={milestone.id}
                      className="relative p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5 text-xs"
                    >
                      <div className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full bg-blue-500 border border-black" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white text-sm">{milestone.title}</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/50 text-blue-300">
                          {milestone.date}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed whitespace-pre-line">
                        {milestone.description}
                      </p>
                      {milestone.impact && (
                        <div className="pt-1 text-[11px] text-zinc-400 flex items-start gap-1">
                          <span className="text-amber-400 font-semibold shrink-0">Impacto:</span>
                          <span>{milestone.impact}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                  <p className="text-xs text-zinc-400">
                    Nenhum acontecimento com data ou marco específico registrado ainda na trajetória deste personagem.
                  </p>
                  {onAddTrajectory && (
                    <button
                      type="button"
                      onClick={() => onAddTrajectory(entity)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar Primeiro Marco da Trajetória</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Related Entities (Graph Connections) */}
          {relatedEntities.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/60">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Conexões na Memória ({relatedEntities.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatedEntities.map(rel => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectEntity(rel)}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/70 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition-all group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                        {rel.name}
                      </div>
                      <div className="text-xs text-zinc-500 capitalize">
                        {rel.type} {rel.period ? `• ${rel.period}` : ''}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Version History Toggle */}
          <div className="pt-2 border-t border-zinc-800/60">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>
                Histórico de Versões ({entity.history?.length || 0})
              </span>
              <span className="text-zinc-600">
                {showHistory ? '• Ocultar' : '• Expandir'}
              </span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-3 pl-2 border-l border-zinc-800">
                {(!entity.history || entity.history.length === 0) ? (
                  <p className="text-xs text-zinc-500">
                    Versão original sem edições prévias registradas.
                  </p>
                ) : (
                  entity.history.map(item => (
                    <div key={item.id} className="text-xs space-y-1 bg-zinc-900/40 p-3 rounded border border-zinc-800/50">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="font-medium text-zinc-300">{item.note}</span>
                        <span>{new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {item.previousData.description && (
                        <div className="text-zinc-500 line-clamp-2 italic">
                          "{item.previousData.description}"
                        </div>
                      )}
                      {item.previousData.period && (
                        <div className="text-zinc-500">
                          Data anterior: {item.previousData.period}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800/60 bg-[#060913] flex items-center justify-between">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-300 font-medium">Excluir permanentemente?</span>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Sim, Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors py-2 px-3 rounded-lg hover:bg-red-950/30 border border-transparent hover:border-red-900/40 cursor-pointer"
              title="Excluir este registro"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onEdit(entity)}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Registro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
