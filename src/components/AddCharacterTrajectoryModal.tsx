import React, { useState } from 'react';
import { LoreEntity, CharacterMilestone } from '../types/lore';
import { X, Calendar, Plus, Zap, Shield, Sparkles, Check, Clock, Bookmark } from 'lucide-react';

interface AddCharacterTrajectoryModalProps {
  character: LoreEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntity: LoreEntity) => void;
}

export const AddCharacterTrajectoryModal: React.FC<AddCharacterTrajectoryModalProps> = ({
  character,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !character) return null;

  // Milestone Form Fields
  const [eventDate, setEventDate] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventImpact, setEventImpact] = useState('');

  // Additional character fields
  const [newPower, setNewPower] = useState('');
  const [additionalPowers, setAdditionalPowers] = useState<string[]>([]);
  const [newBioParagraph, setNewBioParagraph] = useState('');
  const [newRole, setNewRole] = useState(character.subDetails?.role || '');

  const [activeSubTab, setActiveSubTab] = useState<'marco' | 'biografia' | 'poderes'>('marco');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddPower = () => {
    const trimmed = newPower.trim();
    if (!trimmed) return;
    if (!additionalPowers.includes(trimmed) && !(character.subDetails?.powers || []).includes(trimmed)) {
      setAdditionalPowers([...additionalPowers, trimmed]);
    }
    setNewPower('');
  };

  const handleRemovePower = (powerToRemove: string) => {
    setAdditionalPowers(additionalPowers.filter(p => p !== powerToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const hasMilestone = eventTitle.trim() && eventDescription.trim();
    const hasPowers = additionalPowers.length > 0;
    const hasBio = newBioParagraph.trim();
    const hasRoleChange = newRole.trim() && newRole.trim() !== (character.subDetails?.role || '');

    if (!hasMilestone && !hasPowers && !hasBio && !hasRoleChange) {
      setErrorMsg('Preencha ao menos uma informação (marco na trajetória, biografia ou poderes).');
      return;
    }

    const currentSubDetails = character.subDetails || {};
    const existingTrajectory: CharacterMilestone[] = currentSubDetails.trajectory || [];

    let updatedTrajectory = [...existingTrajectory];
    let historyNoteParts: string[] = [];

    if (hasMilestone) {
      const newMilestone: CharacterMilestone = {
        id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: eventDate.trim() || 'Período a definir',
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        impact: eventImpact.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      updatedTrajectory.push(newMilestone);
      historyNoteParts.push(`Novo marco: "${eventTitle.trim()}" (${eventDate.trim() || 's/ data'})`);
    }

    // Merge powers
    const mergedPowers = Array.from(
      new Set([...(currentSubDetails.powers || []), ...additionalPowers])
    );
    if (additionalPowers.length > 0) {
      historyNoteParts.push(`Novos poderes: ${additionalPowers.join(', ')}`);
    }

    // Append bio paragraph if provided
    let updatedDescription = character.description;
    if (hasBio) {
      const headerTitle = eventTitle.trim() ? `\n\n## ${eventTitle.trim()}\n` : '\n\n';
      updatedDescription = `${character.description.trim()}${headerTitle}${newBioParagraph.trim()}`;
      historyNoteParts.push('Adicionado novo parágrafo biográfico');
    }

    const updatedEntity: LoreEntity = {
      ...character,
      description: updatedDescription,
      updatedAt: new Date().toISOString(),
      subDetails: {
        ...currentSubDetails,
        role: newRole.trim() || currentSubDetails.role,
        powers: mergedPowers,
        trajectory: updatedTrajectory,
      },
      // Pass special flag for version note if needed
      ...(historyNoteParts.length > 0 ? { historyNote: historyNoteParts.join(' | ') } : {}),
    } as any;

    onSave(updatedEntity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#080d1a] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-[#060913] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
              {character.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                <span className="text-blue-400 font-medium">Expansão de Ficha</span>
                <span>•</span>
                <span>Personagem Canônico</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {character.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-900/30 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('marco')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeSubTab === 'marco'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Marco na Trajetória</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('biografia')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeSubTab === 'biografia'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-400" />
            <span>Adicionar à Biografia</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('poderes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeSubTab === 'poderes'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Poderes & Papel</span>
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {activeSubTab === 'marco' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
                Adicione um acontecimento importante na vida ou trajetória de <strong>{character.name}</strong>. Pode incluir data ou era, título do evento e o impacto na franquia LOH.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    Datação / Momento / Idade
                  </label>
                  <input
                    type="text"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    placeholder="Ex: Aos 5 anos de idade, 210 d.C., Pós-Guerra de Ogon"
                    className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Título do Acontecimento
                  </label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="Ex: O encontro com Rei Poder, Despertar dos poderes"
                    className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                  O que aconteceu (Detalhes do Evento)
                </label>
                <textarea
                  rows={4}
                  value={eventDescription}
                  onChange={e => setEventDescription(e.target.value)}
                  placeholder={`Descreva os acontecimentos que marcaram ${character.name} neste momento da história...`}
                  className="w-full p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                  Impacto / Consequências na Trajetória (Opcional)
                </label>
                <input
                  type="text"
                  value={eventImpact}
                  onChange={e => setEventImpact(e.target.value)}
                  placeholder="Ex: Tornou-se um dos 3 líderes da LAW; Ganhou a confiança da Conclave."
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Existing milestones preview if any */}
              {character.subDetails?.trajectory && character.subDetails.trajectory.length > 0 && (
                <div className="pt-3 border-t border-zinc-800/60">
                  <div className="text-xs font-mono uppercase text-zinc-500 mb-2">
                    Marcos já registrados ({character.subDetails.trajectory.length})
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {character.subDetails.trajectory.map(m => (
                      <div key={m.id} className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/70 text-xs">
                        <div className="flex items-center justify-between text-zinc-300 font-medium">
                          <span>{m.title}</span>
                          <span className="font-mono text-[11px] text-blue-400">{m.date}</span>
                        </div>
                        <p className="text-zinc-400 line-clamp-1 mt-0.5">{m.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'biografia' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200/90 leading-relaxed">
                Acrescente um parágrafo formatado à biografia principal de <strong>{character.name}</strong>. O texto será integrado de forma permanente e organizada ao registro canônico.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                  Novo Parágrafo ou Registro de História
                </label>
                <textarea
                  rows={6}
                  value={newBioParagraph}
                  onChange={e => setNewBioParagraph(e.target.value)}
                  placeholder={`Escreva os fatos ou eventos a serem adicionados à biografia de ${character.name}...`}
                  className="w-full p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500 transition-colors leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'poderes' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                  Papel / Título / Alcunha do Personagem
                </label>
                <input
                  type="text"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="Ex: Detetive, Líder da LAW, Guardião do Fogo Ancestral"
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                  Poderes & Habilidades
                </label>

                {/* Current powers */}
                {character.subDetails?.powers && character.subDetails.powers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {character.subDetails.powers.map(p => (
                      <span key={p} className="px-2.5 py-1 rounded-lg bg-zinc-800/80 text-zinc-300 text-xs border border-zinc-700/50">
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                {/* Newly added powers */}
                {additionalPowers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-amber-400 block font-mono">Novos a adicionar:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {additionalPowers.map(p => (
                        <span key={p} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 text-xs border border-amber-500/40">
                          <span>{p}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePower(p)}
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newPower}
                    onChange={e => setNewPower(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPower();
                      }
                    }}
                    placeholder="Adicionar poder ou habilidade (pressione Enter)"
                    className="flex-1 px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPower}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Informações na Memória</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
