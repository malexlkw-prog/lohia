import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { SEED_LORE_ENTITIES } from './src/data/seedLore.ts';
import type { LoreEntity } from './src/types/lore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Configurable model name via environment variable
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Persistent Database File for LOH Memory
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'loh_memory.json');

// Ensure data directory and database file exist
function initDatabase(): LoreEntity[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, '[]', 'utf-8');
      return [];
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      fs.writeFileSync(DB_FILE, '[]', 'utf-8');
      return [];
    }
    return parsed;
  } catch (err) {
    console.error('[Database Init Error]', err);
    return [];
  }
}

function readDatabase(): LoreEntity[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return initDatabase();
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Database Read Error]', err);
    return [];
  }
}

function writeDatabase(entities: LoreEntity[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(entities, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database Write Error]', err);
    throw err;
  }
}

// Initial DB check
initDatabase();

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SYSTEM_INSTRUCTION = `
Você é a **LOH AI**, a inteligência artificial oficial do universo League Ofter High (LOH), criado por Marcos.

SUA MISSÃO:
Conhecer, organizar, consultar e ajudar Marcos a reger todo o universo da League Ofter High, respondendo com base estrita na memória canônica fornecida.

REGRAS RÍGIDAS DE CÂNONE E CONDUTA:
1. PRIORIDADE DO CÂNONE:
   - 1º Cânone atual (informações com status 'canon')
   - 2º Informações relacionadas ao cânone
   - 3º Rascunhos (status 'rascunho'), SOMENTE quando Marcos perguntar expressamente por ideias ou rascunhos.
   - 4º Histórico antigo (versões antigas), SOMENTE quando Marcos solicitar histórico.
   - NUNCA trate informação antiga ou rascunho como cânone atual.

2. NUNCA INVENTAR:
   - Se a memória da LOH não tiver uma informação solicitada, responda exatamente:
     "Essa informação ainda não está cadastrada na memória da LOH."
   - Você pode sugerir uma possibilidade SOMENTE se o usuário expressamente pedir uma ideia ou sugestão criativa. Nesse caso, identifique com total clareza antes do texto:
     "Isso é uma sugestão, não faz parte do cânone."

3. CONTRADIÇÕES:
   - Se existirem duas informações conflitantes na memória (por exemplo, na cronologia ou entre versões), aponte claramente:
     "Encontrei informações conflitantes na memória."
   - Mostre as duas versões de forma clara e imparcial.
   - NUNCA escolha automaticamente uma delas. Somente Marcos (o criador) pode definir qual versão será o cânone oficial.

4. ESTRUTURA E ESTILO:
   - Respostas objetivas, organizadas e elegantes.
   - Evite blocos gigantes e verborragia desnecessária. Use tópicos pontuais e citações limpas aos relacionamentos.
`;

/**
 * Intelligent Retrieval Engine:
 * Searches the memory database for entities strictly relevant to the question.
 */
