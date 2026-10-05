import React from 'react';
import { MessageSquare, Users, Database, Calendar, Plus, Settings, X, AlertTriangle, History } from 'lucide-react';

export type ActiveTab = 'chat' | 'personagens' | 'memoria' | 'timeline' | 'configuracoes';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
  onOpenHistory: () => void;
  savedChatsCount?: number;
  charactersCount?: number;
  hasContradictions: boolean;
  onOpenContradictions: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAdd,
  onOpenHistory,
  savedChatsCount = 0,
  charactersCount,
  hasContradictions,
  onOpenContradictions,
  mobileOpen,
  setMobileOpen,
}) => {
  const navItems = [
    { id: 'chat' as ActiveTab, label: 'Chat', icon: MessageSquare, isAction: false },
    { id: 'historico' as const, label: 'Chats anteriores', icon: History, isAction: true },
    { id: 'personagens' as ActiveTab, label: 'Personagens', icon: Users, isAction: false, badge: charactersCount },
    { id: 'memoria' as ActiveTab, label: 'Memória', icon: Database, isAction: false },
    { id: 'timeline' as ActiveTab, label: 'Linha do tempo', icon: Calendar, isAction: false },
  ];

  const handleNavClick = (item: (typeof navItems)[0]) => {
    if (item.isAction && item.id === 'historico') {
      onOpenHistory();
      setMobileOpen(false);
      return;
    }
    setActiveTab(item.id as ActiveTab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#050811] border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-zinc-800/60">
          <button
            onClick={() => {
              setActiveTab('chat');
              setMobileOpen(false);
            }}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm tracking-wider group-hover:border-blue-400 transition-colors">
              LOH
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                LOH AI
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                League Ofter High
              </div>
            </div>
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-zinc-500 hover:text-white lg:hidden rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Middle: Navigation Items */}
        <div className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = !item.isAction && activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/10 border border-blue-500/30 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-blue-400'
                        : item.id === 'historico'
                        ? 'text-purple-400'
                        : 'text-zinc-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.id === 'historico' && savedChatsCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    {savedChatsCount}
                  </span>
                )}
                {item.id === 'personagens' && typeof charactersCount === 'number' && charactersCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-300">
                    {charactersCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* + Adicionar Button in Sidebar */}
          <div className="pt-2">
            <button
              onClick={() => {
                onOpenAdd();
                setMobileOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-950/20 hover:bg-blue-900/30 border border-blue-800/40 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>+ Adicionar</span>
            </button>
          </div>

          {/* Contradictions notice if present */}
          {hasContradictions && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onOpenContradictions();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/20 border border-amber-500/30 hover:bg-amber-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Contradições</span>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                  Pendente
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom: Configurações */}
        <div className="p-3 border-t border-zinc-800/60">
          <button
            onClick={() => {
              setActiveTab('configuracoes');
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'configuracoes'
                ? 'bg-blue-600/10 border border-blue-500/30 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Settings className="w-4 h-4 text-zinc-500" />
            <span>Configurações</span>
          </button>
        </div>
      </aside>
    </>
  );
};
