import React, { useState } from 'react';
import { ChatSession, AIMode } from '../types/lore';
import {
  History,
  X,
  Search,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  BrainCircuit,
  Clapperboard,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | AIMode>('all');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

  if (!isOpen) return null;

  // Filter sessions by search query and mode
  const filteredSessions = sessions.filter(session => {
    const matchesMode = filterMode === 'all' || session.mode === filterMode;
    if (!matchesMode) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (session.title.toLowerCase().includes(q)) return true;
    return session.messages.some(m => m.content.toLowerCase().includes(q));
  });

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Hoje às ${timeStr}`;
      }
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Ontem às ${timeStr}`;
      }
      return `${date.toLocaleDateString('pt-BR')} ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#090d1a] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Chats Anteriores
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {sessions.length} {sessions.length === 1 ? 'conversa' : 'conversas'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Reveja, continue ou gerencie seus diálogos anteriores com a LOH AI.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewChat();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
              title="Iniciar nova conversa"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova conversa</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 sm:p-4 border-b border-zinc-800/60 bg-zinc-900/20 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por palavras-chave em conversas passadas..."
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mode Pills */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-mono text-zinc-500">Filtrar:</span>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todos ({sessions.length})
            </button>
            <button
              onClick={() => setFilterMode('conhecimento')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                filterMode === 'conhecimento'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Conhecimento</span>
            </button>
            <button
              onClick={() => setFilterMode('assistente')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                filterMode === 'assistente'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BrainCircuit className="w-3 h-3 text-purple-400" />
              <span>Assistente</span>
            </button>
            <button
              onClick={() => setFilterMode('produtor')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                filterMode === 'produtor'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clapperboard className="w-3 h-3 text-amber-400" />
              <span>Produtor</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-300">
                  {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhum chat anterior registrado'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Tente buscar com outros termos ou limpe o filtro.'
                    : 'Suas conversas serão salvas automaticamente aqui para que você possa revê-las e continuá-las a qualquer momento.'}
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={() => {
                    onNewChat();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Começar uma conversa agora</span>
                </button>
              )}
            </div>
          ) : (
            filteredSessions.map(session => {
              const isCurrent = session.id === currentSessionId;
              const isAssistant = session.mode === 'assistente';
              const isProducer = session.mode === 'produtor';
              const lastMsg = session.messages[session.messages.length - 1];
              const lastMsgSnippet = lastMsg ? lastMsg.content.slice(0, 110) : '';

              return (
                <div
                  key={session.id}
                  className={`group relative rounded-xl border transition-all p-3.5 ${
                    isCurrent
                      ? 'bg-blue-950/20 border-blue-500/40 hover:border-blue-500/60'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => {
                        onSelectSession(session);
                        onClose();
                      }}
                      className="flex-1 text-left space-y-1.5 cursor-pointer"
                    >
                      {/* Top Badges & Time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isProducer
                              ? 'bg-amber-900/30 text-amber-300 border border-amber-500/30'
                              : isAssistant
                              ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-900/30 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isProducer ? (
                            <Clapperboard className="w-2.5 h-2.5 text-amber-400" />
                          ) : isAssistant ? (
                            <BrainCircuit className="w-2.5 h-2.5 text-purple-400" />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                          )}
                          <span>{isProducer ? 'Produtor' : isAssistant ? 'Assistente' : 'Conhecimento'}</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-zinc-600" />
                          {formatDate(session.updatedAt)}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          • {session.messages.length} {session.messages.length === 1 ? 'msg' : 'msgs'}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-1.5 py-0.5 rounded">
                            Ativa
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {session.title}
                      </h4>

                      {/* Excerpt */}
                      {lastMsgSnippet && (
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {lastMsgSnippet}...
                        </p>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 pt-1">
                      <button
                        onClick={() => {
                          onSelectSession(session);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Abrir este chat"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {sessionToDelete === session.id ? (
                        <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 p-1 rounded-lg">
                          <button
                            onClick={() => {
                              onDeleteSession(session.id);
                              setSessionToDelete(null);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white font-medium hover:bg-red-500 cursor-pointer"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setSessionToDelete(null)}
                            className="text-[10px] px-1.5 py-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSessionToDelete(session.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Total salvo: <strong className="text-zinc-200">{sessions.length} conversas</strong>
            </span>
            {isConfirmingClearAll ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">Excluir tudo?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setIsConfirmingClearAll(false);
                  }}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium cursor-pointer"
                >
                  Sim, limpar
                </button>
                <button
                  onClick={() => setIsConfirmingClearAll(false)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingClearAll(true)}
                className="text-zinc-500 hover:text-red-400 transition-colors text-[11px] cursor-pointer"
              >
                Limpar histórico completo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
