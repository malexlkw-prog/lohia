import { ChatSession } from '../types/lore';

const STORAGE_KEY = 'loh_chat_sessions_v1';

/**
 * Loads all saved chat sessions from localStorage, sorted by most recent
 */
export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.error('[loadChatSessions error]', err);
    return [];
  }
}

/**
 * Saves or updates a chat session in localStorage
 */
export function saveChatSession(session: ChatSession): ChatSession[] {
  try {
    const sessions = loadChatSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = {
        ...session,
        updatedAt: new Date().toISOString(),
      };
    } else {
      sessions.unshift({
        ...session,
        createdAt: session.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    // Keep up to 100 previous sessions
    const trimmed = sessions.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error('[saveChatSession error]', err);
    return loadChatSessions();
  }
}

/**
 * Deletes a chat session from localStorage
 */
export function deleteChatSession(sessionId: string): ChatSession[] {
  try {
    const sessions = loadChatSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('[deleteChatSession error]', err);
    return loadChatSessions();
  }
}

/**
 * Clears all previous chat sessions
 */
export function clearAllChatSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[clearAllChatSessions error]', err);
  }
}

/**
 * Automatically creates a concise, human-friendly title from the first prompt
 */
export function generateChatTitle(firstMessage: string): string {
  if (!firstMessage) return 'Nova conversa';
  const clean = firstMessage
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(gostaria de saber sobre|quero saber sobre|me fale sobre|me explique|quem é|o que é|como foi)\s+/i, '')
    .trim();
  if (!clean) return 'Conversa LOH';
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return capitalized.length > 48 ? capitalized.slice(0, 45) + '...' : capitalized;
}
