import React, { useState, useEffect } from 'react';
import { LoreEntity, ChatMessage, Contradiction } from './types/lore';
import {
  fetchEntitiesFromDatabase,
  saveEntityToDatabase,
  deleteEntityFromDatabase,
  clearDatabaseMemory,
  importDatabaseMemory,
  detectContradictions,
} from './utils/storage';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MemoryView } from './components/MemoryView';
import { TimelineView } from './components/TimelineView';
import { SettingsView } from './components/SettingsView';
import { EntityDetailModal } from './components/EntityDetailModal';
import { AddEntityModal } from './components/AddEntityModal';
import { ContradictionsModal } from './components/ContradictionsModal';
import { Menu, AlertTriangle, Check } from 'lucide-react';

export default function App() {
  const [entities, setEntities] = useState<LoreEntity[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [selectedEntityForDetail, setSelectedEntityForDetail] = useState<LoreEntity | null>(null);
  const [editingEntity, setEditingEntity] = useState<LoreEntity | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isContradictionsModalOpen, setIsContradictionsModalOpen] = useState(false);

  // Load stored entities from backend database on mount
  useEffect(() => {
    fetchEntitiesFromDatabase().then(loaded => {
      setEntities(loaded);
    });
  }, []);

  // Compute live contradictions
  const liveContradictions = detectContradictions(entities);

  // Handlers
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

  const handleDeleteEntity = async (id: string) => {
    const updated = await deleteEntityFromDatabase(id);
    setEntities([...updated]);
    if (selectedEntityForDetail && selectedEntityForDetail.id === id) {
      setSelectedEntityForDetail(null);
    }
  };

  const handleOpenAdd = () => {
    setEditingEntity(null);
    setIsAddModalOpen(true);
  };

  const handleEditEntity = (entity: LoreEntity) => {
    setSelectedEntityForDetail(null);
    setEditingEntity(entity);
    setIsAddModalOpen(true);
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
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 font-bold tracking-tight text-white text-sm">
            <span>LOH AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>

          <div className="flex items-center gap-2">
            {liveContradictions.length > 0 && (
              <button
                onClick={() => setIsContradictionsModalOpen(true)}
                className="p-1.5 text-amber-400 hover:bg-amber-950/30 rounded"
                title="Contradições detectadas"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-md"
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
              onOpenAdd={handleOpenAdd}
              onOpenMemory={() => setActiveTab('memoria')}
              onOpenTimeline={() => setActiveTab('timeline')}
              onSelectEntity={setSelectedEntityForDetail}
              onResolveConflict={() => setIsContradictionsModalOpen(true)}
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

      {/* Entity Detail & Version History Modal */}
      {selectedEntityForDetail && (
        <EntityDetailModal
          entity={selectedEntityForDetail}
          allEntities={entities}
          onClose={() => setSelectedEntityForDetail(null)}
          onEdit={handleEditEntity}
          onDelete={handleDeleteEntity}
          onSelectEntity={setSelectedEntityForDetail}
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
