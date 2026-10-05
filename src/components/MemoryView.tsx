import React, { useState, useMemo } from 'react';
import { LoreEntity, EntityType, CanonStatus } from '../types/lore';
import { Search, Plus, Filter, Database, ArrowRight, AlertTriangle, Trash2 } from 'lucide-react';

interface MemoryViewProps {
  entities: LoreEntity[];
  onSelectEntity: (entity: LoreEntity) => void;
  onAddNew: () => void;
  onOpenTimeline: () => void;
  onDeleteEntity?: (id: string, name?: string) => void;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'personagem', label: 'Personagens' },
  { key: 'evento', label: 'Eventos' },
  { key: 'producao', label: 'Produções & Obras' },
  { key: 'poder', label: 'Poderes' },
  { key: 'organizacao', label: 'Organizações' },
  { key: 'local', label: 'Locais' },
  { key: 'lore', label: 'Lore & Mitologia' },
  { key: 'ideia', label: 'Ideias & Drafts' },
  { key: 'relacoes', label: 'Relações' },
];

export const MemoryView: React.FC<MemoryViewProps> = ({
  entities,
  onSelectEntity,
  onAddNew,
  onOpenTimeline,
  onDeleteEntity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CanonStatus | 'all'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Compute counts dynamically
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      personagem: 0,
      evento: 0,
      producao: 0,
      local: 0,
      organizacao: 0,
      poder: 0,
      lore: 0,
      ideia: 0,
      relacoes: 0,
    };
    entities.forEach(e => {
      if (e.type === 'producao' || e.type === 'filme' || e.type === 'serie' || e.type === 'webserie' || e.type === 'episodio' || e.type === 'obra') {
        counts.producao++;
      } else if (e.type === 'ideia' || e.status === 'rascunho' || e.status === 'proposta') {
        counts.ideia++;
        if (counts[e.type] !== undefined) counts[e.type]++;
      } else if (counts[e.type] !== undefined) {
        counts[e.type]++;
      }
      if (e.relatedEntityIds && e.relatedEntityIds.length > 0) {
        counts.relacoes += e.relatedEntityIds.length;
      }
    });
    return counts;
  }, [entities]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    return entities.filter(e => {
      // Category filter
      if (selectedCategory && selectedCategory !== 'relacoes') {
        if (selectedCategory === 'producao') {
          const isProd = e.type === 'producao' || e.type === 'filme' || e.type === 'serie' || e.type === 'webserie' || e.type === 'episodio' || e.type === 'obra';
          if (!isProd) return false;
        } else if (selectedCategory === 'ideia') {
          const isIdea = e.type === 'ideia' || e.status === 'rascunho' || e.status === 'proposta';
          if (!isIdea) return false;
        } else {
          if (e.type !== selectedCategory) return false;
        }
      }
      if (selectedCategory === 'relacoes') {
        if (!e.relatedEntityIds || e.relatedEntityIds.length === 0) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && e.status !== statusFilter) {
        return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = e.name.toLowerCase().includes(q);
        const matchesDesc = e.description.toLowerCase().includes(q);
        const matchesPeriod = (e.period || '').toLowerCase().includes(q);
        const matchesRole = (e.subDetails?.role || '').toLowerCase().includes(q);
        const matchesParticipants = (e.subDetails?.participants || []).some(p => p.toLowerCase().includes(q));

        if (!matchesName && !matchesDesc && !matchesPeriod && !matchesRole && !matchesParticipants) {
          return false;
        }
      }

      return true;
    });
  }, [entities, selectedCategory, statusFilter, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
            Repositório Canônico
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Memória ({entities.length})
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onAddNew}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Pesquisar na memória da LOH..."
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800/90 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Category Grid / Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono uppercase text-zinc-500">
          <span>Categorias Principais</span>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-blue-400 hover:text-blue-300 capitalize cursor-pointer lowercase"
            >
              Ver todas ({entities.length})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {CATEGORIES.map(cat => {
            const count = categoryCounts[cat.key] || 0;
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(isSelected ? null : cat.key)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/30 text-white shadow-sm'
                    : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
              >
                <div className="text-sm font-medium">{cat.label}</div>
                <div className="text-xs font-mono text-zinc-500 mt-1">
                  {cat.label} • {count}
                </div>
              </button>
            );
          })}
          
          {/* Linha do tempo shortcut button */}
          <button
            onClick={onOpenTimeline}
            className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-zinc-300 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition-all group cursor-pointer"
          >
            <div className="text-sm font-medium group-hover:text-blue-400 transition-colors">
              Linha do tempo
            </div>
            <div className="text-xs font-mono text-zinc-500 mt-1">
              Cronologia • {entities.filter(e => e.type === 'evento').length}
            </div>
          </button>
        </div>
      </div>

      {/* Status Filter Tab Bar (if there are items) */}
      {entities.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 overflow-x-auto text-xs pb-1">
          <span className="text-zinc-500 font-mono flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'canon', label: 'Cânone' },
            { id: 'proposta', label: 'Propostas' },
            { id: 'rascunho', label: 'Rascunhos' },
            { id: 'conflitante', label: 'Conflitantes' },
            { id: 'antiga', label: 'Antigas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Entity List */}
      <div className="space-y-2">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
          {filteredEntities.length} registros exibidos
        </div>
        {filteredEntities.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
            <Database className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-sm font-medium text-zinc-300">
              {entities.length === 0
                ? 'A memória da League Ofter High está limpa e vazia.'
                : 'Nenhum registro encontrado para a busca.'}
            </div>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {entities.length === 0
                ? 'Marcos, utilize o botão "+ Adicionar" acima para cadastrar os personagens, acontecimentos e locais oficiais da LOH.'
                : 'Tente alterar os termos de busca ou filtros de categoria.'}
            </p>
            {entities.length === 0 && (
              <button
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Primeiro Registro</span>
              </button>
            )}
          </div>
        ) : (
          filteredEntities.map(item => {
            const isConflicting = item.status === 'conflitante';
            const isConfirmingThis = pendingDeleteId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectEntity(item)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
                  isConflicting
                    ? 'border-amber-500/30 bg-amber-950/10 hover:border-amber-400'
                    : 'border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-blue-500/40'
                }`}
              >
                <div className="space-y-1 pr-4 flex-1">
                  {/* Clean typographic metadata (Zero pills) */}
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="capitalize text-blue-400 font-medium">{item.type}</span>
                    <span aria-hidden="true">•</span>
                    <span className={item.status === 'canon' ? 'text-zinc-300' : isConflicting ? 'text-amber-400' : 'text-zinc-500'}>
                      {item.status === 'canon' ? 'Cânone' : item.status === 'conflitante' ? 'Conflito' : item.status}
                    </span>
                    {item.period && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{item.period}</span>
                      </>
                    )}
                    {item.relatedEntityIds && item.relatedEntityIds.length > 0 && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{item.relatedEntityIds.length} conexões</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                    {item.name}
                    {isConflicting && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Inline quick delete action */}
                  {onDeleteEntity && (
                    <div
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      {isConfirmingThis ? (
                        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-red-900/50 shadow-lg">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                              onDeleteEntity(item.id, item.name);
                              setPendingDeleteId(null);
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                              setPendingDeleteId(null);
                            }}
                            className="px-1.5 py-1 text-zinc-400 hover:text-white rounded text-[11px] transition-colors cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            e.preventDefault();
                            setPendingDeleteId(item.id);
                          }}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                          title={`Excluir ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
