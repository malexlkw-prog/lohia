import React from 'react';
import { LoreEntity } from '../types/lore';
import { ArrowDown, Calendar, AlertTriangle } from 'lucide-react';

interface TimelineViewProps {
  entities: LoreEntity[];
  onSelectEntity: (entity: LoreEntity) => void;
  onAddEvent: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  entities,
  onSelectEntity,
  onAddEvent,
}) => {
  // Filter events and items that have chronological period/yearOrder
  const timelineEvents = entities
    .filter(e => e.type === 'evento' || e.yearOrder !== undefined || e.period)
    .sort((a, b) => {
      const orderA = a.yearOrder ?? 9999;
      const orderB = b.yearOrder ?? 9999;
      return orderA - orderB;
    });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-500" />
            Linha do tempo
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Cronologia dos acontecimentos e eras da League Ofter High em ordem temporal.
          </p>
        </div>
        <button
          onClick={onAddEvent}
          className="self-start sm:self-auto text-xs font-medium text-blue-400 hover:text-white bg-blue-950/40 hover:bg-blue-900/40 border border-blue-800/50 px-3.5 py-2 rounded-lg transition-colors"
        >
          + Adicionar Evento
        </button>
      </div>

      {timelineEvents.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Nenhum evento cronológico registrado ainda na memória da LOH.
        </div>
      ) : (
        /* Vertical Chronological Spine */
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-blue-600 before:via-zinc-800 before:to-zinc-900">
          {timelineEvents.map((item, index) => {
            const isConflicting = item.status === 'conflitante';
            const relatedCount = item.relatedEntityIds?.length || 0;

            return (
              <div key={item.id} className="relative group">
                {/* Node Point */}
                <div
                  className={`absolute -left-[29px] sm:-left-[33px] top-1.5 w-4 h-4 rounded-full border-2 transition-all ${
                    isConflicting
                      ? 'bg-amber-950 border-amber-400 group-hover:scale-125'
                      : 'bg-[#060913] border-blue-500 group-hover:bg-blue-600 group-hover:scale-125'
                  }`}
                />

                {/* Event Card */}
                <div
                  onClick={() => onSelectEntity(item)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer ${
                    isConflicting
                      ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-400'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:border-blue-500/50 hover:bg-zinc-900/70'
                  }`}
                >
                  {/* Period & Status Metadata (Zero-pill format) */}
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1.5">
                    <span className="text-blue-400 font-semibold">
                      {item.period || 'Período Indefinido'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{item.type}</span>
                    {isConflicting && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Conflito Registrado
                        </span>
                      </>
                    )}
                    {relatedCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{relatedCount} conexões</span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {item.name}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Connected Highlights */}
                  {item.subDetails?.participants && item.subDetails.participants.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/50 text-[11px] text-zinc-500">
                      Envolvidos: <span className="text-zinc-300">{item.subDetails.participants.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Downward indicator between events */}
                {index < timelineEvents.length - 1 && (
                  <div className="flex justify-center -my-3 opacity-30 group-hover:opacity-80 transition-opacity">
                    <ArrowDown className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
