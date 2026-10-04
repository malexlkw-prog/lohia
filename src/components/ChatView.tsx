import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LoreEntity, Contradiction } from '../types/lore';
import { Send, Plus, Database, Calendar, AlertTriangle, ArrowUp, Sparkles, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

interface ChatViewProps {
  entities: LoreEntity[];
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onOpenAdd: () => void;
  onOpenMemory: () => void;
  onOpenTimeline: () => void;
  onSelectEntity: (entity: LoreEntity) => void;
  onResolveConflict: (conflict: Contradiction) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  entities,
  messages,
  setMessages,
  onOpenAdd,
  onOpenMemory,
  onOpenTimeline,
  onSelectEntity,
  onResolveConflict,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Call backend server endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory: messages.slice(-5),
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
          versionA: '8 anos após a Destruição de Ogon (-192 a.C.)',
          versionB: '110 anos após a Destruição de Ogon (-90 a.C.)',
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
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[Chat communication error]', err);
      // Clean, friendly message with NO technical API details
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: 'Não consegui responder agora. Tente novamente em alguns segundos.',
        timestamp: new Date().toISOString(),
        isConnectionError: true,
        lastFailedQuery: query,
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

          // Bullet points
          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const bulletText = trimmed.replace(/^[\s•\-\*]+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-400 select-none mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(bulletText) }} />
              </div>
            );
          }

          // Warning / contradiction lines
          if (trimmed.includes('⚠') || trimmed.toLowerCase().includes('informações conflitantes')) {
            return (
              <div key={idx} className="p-3 my-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
              </div>
            );
          }

          // Suggestions warning (when explicit suggestion is asked)
          if (trimmed.toLowerCase().includes('isso é uma sugestão, não faz parte do cânone')) {
            return (
              <div key={idx} className="p-2.5 my-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs italic">
                <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
              </div>
            );
          }

          // Standard paragraph
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
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
        <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl mx-auto w-full text-center space-y-8 animate-fadeIn">
          {/* Central Minimal Branding */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              LOH AI
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 font-light">
              A inteligência da League Ofter High.
            </p>
          </div>

          {/* Large Prompt Input Box */}
          <div className="w-full relative shadow-2xl rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-blue-500/40 transition-colors p-3 sm:p-4">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte qualquer coisa sobre a LOH..."
              className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-base resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1">
              <span className="text-[11px] font-mono text-zinc-600">
                Pressione Enter para consultar o cânone
              </span>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={`p-2 rounded-xl transition-all ${
                  input.trim()
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                    : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed'
                }`}
                title="Enviar pergunta"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Exactly 3 Small Shortcuts as requested */}
          <div className="flex items-center justify-center gap-3 text-xs">
            <button
              onClick={onOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>+ Adicionar</span>
            </button>

            <button
              onClick={onOpenMemory}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Memória</span>
            </button>

            <button
              onClick={onOpenTimeline}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Linha do tempo</span>
            </button>
          </div>

          {/* Discreet prompt suggestion ideas */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 max-w-lg">
            {[
              'Quem é Scott?',
              'O que foi a Destruição de Ogon?',
              'Existe alguma contradição na história de Star Girl?',
              'Mostre tudo sobre os Hikaris',
            ].map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-900"
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
              <span className="text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-400">Consulta Canônica</span>
            </div>
            <button
              onClick={() => setMessages([])}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              title="Nova conversa"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Nova conversa</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              const isConnectionError = msg.isConnectionError || msg.content.includes('Não consegui responder agora');
              const referencedEntities = (msg.referencedEntityIds || [])
                .map(id => entities.find(e => e.id === id))
                .filter(Boolean) as LoreEntity[];

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
                      <div className="flex items-center justify-between text-[11px] font-mono text-blue-400 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          <span>LOH AI</span>
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
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium transition-colors"
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
                          className="text-xs font-medium text-amber-400 hover:text-amber-200 underline"
                        >
                          Definir Cânone
                        </button>
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
                          className="text-[11px] text-zinc-400 hover:text-blue-400 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 px-2 py-0.5 rounded transition-colors"
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
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  <span>Consultando a memória canônica da LOH...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Input Bar */}
          <div className="p-4 border-t border-zinc-800/60 bg-[#060913] shrink-0">
            <div className="relative rounded-xl bg-zinc-900/70 border border-zinc-800 focus-within:border-blue-500/50 transition-colors p-2.5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte qualquer coisa sobre a LOH..."
                className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm resize-none pr-10 pl-2 leading-relaxed"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                  input.trim() && !isLoading
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'text-zinc-600 cursor-not-allowed'
                }`}
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
