import React, { useState, useEffect } from 'react';
import { EntityType, CanonStatus, LoreEntity } from '../types/lore';
import { X, Check, Zap, Plus } from 'lucide-react';

interface AddEntityModalProps {
  initialEntity?: LoreEntity | null;
  allEntities: LoreEntity[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (entityData: any) => void;
}

const ENTITY_TYPE_LABELS: { type: EntityType; label: string; desc: string }[] = [
  { type: 'personagem', label: 'Personagem', desc: 'Heróis, vilões, mestres, deuses e figuras históricas.' },
  { type: 'evento', label: 'Evento', desc: 'Batalhas, cataclismos, acordos, ascensões e mortes.' },
  { type: 'producao', label: 'Produção Audiovisual', desc: 'Projetos audiovisuais, especiais e derivados da franquia.' },
  { type: 'filme', label: 'Filme', desc: 'Longas-metragens, animações ou curtas do universo LOH.' },
  { type: 'serie', label: 'Série', desc: 'Séries completas, temporadas e arcos de episódios.' },
  { type: 'webserie', label: 'Web Série', desc: 'Web séries digitais, websódios e projetos contínuos.' },
  { type: 'episodio', label: 'Episódio', desc: 'Episódios individuais com sinopse e consequências.' },
  { type: 'organizacao', label: 'Organização', desc: 'Facções, clãs, ordens arcanas, reinos e assembleias.' },
  { type: 'local', label: 'Local', desc: 'Reinos, cidadelas sagradas, continentes e dimensões.' },
  { type: 'poder', label: 'Poder', desc: 'Habilidades, magias, técnicas e forças primordiais.' },
  { type: 'lore', label: 'Lore & Mitologia', desc: 'História do mundo, regras cósmicas e mitos fundamentais.' },
  { type: 'ideia', label: 'Ideia / Rascunho', desc: 'Conceitos em desenvolvimento, drafts e propostas de roteiro.' },
  { type: 'obra', label: 'Obra / Tomo', desc: 'Crônicas, livros sagrados, lendas registradas e tomos.' },
  { type: 'outro', label: 'Outro', desc: 'Artefatos, relíquias, conceitos cósmicos e profecias.' },
];

export const AddEntityModal: React.FC<AddEntityModalProps> = ({
  initialEntity,
  allEntities,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedType, setSelectedType] = useState<EntityType | null>(
    initialEntity ? initialEntity.type : null
  );

  // Form fields
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CanonStatus>('canon');
  const [participants, setParticipants] = useState('');
  const [consequences, setConsequences] = useState('');
  const [locations, setLocations] = useState('');
  const [selectedPowers, setSelectedPowers] = useState<string[]>([]);
  const [customPowerInput, setCustomPowerInput] = useState('');
  const [role, setRole] = useState('');
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Registered power entities from the database (Aba Poderes)
  const registeredPowers = allEntities.filter(e => e.type === 'poder');

  useEffect(() => {
    if (initialEntity) {
      setSelectedType(initialEntity.type);
      setName(initialEntity.name);
      setPeriod(initialEntity.period || '');
      setDescription(initialEntity.description);
      setStatus(initialEntity.status);
      setParticipants(initialEntity.subDetails?.participants?.join(', ') || '');
      setConsequences(initialEntity.subDetails?.consequences || '');
      setLocations(initialEntity.subDetails?.locations?.join(', ') || '');
      setSelectedPowers(initialEntity.subDetails?.powers || []);
      setCustomPowerInput('');
      setRole(initialEntity.subDetails?.role || '');
      setRelatedIds(initialEntity.relatedEntityIds || []);
      setNotes(initialEntity.subDetails?.notes || '');
    } else {
      setSelectedType(null);
      setName('');
      setPeriod('');
      setDescription('');
      setStatus('canon');
      setParticipants('');
      setConsequences('');
      setLocations('');
      setSelectedPowers([]);
      setCustomPowerInput('');
      setRole('');
      setRelatedIds([]);
      setNotes('');
    }
  }, [initialEntity, isOpen]);

  if (!isOpen) return null;

  const handleTypeSelect = (type: EntityType) => {
    setSelectedType(type);
  };

  const handleAddCustomPower = () => {
    if (!customPowerInput.trim()) return;
    const newItems = customPowerInput
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    const combined = Array.from(new Set([...selectedPowers, ...newItems]));
    setSelectedPowers(combined);
    setCustomPowerInput('');
  };

  const handleToggleRegisteredPower = (powerEntity: LoreEntity) => {
    const isAlreadySelected = selectedPowers.some(
      p => p.toLowerCase() === powerEntity.name.toLowerCase()
    );
    if (isAlreadySelected) {
      setSelectedPowers(prev => prev.filter(p => p.toLowerCase() !== powerEntity.name.toLowerCase()));
      setRelatedIds(prev => prev.filter(id => id !== powerEntity.id));
    } else {
      setSelectedPowers(prev => [...prev, powerEntity.name]);
      if (!relatedIds.includes(powerEntity.id)) {
        setRelatedIds(prev => [...prev, powerEntity.id]);
      }
    }
  };

  const handleRemovePower = (powerName: string) => {
    setSelectedPowers(prev => prev.filter(p => p !== powerName));
    const matchedEntity = registeredPowers.find(e => e.name.toLowerCase() === powerName.toLowerCase());
    if (matchedEntity) {
      setRelatedIds(prev => prev.filter(id => id !== matchedEntity.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !selectedType) return;

    // Helper to estimate yearOrder if it's an event
    let yearOrder: number | undefined = undefined;
    if (period) {
      const bcMatch = period.match(/(\d+)\s*a\.?c\.?/i);
      const adMatch = period.match(/(\d+)\s*d\.?c\.?/i);
      if (bcMatch) {
        yearOrder = -parseInt(bcMatch[1], 10);
      } else if (adMatch) {
        yearOrder = parseInt(adMatch[1], 10);
      } else {
        const anyNumber = period.match(/\d+/);
        if (anyNumber) yearOrder = parseInt(anyNumber[0], 10);
      }
    }

    // Include any typed power that wasn't submitted via plus button
    let finalPowers = [...selectedPowers];
    if (customPowerInput.trim()) {
      const extra = customPowerInput.split(',').map(p => p.trim()).filter(Boolean);
      finalPowers = Array.from(new Set([...finalPowers, ...extra]));
    }

    const payload = {
      ...(initialEntity ? { id: initialEntity.id } : {}),
      name: name.trim(),
      type: selectedType,
      status,
      period: period.trim() || undefined,
      yearOrder,
      description: description.trim(),
      relatedEntityIds: relatedIds,
      subDetails: {
        ...(role.trim() ? { role: role.trim() } : {}),
        ...(participants.trim()
          ? { participants: participants.split(',').map(p => p.trim()).filter(Boolean) }
          : {}),
        ...(consequences.trim() ? { consequences: consequences.trim() } : {}),
        ...(locations.trim()
          ? { locations: locations.split(',').map(l => l.trim()).filter(Boolean) }
          : {}),
        ...(finalPowers.length > 0 ? { powers: finalPowers } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#090d18] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#060913]">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {initialEntity ? 'Editar Memória' : 'O que você quer adicionar?'}
            </h2>
            <p className="text-xs text-zinc-400">
              {initialEntity
                ? `Atualizando ${initialEntity.name}`
                : selectedType
                ? `Cadastrando novo ${selectedType}`
                : 'Selecione uma categoria do universo LOH'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Type Selection (if not chosen yet) */}
        {!selectedType ? (
          <div className="p-6 overflow-y-auto space-y-2">
            {ENTITY_TYPE_LABELS.map(item => (
              <button
                key={item.type}
                onClick={() => handleTypeSelect(item.type)}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 hover:bg-blue-950/20 hover:border-blue-500/40 text-left transition-all group cursor-pointer"
              >
                <div>
                  <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {item.desc}
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-blue-400 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          /* Step 2: Clean, focused form */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
            {!initialEntity && (
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                <span className="text-xs font-mono uppercase text-blue-400">
                  Tipo: {selectedType}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  Alterar tipo
                </button>
              </div>
            )}

            {/* Nome */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Nome *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={selectedType === 'evento' ? 'Ex: Destruição de Ogon' : 'Ex: Scott'}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Data / Período */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Data / Período
              </label>
              <input
                type="text"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder={selectedType === 'evento' ? 'Ex: 200 a.C. ou Era de Ogon' : 'Ex: 105 d.C.'}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Descrição Canônica *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva com precisão este elemento da League Ofter High..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm resize-none leading-relaxed"
              />
            </div>

            {/* Specific fields depending on type */}
            {selectedType === 'personagem' && (
              <>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    Papel / Título
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="Ex: Herdeiro de Avadilla e Líder da Resistência"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Poderes e Habilidades (Digitar ou selecionar da aba Poderes) */}
                <div className="space-y-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-200 font-medium flex items-center gap-1.5 text-xs">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Poderes e Habilidades do Personagem</span>
                    </label>
                    {selectedPowers.length > 0 && (
                      <span className="text-[10px] font-mono text-blue-400">
                        {selectedPowers.length} {selectedPowers.length === 1 ? 'poder selecionado' : 'poderes selecionados'}
                      </span>
                    )}
                  </div>

                  {/* Selected Powers Chips */}
                  {selectedPowers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {selectedPowers.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/70 border border-blue-600/40 text-blue-200 text-xs shadow-sm"
                        >
                          <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>{p}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePower(p)}
                            className="text-blue-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                            title={`Remover ${p}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Campo para digitar novo poder */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPowerInput}
                      onChange={e => setCustomPowerInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomPower();
                        }
                      }}
                      placeholder="Digite um poder e pressione Enter ou clique em +"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPower}
                      disabled={!customPowerInput.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0 ${
                        customPowerInput.trim()
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                          : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed'
                      }`}
                      title="Adicionar poder digitado"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {/* Seleção rápida dos poderes já cadastrados na aba Poderes */}
                  <div className="pt-2 border-t border-zinc-800/70 space-y-1.5">
                    <div className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                      <span>Ou selecione poderes já cadastrados na aba Poderes:</span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {registeredPowers.length} {registeredPowers.length === 1 ? 'disponível' : 'disponíveis'}
                      </span>
                    </div>

                    {registeredPowers.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic py-1">
                        Nenhum poder cadastrado na aba "Poderes" ainda. Você pode digitar os poderes no campo acima ou cadastrar poderes na Memória para reutilizá-los aqui com 1 clique.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-zinc-950/60 rounded-lg border border-zinc-800/60">
                        {registeredPowers.map(powEntity => {
                          const isSelected = selectedPowers.some(
                            p => p.toLowerCase() === powEntity.name.toLowerCase()
                          );
                          return (
                            <button
                              key={powEntity.id}
                              type="button"
                              onClick={() => handleToggleRegisteredPower(powEntity)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-sm border border-blue-400'
                                  : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 hover:text-white'
                              }`}
                              title={powEntity.description}
                            >
                              {isSelected ? (
                                <Check className="w-3 h-3 text-white" />
                              ) : (
                                <Plus className="w-3 h-3 text-zinc-400" />
                              )}
                              <span>{powEntity.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {(selectedType === 'evento' || selectedType === 'personagem') && (
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Participantes / Envolvidos (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={participants}
                  onChange={e => setParticipants(e.target.value)}
                  placeholder="Ex: Scott, Ella, Supremos"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            )}

            {selectedType === 'evento' && (
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Consequências
                </label>
                <input
                  type="text"
                  value={consequences}
                  onChange={e => setConsequences(e.target.value)}
                  placeholder="Ex: Dispersão dos sobreviventes em direção a Valoria"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            )}

            {/* Relacionamentos (Checkboxes from existing memory items) */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Relacionamentos com a Memória
              </label>
              <div className="max-h-28 overflow-y-auto p-2 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1">
                {allEntities.filter(e => !initialEntity || e.id !== initialEntity.id).map(e => {
                  const isChecked = relatedIds.includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/50 cursor-pointer text-xs text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setRelatedIds(relatedIds.filter(id => id !== e.id));
                          } else {
                            setRelatedIds([...relatedIds, e.id]);
                          }
                        }}
                        className="rounded border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>{e.name}</span>
                      <span className="text-zinc-600 capitalize">({e.type})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Status do Cânone */}
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">
                Status no Cânone
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'canon', label: 'Cânone', desc: 'Oficial' },
                  { id: 'proposta', label: 'Proposta', desc: 'Produção' },
                  { id: 'rascunho', label: 'Rascunho', desc: 'Ideia' },
                  { id: 'conflitante', label: 'Conflitante', desc: 'Divergência' },
                  { id: 'antiga', label: 'Antiga', desc: 'Substituída' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id as CanonStatus)}
                    className={`py-2 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      status === opt.id
                        ? 'border-blue-500 bg-blue-950/30 text-white'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-medium text-xs">{opt.label}</div>
                    <div className="text-[10px] text-zinc-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Observações / Notas adicionais */}
            {status === 'conflitante' && (
              <div>
                <label className="block text-amber-300 font-medium mb-1.5">
                  Detalhes da Contradição
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Registro A marca 8 anos pós-Ogon, Registro B marca 110 anos"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-amber-500/40 text-amber-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar na memória</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
