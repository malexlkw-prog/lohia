import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LoreEntity, Contradiction, AIMode, MemoryActionRecord } from '../types/lore';
import {
  Send,
  Plus,
  Database,
  Calendar,
  AlertTriangle,
  ArrowUp,
  Sparkles,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  BookOpen,
  BrainCircuit,
  Clapperboard,
  History,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ChatViewProps {
  entities: LoreEntity[];
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  mode: AIMode;
  setMode: (mode: AIMode) => void;
  onOpenAdd: () => void;
  onOpenMemory: () => void;
  onOpenTimeline: () => void;
  onOpenCharacters?: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
  savedChatsCount?: number;
  onSelectEntity: (entity: LoreEntity) => void;
  onResolveConflict: (conflict: Contradiction) => void;
  onApplyMemoryAction?: (action: MemoryActionRecord, messageId: string) => Promise<void>;
  onRejectMemoryAction?: (messageId: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  entities,
  messages,
  setMessages,
  mode,
  setMode,
  onOpenAdd,
  onOpenMemory,
  onOpenTimeline,
  onOpenCharacters,
  onOpenHistory,
  onNewChat,
  savedChatsCount = 0,
  onSelectEntity,
  onResolveConflict,
  onApplyMemoryAction,
  onRejectMemoryAction,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPreviewMsgId, setExpandedPreviewMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      mode,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Call backend server endpoint with message and selected mode
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory: messages.slice(-5),
          mode,
        }),
      });

      const data = await response.json();

      // Check if Gemini failed or is unavailable
      if (!response.ok || data.success === false) {
        const errorReply = data.reply || 'Não consegui responder agora. Tente novamente em alguns segundos.';
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          content: errorReply,
          timestamp: new Date().toISOString(),
          isConnectionError: true,
          lastFailedQuery: query,
          mode,
        };
        setMessages(prev => [...prev, assistantMsg]);
        return;
      }

      const replyContent = data.reply || 'Essa informação ainda não está cadastrada na memória da LOH.';
      const referencedEntityIds: string[] = data.referencedEntityIds || [];

      // Check if any referenced entity has a conflict
      const conflictingEntity = entities.find(
        e => referencedEntityIds.includes(e.id) && e.status === 'conflitante'
      );

      let contradictionWarning: Contradiction | undefined = undefined;
      if (conflictingEntity) {
        contradictionWarning = {
          id: `conflict-${conflictingEntity.id}`,
          title: `Contradição em: ${conflictingEntity.name}`,
          entityId: conflictingEntity.id,
          entityName: conflictingEntity.name,
          details: conflictingEntity.subDetails?.notes || 'Existem registros divergentes para este item na memória.',
          versionA: 'Registro A',
          versionB: 'Registro B',
          resolved: false,
        };
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: replyContent,
        timestamp: new Date().toISOString(),
        referencedEntityIds,
        contradictionWarning,
        memoryAction: data.memoryAction,
        mode: data.mode || mode,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[Chat communication error]', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: 'Não consegui responder agora. Tente novamente em alguns segundos.',
        timestamp: new Date().toISOString(),
        isConnectionError: true,
        lastFailedQuery: query,
        mode,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const isInitialState = messages.length === 0;

  // Clean formatting for assistant responses
  const renderFormattedMessage = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 leading-relaxed text-sm">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          // Bullet point lists
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const listText = trimmed.replace(/^[*•-]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-400 mt-1 select-none text-xs">•</span>
                <span
                  className="flex-1"
                  dangerouslySetInnerHTML={{ __html: formatInline(listText) }}
                />
              </div>
            );
          }

          // Numbered lists
          if (/^\d+\.\s/.test(trimmed)) {
            const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
            if (numberMatch) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-1">
                  <span className="text-blue-400 font-mono text-xs mt-0.5">
                    {numberMatch[1]}.
                  </span>
                  <span
                    className="flex-1"
                    dangerouslySetInnerHTML={{ __html: formatInline(numberMatch[2]) }}
                  />
                </div>
              );
            }
          }

          // Section Headers
          if (trimmed.startsWith('### ')) {
            return (
              <h4
                key={idx}
                className="text-white font-bold text-sm pt-2 pb-1 border-b border-zinc-800/60"
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace('### ', '')) }}
              />
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3
                key={idx}
                className="text-white font-bold text-base pt-3 pb-1"
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace('## ', '')) }}
              />
            );
          }

          // Suggestions / Disclaimers
          if (trimmed.includes('[SUGESTÃO]') || trimmed.includes('[SUGESTÃO CRIATIVA]')) {
            return (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 text-purple-200 text-xs my-2 flex items-start gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-zinc-200"
              dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
            />
          );
        })}
      </div>
    );
  };

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-zinc-300">$1</em>');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#060913]">
      {/* INITIAL CLEAN HOME VIEW (Prior to messages) */}
      {isInitialState ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl mx-auto w-full text-center space-y-6 animate-fadeIn">
          {/* Central Minimal Branding */}
          <div className="space-y-1.5">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              LOH AI
              <span className={`w-2.5 h-2.5 rounded-full ${
                mode === 'produtor'
                  ? 'bg-amber-500'
                  : mode === 'assistente'
                  ? 'bg-purple-500'
                  : 'bg-blue-500'
              } animate-pulse`} />
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 font-light">
              A inteligência da League Ofter High.
            </p>
          </div>

          {/* Simple Discrete Mode Selector */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs gap-1">
              <button
                type="button"
                onClick={() => setMode('conhecimento')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  mode === 'conhecimento'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Conhecimento</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('assistente')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  mode === 'assistente'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Assistente</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('produtor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  mode === 'produtor'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>Produtor</span>
              </button>
            </div>
            <span className="text-[11px] text-zinc-500">
              {mode === 'conhecimento'
                ? 'Responde e explica usando o conhecimento da LOH.'
                : mode === 'assistente'
                ? 'Analisa cânon, continuidade, combate e cria histórias.'
                : 'Desenvolve filmes, séries, episódios e projetos audiovisuais com rigor canônico.'}
            </span>
          </div>

          {/* Large Prompt Input Box */}
          <div className="w-full relative shadow-2xl rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-blue-500/40 focus-within:border-blue-500/50 transition-colors p-3 sm:p-4">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'produtor'
                  ? 'Quero criar uma nova web série, filme, temporada, episódio...'
                  : mode === 'assistente'
                  ? 'Pergunte sobre novas histórias, continuidade, quem ganha a luta...'
                  : 'Pergunte qualquer coisa sobre a LOH...'
              }
              className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-base resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1">
              <span className="text-[11px] font-mono text-zinc-600">
                {mode === 'produtor'
                  ? 'Modo Produtor Audiovisual ativado'
                  : mode === 'assistente'
                  ? 'Modo Assistente de Criação ativado'
                  : 'Pressione Enter para consultar o cânone'}
              </span>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  input.trim()
                    ? mode === 'produtor'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                      : mode === 'assistente'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                    : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed'
                }`}
                title="Enviar pergunta"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Shortcuts: + Adicionar, Personagens, Memória, Linha do tempo, Chats anteriores */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs">
            <button
              onClick={onOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>+ Adicionar</span>
            </button>
            {onOpenCharacters && (
              <button
                onClick={onOpenCharacters}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-950/30 border border-blue-800/40 text-blue-300 hover:text-white hover:border-blue-700 hover:bg-blue-900/40 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Personagens</span>
              </button>
            )}
            <button
              onClick={onOpenMemory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Memória</span>
            </button>
            <button
              onClick={onOpenTimeline}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Linha do tempo</span>
            </button>
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Chats anteriores</span>
              {savedChatsCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {savedChatsCount}
                </span>
              )}
            </button>
          </div>

          {/* Prompt suggestion ideas depending on mode */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-lg">
            {(mode === 'produtor'
              ? [
                  'Quero criar uma nova web série.',
                  'Quero fazer um filme sobre O Senhor.',
                  'Como estruturar uma 1ª temporada sobre a separação dos mundos?',
                  'Essa ideia de série em Ogon cria conflito com produções anteriores?',
                ]
              : mode === 'assistente'
              ? [
                  'Quero fazer uma história durante a Guerra de Ogon com o personagem X',
                  'Fulano vs Fulano, quem ganha?',
                  'Quero criar uma história sobre uma equipe de jovens contra uma organização',
                  'Essa ideia que tive gera algum conflito de continuidade?',
                ]
              : [
                  'Quem é O Senhor?',
                  'O que foi A Criação?',
                  'Como surgiram os demônios?',
                  'Por que a criação foi dividida em mundos?',
                ]
            ).map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-900 text-left cursor-pointer"
              >
                "{sug}"
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ACTIVE CONVERSATION VIEW */
        <div className="flex-1 flex flex-col h-full max-w-3xl mx-auto w-full overflow-hidden">
          {/* Active Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-[#060913]/90 backdrop-blur shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">LOH AI</span>
              <span className="text-zinc-600 text-xs">•</span>
              {/* Discrete Mode Switcher in Header */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setMode('conhecimento')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    mode === 'conhecimento'
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Modo Conhecimento"
                >
                  Conhecimento
                </button>
                <button
                  type="button"
                  onClick={() => setMode('assistente')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    mode === 'assistente'
                      ? 'bg-purple-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Modo Assistente"
                >
                  Assistente
                </button>
                <button
                  type="button"
                  onClick={() => setMode('produtor')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    mode === 'produtor'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Modo Produtor"
                >
                  Produtor
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenHistory}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-zinc-800/60 transition-colors border border-transparent hover:border-zinc-800 cursor-pointer"
                title="Rever chats anteriores"
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Chats anteriores</span>
                {savedChatsCount > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                    {savedChatsCount}
                  </span>
                )}
              </button>
              <button
                onClick={onNewChat}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
                title="Nova conversa"
              >
                <RefreshCw className="w-3 h-3 text-zinc-400" />
                <span>Nova conversa</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              const isConnectionError = msg.isConnectionError || msg.content.includes('Não consegui responder agora');
              const referencedEntities = (msg.referencedEntityIds || [])
                .map(id => entities.find(e => e.id === id))
                .filter(Boolean) as LoreEntity[];
              const isAssistantMsg = msg.mode === 'assistente';
              const isProducerMsg = msg.mode === 'produtor';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                        : isConnectionError
                        ? 'bg-zinc-900/90 border border-zinc-800 text-zinc-300 rounded-tl-sm shadow-sm'
                        : 'bg-zinc-900/70 border border-zinc-800/80 text-zinc-200 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {!isUser && (
                      <div className={`flex items-center justify-between text-[11px] font-mono mb-2 ${
                        isProducerMsg ? 'text-amber-400' : isAssistantMsg ? 'text-purple-400' : 'text-blue-400'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {isProducerMsg ? (
                            <Clapperboard className="w-3 h-3 text-amber-400" />
                          ) : isAssistantMsg ? (
                            <BrainCircuit className="w-3 h-3 text-purple-400" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-blue-400" />
                          )}
                          <span>
                            LOH AI {isProducerMsg ? '• Produtor' : isAssistantMsg ? '• Assistente' : '• Conhecimento'}
                          </span>
                        </div>
                        {isConnectionError && (
                          <div className="flex items-center gap-1 text-zinc-400 text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Memória salva</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isUser ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      renderFormattedMessage(msg.content)
                    )}

                    {/* Friendly retry action if connection failed */}
                    {isConnectionError && msg.lastFailedQuery && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">
                          Sua memória continua intacta.
                        </span>
                        <button
                          onClick={() => handleSend(msg.lastFailedQuery)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-blue-400" />
                          <span>Tentar novamente</span>
                        </button>
                      </div>
                    )}

                    {/* Contradiction Warning Button if detected */}
                    {msg.contradictionWarning && !isConnectionError && (
                      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                        <div className="text-xs text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Contradição pendente no cânone</span>
                        </div>
                        <button
                          onClick={() => onResolveConflict(msg.contradictionWarning!)}
                          className="text-xs font-medium text-amber-400 hover:text-amber-200 underline cursor-pointer"
                        >
                          Definir Cânone
                        </button>
                      </div>
                    )}

                    {/* Memory Action Authorization Card if proposed/analyzed by AI */}
                    {msg.memoryAction && !isConnectionError && (
                      <div className={`mt-4 pt-3.5 border-t ${
                        msg.memoryAction.type === 'delete_paragraph' || msg.memoryAction.type === 'delete'
                          ? 'border-red-500/30 bg-red-950/20'
                          : msg.memoryAction.type === 'trajectory'
                          ? 'border-blue-500/30 bg-blue-950/20'
                          : 'border-purple-500/30 bg-purple-950/20'
                      } -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 rounded-b-2xl space-y-3`}>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-semibold text-white">
                              Permissão Solicitada para a Memória da LOH
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            msg.memoryAction.type === 'delete_paragraph' || msg.memoryAction.type === 'delete'
                              ? 'text-red-400 border-red-500/40 bg-red-950/50'
                              : msg.memoryAction.type === 'trajectory'
                              ? 'text-blue-400 border-blue-500/40 bg-blue-950/50'
                              : 'text-purple-400 border-purple-500/40 bg-purple-950/50'
                          }`}>
                            {msg.memoryAction.type === 'delete_paragraph'
                              ? 'Exclusão de Trecho'
                              : msg.memoryAction.type === 'delete'
                              ? 'Excluir Registro'
                              : msg.memoryAction.type === 'trajectory'
                              ? 'Novo Marco na Trajetória'
                              : 'Alteração Canônica'}
                          </span>
                        </div>

                        {/* Target Entity & Summary */}
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <span className="text-zinc-400">Registro na memória:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const found = entities.find(
                                  e =>
                                    e.id === msg.memoryAction?.entityId ||
                                    e.name.toLowerCase() === msg.memoryAction?.entityName.toLowerCase()
                                );
                                if (found) onSelectEntity(found);
                              }}
                              className="font-bold text-white hover:text-blue-300 underline cursor-pointer"
                            >
                              {msg.memoryAction.entityName}
                            </button>
                          </div>
                          <p className="text-zinc-200 font-medium leading-relaxed">
                            {msg.memoryAction.summary}
                          </p>
                        </div>

                        {/* Target snippet to delete or modify */}
                        {msg.memoryAction.targetSnippet && (
                          <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-xs space-y-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 block font-semibold">
                              {msg.memoryAction.type === 'delete_paragraph'
                                ? 'Trecho exato a ser removido:'
                                : 'Trecho substituído:'}
                            </span>
                            <p className="text-red-200 line-through leading-relaxed italic">
                              "{msg.memoryAction.targetSnippet}"
                            </p>
                          </div>
                        )}

                        {/* Trajectory milestone details if applicable */}
                        {msg.memoryAction.newTrajectory && (
                          <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/40 text-xs space-y-1">
                            <div className="flex items-center justify-between text-blue-300 font-medium">
                              <span>{msg.memoryAction.newTrajectory.title}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60">
                                {msg.memoryAction.newTrajectory.date}
                              </span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {msg.memoryAction.newTrajectory.description}
                            </p>
                            {msg.memoryAction.newTrajectory.impact && (
                              <div className="text-[10px] text-zinc-400">
                                <span className="text-amber-400 font-semibold">Impacto:</span>{' '}
                                {msg.memoryAction.newTrajectory.impact}
                              </div>
                            )}
                          </div>
                        )}

                        {/* New description preview toggle if available */}
                        {msg.memoryAction.newDescription && (
                          <div className="space-y-1 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPreviewMsgId(
                                  expandedPreviewMsgId === msg.id ? null : msg.id
                                )
                              }
                              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <span>
                                {expandedPreviewMsgId === msg.id
                                  ? 'Ocultar prévia da descrição resultante'
                                  : 'Ver como ficará a descrição completa na memória'}
                              </span>
                              {expandedPreviewMsgId === msg.id ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            {expandedPreviewMsgId === msg.id && (
                              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 max-h-48 overflow-y-auto whitespace-pre-line leading-relaxed">
                                {msg.memoryAction.newDescription}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action buttons state */}
                        {msg.memoryAction.applied ? (
                          <div className="flex items-center justify-between pt-1 text-xs text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/30">
                            <div className="flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="font-medium">
                                Alteração autorizada e aplicada na memória canônica com sucesso!
                              </span>
                            </div>
                          </div>
                        ) : msg.memoryAction.rejected ? (
                          <div className="pt-1 text-xs text-zinc-500 italic bg-zinc-900/60 p-2 rounded-lg">
                            Alteração recusada por Marcos. Nenhuma modificação foi feita na memória.
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                            <span className="text-[11px] text-zinc-400 italic">
                              Aguardando sua autorização:
                            </span>
                            <div className="flex items-center gap-2">
                              {onRejectMemoryAction && (
                                <button
                                  type="button"
                                  onClick={() => onRejectMemoryAction(msg.id)}
                                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs transition-colors cursor-pointer"
                                >
                                  Recusar
                                </button>
                              )}
                              {onApplyMemoryAction && (
                                <button
                                  type="button"
                                  onClick={() => onApplyMemoryAction(msg.memoryAction!, msg.id)}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Autorizar e Aplicar na Memória</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connected Memory Chips (Discreet lore shortcuts) */}
                  {!isUser && !isConnectionError && referencedEntities.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-2 max-w-[88%] sm:max-w-[80%]">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">
                        Registros citados:
                      </span>
                      {referencedEntities.map(ent => (
                        <button
                          key={ent.id}
                          onClick={() => onSelectEntity(ent)}
                          className="text-[11px] text-zinc-400 hover:text-blue-400 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          {ent.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start">
                <div className="bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-xs text-zinc-400">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    mode === 'produtor'
                      ? 'bg-amber-500'
                      : mode === 'assistente'
                      ? 'bg-purple-500'
                      : 'bg-blue-500'
                  } animate-ping`} />
                  <span>
                    {mode === 'produtor'
                      ? 'Produtor analisando franquia, cronologia e cruzando produções...'
                      : mode === 'assistente'
                      ? 'Assistente analisando continuidade e cruzando lore...'
                      : 'Consultando a memória canônica da LOH...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Input Bar */}
          <div className="p-4 border-t border-zinc-800/60 bg-[#060913] shrink-0">
            {/* Discreet Mode Indicator / Quick switch */}
            <div className="flex items-center justify-between mb-1.5 px-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span className="font-mono text-zinc-600">Modo:</span>
                <button
                  type="button"
                  onClick={() => setMode('conhecimento')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    mode === 'conhecimento'
                      ? 'text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Conhecimento
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={() => setMode('assistente')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    mode === 'assistente'
                      ? 'text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Assistente
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={() => setMode('produtor')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    mode === 'produtor'
                      ? 'text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Produtor
                </button>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {mode === 'produtor'
                  ? 'Showrunner & Franquia'
                  : mode === 'assistente'
                  ? 'Crítica e Continuidade'
                  : 'Consulta Canônica'}
              </span>
            </div>

            <div className="relative rounded-xl bg-zinc-900/70 border border-zinc-800 focus-within:border-blue-500/50 transition-colors p-2.5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'produtor'
                    ? 'Quero criar uma nova web série, filme, temporada, episódio...'
                    : mode === 'assistente'
                    ? 'Pergunte sobre novas histórias, continuidade, lutas...'
                    : 'Pergunte qualquer coisa sobre a LOH...'
                }
                className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm resize-none pr-10 pl-2 leading-relaxed"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                  input.trim() && !isLoading
                    ? mode === 'produtor'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : mode === 'assistente'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'text-zinc-600 cursor-not-allowed'
                }`}
                title="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