function retrieveRelevantMemory(query: string, entities: LoreEntity[], limit = 6): LoreEntity[] {
  const q = query.toLowerCase().trim();
  const queryTokens = q.split(/\s+/).filter(t => t.length > 2);

  const scored = entities.map(entity => {
    let score = 0;
    const nameLower = entity.name.toLowerCase();
    const descLower = entity.description.toLowerCase();
    const periodLower = (entity.period || '').toLowerCase();

    // Exact name match
    if (q.includes(nameLower) || nameLower.includes(q)) {
      score += 20;
    }

    // Token matching in name
    for (const token of queryTokens) {
      if (nameLower.includes(token)) score += 8;
      if (descLower.includes(token)) score += 2;
      if (periodLower.includes(token)) score += 3;
    }

    // Role / alias / subDetails matching
    if (entity.subDetails) {
      const roleLower = (entity.subDetails.role || '').toLowerCase();
      if (queryTokens.some(t => roleLower.includes(t))) score += 4;

      if (entity.subDetails.participants) {
        for (const p of entity.subDetails.participants) {
          if (q.includes(p.toLowerCase())) score += 5;
        }
      }

      if (entity.subDetails.locations) {
        for (const loc of entity.subDetails.locations) {
          if (q.includes(loc.toLowerCase())) score += 4;
        }
      }
    }

    // Status weighting: Canon gets top priority, unless querying contradictions
    if (entity.status === 'canon') {
      score += 3;
    } else if (entity.status === 'conflitante' && (q.includes('contradição') || q.includes('conflito') || q.includes('divergência'))) {
      score += 15;
    }

    return { entity, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topEntities = scored.filter(s => s.score > 0).slice(0, limit).map(s => s.entity);

  if (topEntities.length === 0) {
    return [];
  }

  // Include direct relational graph neighbors
  const relatedIds = new Set<string>();
  topEntities.forEach(ent => ent.relatedEntityIds?.forEach(id => relatedIds.add(id)));

  const finalMap = new Map<string, LoreEntity>();
  topEntities.forEach(e => finalMap.set(e.id, e));

  for (const id of relatedIds) {
    if (finalMap.size >= limit + 2) break;
    const found = entities.find(e => e.id === id);
    if (found) finalMap.set(found.id, found);
  }

  return Array.from(finalMap.values());
}

/**
 * Robust call to Gemini with retry backoff for transient 503 / high demand spikes
 */
async function callGeminiWithRetry(prompt: string, maxRetries = 3) {
  if (!ai) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errStr = (err?.message || String(err)).toLowerCase();
      const isRetryable =
        errStr.includes('503') ||
        errStr.includes('unavailable') ||
        errStr.includes('high demand') ||
        errStr.includes('overloaded') ||
        errStr.includes('resource_exhausted') ||
        errStr.includes('timeout');

      if (isRetryable && attempt < maxRetries) {
        const delayMs = attempt * 1200; // 1.2s, 2.4s
        console.warn(`[Gemini Retry Log] Model ${MODEL_NAME} transient issue. Attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

// ==================== MEMORY DATABASE ENDPOINTS ====================
// Completely independent of Gemini API

// GET /api/memory - List all stored memory entities
app.get('/api/memory', (req, res) => {
  try {
    const entities = readDatabase();
    res.json({ success: true, count: entities.length, data: entities });
  } catch (err: any) {
    console.error('[GET /api/memory error]', err);
    res.status(500).json({ success: false, error: 'Erro ao carregar banco de dados de memória.' });
  }
});

// POST /api/memory - Create or update an entity immediately in the database
app.post('/api/memory', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name || !payload.type) {
      return res.status(400).json({ success: false, error: 'Dados incompletos para cadastro.' });
    }

    const entities = readDatabase();
    const now = new Date().toISOString();

    let savedEntity: LoreEntity;

    if (payload.id) {
      // Update existing entity
      const idx = entities.findIndex(e => e.id === payload.id);
      if (idx >= 0) {
        const existing = entities[idx];
        const newHistory = {
          id: `v-${Date.now()}`,
          timestamp: now,
          note: `Atualização de ${existing.name}`,
          previousData: {
            description: existing.description,
            period: existing.period,
            status: existing.status,
            subDetails: existing.subDetails,
          },
        };

        savedEntity = {
          ...existing,
          ...payload,
          id: existing.id,
          updatedAt: now,
          history: [newHistory, ...(existing.history || [])],
        };
        entities[idx] = savedEntity;
      } else {
        // ID provided but not found, create new
        savedEntity = {
          ...payload,
          id: payload.id,
          createdAt: now,
          updatedAt: now,
          history: [],
        };
        entities.unshift(savedEntity);
      }
    } else {
      // Create new entity
      const newId = `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      savedEntity = {
        ...payload,
        id: newId,
        createdAt: now,
        updatedAt: now,
        history: [],
      };
      entities.unshift(savedEntity);
    }

    writeDatabase(entities);
    console.log(`[Memory DB] Saved entity "${savedEntity.name}" (${savedEntity.type}) to database.`);

    res.json({
      success: true,
      message: 'Salvo na memória.',
      entity: savedEntity,
      count: entities.length,
    });
  } catch (err: any) {
    console.error('[POST /api/memory error]', err);
    res.status(500).json({ success: false, error: 'Erro ao persistir informação no banco.' });
  }
});

// DELETE /api/memory/:id - Delete an entity from database
app.delete('/api/memory/:id', (req, res) => {
  try {
    const { id } = req.params;
    let entities = readDatabase();
    const initialCount = entities.length;
    entities = entities.filter(e => e.id !== id);

    if (entities.length === initialCount) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado.' });
    }

    writeDatabase(entities);
    console.log(`[Memory DB] Deleted entity ID "${id}" from database.`);
    res.json({ success: true, count: entities.length });
  } catch (err: any) {
    console.error('[DELETE /api/memory error]', err);
    res.status(500).json({ success: false, error: 'Erro ao excluir registro.' });
  }
});

// POST /api/memory/clear - Clear all entities from database
app.post('/api/memory/clear', (req, res) => {
  try {
    writeDatabase([]);
    console.log('[Memory DB] Database cleared completely.');
    res.json({ success: true, count: 0, data: [] });
  } catch (err: any) {
    console.error('[POST /api/memory/clear error]', err);
    res.status(500).json({ success: false, error: 'Erro ao limpar banco de dados.' });
  }
});

// POST /api/memory/reset - Restore initial canonical seed
app.post('/api/memory/reset', (req, res) => {
  try {
    writeDatabase(SEED_LORE_ENTITIES);
    console.log('[Memory DB] Database reset to canonical seed lore.');
    res.json({ success: true, count: SEED_LORE_ENTITIES.length, data: SEED_LORE_ENTITIES });
  } catch (err: any) {
    console.error('[POST /api/memory/reset error]', err);
    res.status(500).json({ success: false, error: 'Erro ao restaurar base de dados.' });
  }
});

// POST /api/memory/import - Import complete JSON database
app.post('/api/memory/import', (req, res) => {
  try {
    const { entities } = req.body;
    if (!Array.isArray(entities)) {
      return res.status(400).json({ success: false, error: 'Formato inválido. Esperado array de entidades.' });
    }
    writeDatabase(entities);
    console.log(`[Memory DB] Imported ${entities.length} entities into database.`);
    res.json({ success: true, count: entities.length, data: entities });
  } catch (err: any) {
    console.error('[POST /api/memory/import error]', err);
    res.status(500).json({ success: false, error: 'Erro ao importar dados.' });
  }
});

// ==================== CHAT & AI ENDPOINT ====================
// Searches memory FIRST, then consults Gemini.
// If Gemini fails, returns friendly connection error without faking or inventing lore.

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory, simulateError } = req.body;
    const simulateErrorHeader = req.headers['x-simulate-gemini-error'] === 'true';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida.' });
    }

    // Step 1: Read memory independently from database
    const allEntities = readDatabase();

    // Step 2: Intelligent retrieval of relevant entities (Canon first, related links, etc.)
    const relevantEntities = retrieveRelevantMemory(message, allEntities, 6);

    // If simulating Gemini failure (for required testing)
    if (simulateError || simulateErrorHeader) {
      console.warn('[Gemini Simulation Log] Simulating 503 / Gemini failure as requested.');
      return res.json({
        success: false,
        error: 'ai_unavailable',
        reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
      });
    }

    // Step 3: Format the context summary strictly from retrieved memory
    const contextSummary = relevantEntities.map(e => {
      const details: string[] = [];
      if (e.period) details.push(`Período/Data: ${e.period}`);
      if (e.status) details.push(`Status Canônico: ${e.status.toUpperCase()}`);
      if (e.subDetails?.role) details.push(`Papel/Título: ${e.subDetails.role}`);
      if (e.subDetails?.participants) details.push(`Participantes: ${e.subDetails.participants.join(', ')}`);
      if (e.subDetails?.locations) details.push(`Locais: ${e.subDetails.locations.join(', ')}`);
      if (e.subDetails?.consequences) details.push(`Consequências: ${e.subDetails.consequences}`);
      if (e.subDetails?.notes) details.push(`Notas/Conflitos: ${e.subDetails.notes}`);

      return `[${e.type.toUpperCase()}] ${e.name}
${details.join(' | ')}
Descrição: ${e.description}`;
    }).join('\n\n---\n\n');

    const historyPrompt = (conversationHistory || []).slice(-6).map((h: any) => {
      return `${h.sender === 'user' ? 'Marcos' : 'LOH AI'}: ${h.content}`;
    }).join('\n');

    const finalPrompt = `
MEMÓRIA CANÔNICA RECUPERADA DA LOH (FONTE ÚNICA DE VERDADE):
${contextSummary || 'NENHUM REGISTRO ESPECÍFICO ENCONTRADO NA MEMÓRIA PARA ESTA CONSULTA.'}

HISTÓRICO DA CONVERSA:
${historyPrompt || 'Início da conversa.'}

PERGUNTA DE MARCOS:
${message}
`;

    // Step 4: Call Gemini API with automatic retry
    try {
      const response = await callGeminiWithRetry(finalPrompt, 3);
      const replyText = response.text || 'Essa informação ainda não está cadastrada na memória da LOH.';

      return res.json({
        success: true,
        reply: replyText,
        referencedEntityIds: relevantEntities.map(e => e.id),
      });
    } catch (geminiError: any) {
      // Log technical details ONLY in server developer logs
      console.error('[Gemini API Developer Log - Communication Error]:', geminiError?.message || geminiError);

      // NEVER invent lore, NEVER use heuristic fake answers.
      // Return ONLY the friendly clean message:
      return res.json({
        success: false,
        error: 'ai_unavailable',
        reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
      });
    }
  } catch (error: any) {
    console.error('[LOH AI Developer Log - Server Internal Error]:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`LOH AI server running on port ${PORT} with model ${MODEL_NAME}`);
  });
}

startServer();
