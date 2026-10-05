import React, { useState, useMemo } from 'react';
import { LoreEntity, CanonStatus } from '../types/lore';
import {
  Users,
  Search,
  Plus,
  Calendar,
  Sparkles,
  Zap,
  ArrowRight,
  Trash2,
  AlertTriangle,
  Clock,
  Shield,
  BookOpen,
} from 'lucide-react';

interface CharactersViewProps {
  entities: LoreEntity[];
  onSelectCharacter: (character: LoreEntity) => void;
  onAddNewCharacter: () => void;
  onAddTrajectory: (character: LoreEntity) => void;
  onDeleteCharacter: (id: string, name?: string) => void;
}

export const CharactersView: React.FC<CharactersViewProps> = ({
  entities,
  onSelectCharacter,
  onAddNewCharacter,
  onAddTrajectory,
  onDeleteCharacter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Extract all characters (type: 'personagem')
  const characters = useMemo(() => {
    return entities.filter(e => e.type === 'personagem');
  }, [entities]);

  // Filtered characters list
  const filteredCharacters = useMemo(() => {
    return characters.filter(char => {
      // Status filter
      if (statusFilter !== 'all' && char.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = char.name.toLowerCase().includes(q);
        const matchesDesc = char.description.toLowerCase().includes(q);
        const matchesRole = (char.subDetails?.role || '').toLowerCase().includes(q);
        const matchesPeriod = (char.period || '').toLowerCase().includes(q);
        const matchesPowers = (char.subDetails?.powers || []).some(p => p.toLowerCase().includes(q));
        const matchesMilestone = (char.subDetails?.trajectory || []).some(
          m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.date.toLowerCase().includes(q)
        );

        if (!matchesName && !matchesDesc && !matchesRole && !matchesPeriod && !matchesPowers && !matchesMilestone) {
          return false;
        }
      }

      return true;
    });
  }, [characters, statusFilter, searchQuery]);

  const getStatusColor = (status: CanonStatus) => {
    switch (status) {
      case 'canon':
        return 'text-blue-400 bg-blue-950/40 border-blue-500/30';
      case 'proposta':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
      case 'rascunho':
        return 'text-zinc-400 bg-zinc-900 border-zinc-700/40';
      case 'conflitante':
        return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      case 'antiga':
        return 'text-zinc-500 bg-zinc-900 border-zinc-800';
      default:
        return 'text-zinc-400 bg-zinc-900 border-zinc-800';
    }
  };

  const getStatusLabel = (status: CanonStatus) => {
    switch (status) {
      case 'canon':
        return 'Cânone';
      case 'proposta':
        return 'Proposta';
      case 'rascunho':
        return 'Rascunho';
      case 'conflitante':
        return 'Conflito';
      case 'antiga':
        return 'Versão Antiga';
      default:
        return status;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Galeria do Universo LOH
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Personagens ({characters.length})
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Navegue pelos heróis, guardiões, entidades e vilões canônicos com trajetórias, poderes e biografias.
          </p>
        </div>

        <button
          onClick={onAddNewCharacter}
          className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-900/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Personagem</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Pesquisar personagem por nome, papel, poderes, era ou trajetória..."
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

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `Todos (${characters.length})` },
            { id: 'canon', label: 'Cânone' },
            { id: 'proposta', label: 'Propostas' },
            { id: 'rascunho', label: 'Rascunhos' },
            { id: 'conflitante', label: 'Conflitantes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Characters Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-300">
              {searchQuery ? 'Nenhum personagem encontrado' : 'Nenhum personagem cadastrado'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Tente buscar com outro nome, poder ou limpe os filtros de pesquisa.'
                : 'Cadastre o primeiro herói ou figura histórica da LOH para começar a registrar trajetórias.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={onAddNewCharacter}
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Primeiro Personagem</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCharacters.map(char => {
            const isConflicting = char.status === 'conflitante';
            const isConfirmingDelete = pendingDeleteId === char.id;
            const powers = char.subDetails?.powers || [];
            const milestones = char.subDetails?.trajectory || [];
            const role = char.subDetails?.role;

            return (
              <div
                key={char.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between group ${
                  isConflicting
                    ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-400'
                    : 'bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-blue-500/40'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Avatar & Name & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                        {char.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            onClick={() => onSelectCharacter(char)}
                            className="text-base font-bold text-white group-hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            {char.name}
                          </h3>
                          {isConflicting && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        {role && (
                          <div className="text-xs font-mono text-zinc-400 mt-0.5">
                            {role}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStatusColor(
                        char.status
                      )}`}
                    >
                      {getStatusLabel(char.status)}
                    </span>
                  </div>

                  {/* Period or Birth era */}
                  {char.period && (
                    <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{char.period}</span>
                    </div>
                  )}

                  {/* Powers Tags */}
                  {powers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {powers.slice(0, 4).map(power => (
                        <span
                          key={power}
                          className="px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-[11px] text-zinc-300 flex items-center gap-1"
                        >
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          <span>{power}</span>
                        </span>
                      ))}
                      {powers.length > 4 && (
                        <span className="text-[10px] font-mono text-zinc-500 self-center">
                          +{powers.length - 4} mais
                        </span>
                      )}
                    </div>
                  )}

                  {/* Trajectory Milestones Badge & Preview */}
                  {milestones.length > 0 ? (
                    <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-800/30 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-blue-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Trajetória ({milestones.length} {milestones.length === 1 ? 'marco' : 'marcos'})
                        </span>
                        <span className="text-zinc-500 text-[10px]">{milestones[milestones.length - 1].date}</span>
                      </div>
                      <p className="text-zinc-300 font-medium line-clamp-1">
                        Último: {milestones[milestones.length - 1].title}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 font-mono italic">
                      Nenhum marco de data ou evento adicionado à trajetória ainda.
                    </div>
                  )}

                  {/* Brief biography excerpt */}
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed pt-1">
                    {char.description.replace(/^#+ .*\n+/g, '')}
                  </p>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-3 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Add trajectory / info button */}
                    <button
                      type="button"
                      onClick={() => onAddTrajectory(char)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 text-xs font-medium transition-colors cursor-pointer"
                      title="Adicionar data, evento ou acontecimento na trajetória"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Trajetória</span>
                    </button>

                    {/* View complete sheet button */}
                    <button
                      type="button"
                      onClick={() => onSelectCharacter(char)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 text-xs transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Ficha</span>
                    </button>
                  </div>

                  {/* Delete button with instant inline confirmation */}
                  <div>
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-red-900/60">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteCharacter(char.id, char.name);
                            setPendingDeleteId(null);
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="px-1.5 py-1 text-zinc-400 hover:text-white rounded text-[11px] transition-colors cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(char.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                        title={`Excluir permanentemente ${char.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
