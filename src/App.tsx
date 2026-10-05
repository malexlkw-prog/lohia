import React, { useState, useEffect } from 'react';
import { LoreEntity, ChatMessage, AIMode, ChatSession, MemoryActionRecord, CharacterMilestone } from './types/lore';
import {
  fetchEntitiesFromDatabase,
  getStoredEntitiesLocal,
  saveEntityToDatabase,
  deleteEntityFromDatabase,
  clearDatabaseMemory,
  importDatabaseMemory,
  detectContradictions,
} from './utils/storage';
import {
  loadChatSessions,
  saveChatSession,
  deleteChatSession,
  clearAllChatSessions,
  generateChatTitle,
} from './utils/chatStorage';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { CharactersView } from './components/CharactersView';
import { AddCharacterTrajectoryModal } from './components/AddCharacterTrajectoryModal';
import { MemoryView } from './components/MemoryView';
import { TimelineView } from './components/TimelineView';
import { SettingsView } from './components/SettingsView';
import { EntityDetailModal } from './components/EntityDetailModal';
import { AddEntityModal } from './components/AddEntityModal';
import { ContradictionsModal } from './components/ContradictionsModal';
import { ChatHistoryModal } from './components/ChatHistoryModal';
import { Menu, AlertTriangle, Check, History, Users } from 'lucide-react';

export default function App() {
  const [entities, setEntities] = useState<LoreEntity[]>(() => getStoredEntitiesLocal());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<AIMode>('conhecimento');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat sessions & history state
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `chat-${Date.now()}`);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => loadChatSessions());
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Modals state
  const [selectedEntityForDetail, setSelectedEntityForDetail] = useState<LoreEntity | null>(null);
  const [editingEntity, setEditingEntity] = useState<LoreEntity | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isContradictionsModalOpen, setIsContradictionsModalOpen] = useState(false);

  // Character Trajectory modal state
  const [trajectoryCharacter, setTrajectoryCharacter] = useState<LoreEntity | null>(null);
  const [isTrajectoryModalOpen, setIsTrajectoryModalOpen] = useState(false);

  // Load stored entities from backend database on mount
  useEffect(() => {
    fetchEntitiesFromDatabase().then(loaded => {
      setEntities(loaded);
    });
  }, []);

  // Auto-save active chat session whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.sender === 'user')?.content || '';
      const sessionTitle = generateChatTitle(firstUserMsg);
      const existing = chatSessions.find(s => s.id === currentSessionId);
      const session: ChatSession = {
        id: currentSessionId,
        title: existing?.title && existing.title !== 'Nova conversa' ? existing.title : sessionTitle,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages,
        mode,
      };
      const updated = saveChatSession(session);
      setChatSessions(updated);
    }
  }, [messages, currentSessionId, mode]);

  // Compute live contradictions
  const liveContradictions = detectContradictions(entities);

  // Chat history handlers
  const handleNewChat = () => {
    setCurrentSessionId(`chat-${Date.now()}`);
    setMessages([]);
    setActiveTab('chat');
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    setMode(session.mode || 'conhecimento');
    setActiveTab('chat');
    setIsHistoryModalOpen(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = deleteChatSession(sessionId);
    setChatSessions(updated);
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
  };

  const handleClearAllSessions = () => {
    clearAllChatSessions();
    setChatSessions([]);
    handleNewChat();
  };

  // Lore entity handlers
  const handleSaveEntity = async (entityData: any) => {
    const { updatedEntities, entity } = await saveEntityToDatabase(entityData);
    setEntities([...updatedEntities]);
    setEditingEntity(null);
    setIsAddModalOpen(false);
    setToastMessage('Salvo na memória.');
    setTimeout(() => setToastMessage(null), 3000);

    // If detail modal was open for this entity, refresh it
    if (selectedEntityForDetail && selectedEntityForDetail.id === entity.id) {
      setSelectedEntityForDetail(entity);
    }
  };

  const handleDeleteEntity = async (id: string, name?: string) => {
    // 1. Immediately remove optimistically from UI state
    setEntities(prev =>
      prev.filter(e => {
        const eId = (e.id || '').trim().toLowerCase();
        const eName = (e.name || '').trim().toLowerCase();
        if (id && (eId === id.trim().toLowerCase() || eName === id.trim().toLowerCase())) return false;
        if (name && (eName === name.trim().toLowerCase() || eId === name.trim().toLowerCase())) return false;
        return true;
      })
    );

    // 2. Close detail modal if this entity is open
    setSelectedEntityForDetail(prev => {
      if (!prev) return null;
      const prevId = (prev.id || '').trim().toLowerCase();
      const prevName = (prev.name || '').trim().toLowerCase();
      if (id && (prevId === id.trim().toLowerCase() || prevName === id.trim().toLowerCase())) return null;
      if (name && (prevName === name.trim().toLowerCase() || prevId === name.trim().toLowerCase())) return null;
      return prev;
    });

    // 3. Persist deletion in persistent database and tombstones
    const updated = await deleteEntityFromDatabase(id, name);
    setEntities([...updated]);

    setToastMessage('Registro excluído permanentemente da memória.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingEntity(null);
    setIsAddModalOpen(true);
  };

  const handleOpenTrajectory = (character: LoreEntity) => {
    setTrajectoryCharacter(character);
    setIsTrajectoryModalOpen(true);
  };

  const handleEditEntity = (entity: LoreEntity) => {
    setSelectedEntityForDetail(null);
    setEditingEntity(entity);
    setIsAddModalOpen(true);
  };

  // Execute authorized memory modifications requested by user through AI chat
  const handleApplyMemoryAction = async (action: MemoryActionRecord, messageId: string) => {
    try {
      if (action.type === 'delete' && (action.entityId || action.entityName)) {
        await handleDeleteEntity(action.entityId || '', action.entityName);
      } else if (
        (action.type === 'delete_paragraph' || action.type === 'modify') &&
        (action.entityId || action.entityName)
      ) {
        const target = entities.find(
          e =>
            (action.entityId && e.id === action.entityId) ||
            (action.entityName && e.name.toLowerCase() === action.entityName.toLowerCase()) ||
            (action.entityName && e.name.toLowerCase().includes(action.entityName.toLowerCase()))
        );
        if (target) {
          const updatedPayload: LoreEntity = {
            ...target,
            description: action.newDescription || target.description,
            historyNote: `Alteração autorizada por Marcos no chat: ${action.summary}`,
          };
          await handleSaveEntity(updatedPayload);
        }
      } else if (action.type === 'trajectory' && action.newTrajectory) {
        const target = entities.find(
          e =>
            (action.entityId && e.id === action.entityId) ||
            (action.entityName && e.name.toLowerCase() === action.entityName.toLowerCase()) ||
            (action.entityName && e.name.toLowerCase().includes(action.entityName.toLowerCase()))
        );
        if (target) {
          const currentTrajectory = target.subDetails?.trajectory || [];
          const newMilestone: CharacterMilestone = {
            id: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: action.newTrajectory.date || 'Período a definir',
            title: action.newTrajectory.title || 'Marco na trajetória',
            description: action.newTrajectory.description || '',
            impact: action.newTrajectory.impact,
            createdAt: new Date().toISOString(),
          };
          const updatedPayload: LoreEntity = {
            ...target,
            subDetails: {
              ...target.subDetails,
              trajectory: [...currentTrajectory, newMilestone],
            },
            historyNote: `Novo marco adicionado na trajetória via chat: "${newMilestone.title}"`,
          };
          await handleSaveEntity(updatedPayload);
        }
      } else if (action.addedPower) {
        const target = entities.find(
          e =>
            (action.entityId && e.id === action.entityId) ||
            (action.entityName && e.name.toLowerCase() === action.entityName.toLowerCase())
        );
        if (target) {
          const powers = target.subDetails?.powers || [];
          const updatedPayload: LoreEntity = {
            ...target,
            subDetails: {
              ...target.subDetails,
              powers: Array.from(new Set([...powers, action.addedPower])),
            },
            historyNote: `Poder "${action.addedPower}" adicionado via chat`,
          };
          await handleSaveEntity(updatedPayload);
        }
      }

      // Mark action as applied in message state
      setMessages(prev =>
        prev.map(m => {
          if (m.id === messageId && m.memoryAction) {
            return {
              ...m,
              memoryAction: {
                ...m.memoryAction,
                applied: true,
                rejected: false,
              },
            };
          }
          return m;
        })
      );

      setToastMessage('Alteração autorizada e gravada na memória canônica.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('[App] Failed to apply memory action:', err);
      setToastMessage('Erro ao aplicar alteração na memória.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRejectMemoryAction = (messageId: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === messageId && m.memoryAction) {
          return {
            ...m,
            memoryAction: {
              ...m.memoryAction,
              rejected: true,
              applied: false,
            },
          };
        }
        return m;
      })
    );
    setToastMessage('Alteração recusada. A memória permaneceu intacta.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResolveContradiction = async (
    contradictionId: string,
    chosenVersionText: string,
    entityId: string
  ) => {
    const target = entities.find(e => e.id === entityId);
    if (!target) return;

    // Harmonize the entity directly in the database
    const updatedPayload = {
      id: target.id,
      name: target.name,
      type: target.type,
      status: 'canon' as const,
      period: chosenVersionText,
      description: target.description,
      relatedEntityIds: target.relatedEntityIds,
      subDetails: {
        ...target.subDetails,
        notes: `Cânone definido oficialmente por Marcos: ${chosenVersionText}. Divergência anterior resolvida.`,
      },
    };

    const { updatedEntities } = await saveEntityToDatabase(updatedPayload);
    setEntities([...updatedEntities]);
    setIsContradictionsModalOpen(false);

    // Notify in chat if chat is open
    setMessages(prev => [
      ...prev,
      {
        id: `msg-resolve-${Date.now()}`,
        sender: 'assistant',
        content: `**Decisão de Marcos Registrada no Cânone:**\n\nA divergência sobre **${target.name}** foi resolvida. O registro canônico oficial agora é: **${chosenVersionText}**. A memória da LOH foi atualizada no banco.`,
        timestamp: new Date().toISOString(),
        mode,
      },
    ]);
  };

  const handleImportMemory = async (imported: LoreEntity[]) => {
    const updated = await importDatabaseMemory(imported);
    setEntities(updated);
  };

  const handleClearMemory = async () => {
    const updated = await clearDatabaseMemory();
    setEntities(updated);
    setSelectedEntityForDetail(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#050811] text-zinc-100 overflow-hidden font-sans select-none antialiased">
      {/* Sleek Minimal Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAdd={handleOpenAdd}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        savedChatsCount={chatSessions.length}
        charactersCount={entities.filter(e => e.type === 'personagem').length}
        hasContradictions={liveContradictions.length > 0}
        onOpenContradictions={() => setIsContradictionsModalOpen(true)}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#060913] relative">
        {/* Mobile Top Navigation Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-[#050811] shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-white text-sm">
            <span>LOH AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('personagens')}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
              title="Personagens da LOH"
            >
              <Users className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
              title="Chats anteriores"
            >
              <History className="w-4 h-4 text-purple-400" />
            </button>
            {liveContradictions.length > 0 && (
              <button
                onClick={() => setIsContradictionsModalOpen(true)}
                className="p-1.5 text-amber-400 hover:bg-amber-950/30 rounded cursor-pointer"
                title="Contradições detectadas"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-md cursor-pointer"
            >
              + Adicionar
            </button>
          </div>
        </header>

        {/* View Switcher */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeTab === 'chat' && (
            <ChatView
              entities={entities}
              messages={messages}
              setMessages={setMessages}
              mode={mode}
              setMode={setMode}
              onOpenAdd={handleOpenAdd}
              onOpenMemory={() => setActiveTab('memoria')}
              onOpenTimeline={() => setActiveTab('timeline')}
              onOpenCharacters={() => setActiveTab('personagens')}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onNewChat={handleNewChat}
              savedChatsCount={chatSessions.length}
              onSelectEntity={setSelectedEntityForDetail}
              onResolveConflict={() => setIsContradictionsModalOpen(true)}
              onApplyMemoryAction={handleApplyMemoryAction}
              onRejectMemoryAction={handleRejectMemoryAction}
            />
          )}

          {activeTab === 'personagens' && (
            <CharactersView
              entities={entities}
              onSelectCharacter={setSelectedEntityForDetail}
              onAddNewCharacter={handleOpenAdd}
              onAddTrajectory={handleOpenTrajectory}
              onDeleteCharacter={handleDeleteEntity}
            />
          )}

          {activeTab === 'memoria' && (
            <MemoryView
              entities={entities}
              onSelectEntity={setSelectedEntityForDetail}
              onAddNew={handleOpenAdd}
              onOpenTimeline={() => setActiveTab('timeline')}
              onDeleteEntity={handleDeleteEntity}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineView
              entities={entities}
              onSelectEntity={setSelectedEntityForDetail}
              onAddEvent={handleOpenAdd}
            />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView
              entities={entities}
              onImportMemory={handleImportMemory}
              onClearMemory={handleClearMemory}
            />
          )}
        </div>
      </main>

      {/* Chat History & Previous Chats Modal */}
      <ChatHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        sessions={chatSessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllSessions}
      />

      {/* Entity Detail & Version History Modal */}
      {selectedEntityForDetail && (
        <EntityDetailModal
          entity={selectedEntityForDetail}
          allEntities={entities}
          onClose={() => setSelectedEntityForDetail(null)}
          onEdit={handleEditEntity}
          onDelete={handleDeleteEntity}
          onSelectEntity={setSelectedEntityForDetail}
          onAddTrajectory={handleOpenTrajectory}
          onResolveConflict={() => {
            setSelectedEntityForDetail(null);
            setIsContradictionsModalOpen(true);
          }}
        />
      )}

      {/* Add / Edit Entity Modal */}
      <AddEntityModal
        initialEntity={editingEntity}
        allEntities={entities}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingEntity(null);
        }}
        onSave={handleSaveEntity}
      />

      {/* Add Character Trajectory & Milestones Modal */}
      <AddCharacterTrajectoryModal
        character={trajectoryCharacter}
        isOpen={isTrajectoryModalOpen}
        onClose={() => {
          setIsTrajectoryModalOpen(false);
          setTrajectoryCharacter(null);
        }}
        onSave={async updatedEntity => {
          await handleSaveEntity(updatedEntity);
          if (selectedEntityForDetail && selectedEntityForDetail.id === updatedEntity.id) {
            setSelectedEntityForDetail(updatedEntity);
          }
        }}
      />

      {/* Contradictions Resolution Modal */}
      <ContradictionsModal
        contradictions={liveContradictions}
        isOpen={isContradictionsModalOpen}
        onClose={() => setIsContradictionsModalOpen(false)}
        onResolve={handleResolveContradiction}
        onInspectEntity={entityId => {
          setIsContradictionsModalOpen(false);
          const found = entities.find(e => e.id === entityId);
          if (found) setSelectedEntityForDetail(found);
        }}
      />

      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-950/90 border border-blue-500/50 text-white text-xs font-medium shadow-2xl backdrop-blur animate-fadeIn">
          <Check className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
