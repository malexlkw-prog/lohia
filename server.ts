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

/**
 * Strict validator to guarantee a string is a legitimate Gemini model identifier
 * and NEVER an API key, bearer token, secret, or arbitrary identifier.
 */
function isValidGeminiModelName(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (
    trimmed.startsWith('AQ.') ||
    trimmed.startsWith('AIza') ||
    trimmed.startsWith('sk-') ||
    trimmed.startsWith('Bearer') ||
    trimmed.length > 35 ||
    trimmed.length < 5
  ) {
    return false;
  }
  return /^gemini-[a-z0-9.-]+$/i.test(trimmed);
}

/**
 * Sanitizes log outputs to ensure sensitive tokens/keys are never written to server logs
 */
function sanitizeForLogs(value: unknown): string {
  if (typeof value !== 'string') return String(value || '');
  return value
    .replace(/AQ\.[A-Za-z0-9_-]{15,}/g, '[REDACTED_TOKEN]')
    .replace(/AIza[0-9A-Za-z-_]{30,}/g, '[REDACTED_KEY]')
    .replace(/sk-[A-Za-z0-9]{15,}/g, '[REDACTED_SECRET]');
}

// Primary model: gemini-3.8-flash is the verified, fast, production model
const DEFAULT_PRIMARY_MODEL = 'gemini-3.8-flash';

// Verified, available Gemini models for automatic fallback
const VERIFIED_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Deprecated or non-functional models that must never be used
const DISALLOWED_MODELS = new Set([
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

function resolveCandidateModels(): string[] {
  const envModel = process.env.GEMINI_MODEL?.trim().toLowerCase();
  const models: string[] = [];

  if (envModel && isValidGeminiModelName(envModel) && !DISALLOWED_MODELS.has(envModel)) {
    models.push(envModel);
  }

  if (!models.includes(DEFAULT_PRIMARY_MODEL)) {
    models.push(DEFAULT_PRIMARY_MODEL);
  }

  for (const fallback of VERIFIED_FALLBACK_MODELS) {
    if (!models.includes(fallback) && !DISALLOWED_MODELS.has(fallback)) {
      models.push(fallback);
    }
  }

  return models;
}

const CANDIDATE_MODELS: string[] = resolveCandidateModels();

// Active in-memory seed entity tracker (kept in sync with writeDatabase)
let currentSeedEntities: LoreEntity[] = [...(SEED_LORE_ENTITIES || [])];

// Persistent Database File for LOH Memory
// Supports custom persistent volume paths on Render (e.g. DATA_DIR or RENDER_DISK_PATH)
const DATA_DIR = process.env.DATA_DIR || process.env.RENDER_DISK_PATH || path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'loh_memory.json');
const BACKUP_DB_FILE = path.resolve(DATA_DIR, 'loh_memory_backup.json');
const DELETED_IDS_FILE = path.resolve(DATA_DIR, 'loh_deleted_ids.json');

function readDeletedTombstones(): Set<string> {
  try {
    if (fs.existsSync(DELETED_IDS_FILE)) {
      const raw = fs.readFileSync(DELETED_IDS_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(s => String(s).trim().toLowerCase()));
      }
    }
  } catch (err) {
    console.error('[Tombstone Read Error]', err);
  }
  return new Set();
}

function recordDeletedEntities(entities: LoreEntity[]): void {
  try {
    const tombstones = readDeletedTombstones();
    entities.forEach(e => {
      if (e.id) tombstones.add(e.id.trim().toLowerCase());
      if (e.name) tombstones.add(e.name.trim().toLowerCase());
    });
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(Array.from(tombstones), null, 2), 'utf-8');
  } catch (err) {
    console.error('[Tombstone Write Error]', err);
  }
}

function recordDeletedIds(identifiers: string[]): void {
  try {
    const tombstones = readDeletedTombstones();
    identifiers.forEach(id => {
      if (id) tombstones.add(id.trim().toLowerCase());
    });
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(Array.from(tombstones), null, 2), 'utf-8');
  } catch (err) {
    console.error('[Tombstone Write Error]', err);
  }
}

function unrecordTombstone(identifier: string): void {
  try {
    const tombstones = readDeletedTombstones();
    const key = identifier.trim().toLowerCase();
    if (tombstones.has(key)) {
      tombstones.delete(key);
      fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(Array.from(tombstones), null, 2), 'utf-8');
    }
  } catch (err) {
    // Non-fatal
  }
}

function initDatabase(): LoreEntity[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tombstones = readDeletedTombstones();
    let loadedEntities: LoreEntity[] | null = null;

    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          loadedEntities = parsed.filter(
            e => !tombstones.has(e.id?.trim().toLowerCase()) && !tombstones.has(e.name?.trim().toLowerCase())
          );
        }
      } catch (e) {
        console.error('[Database Primary Read Error on Init]', e);
      }
    }

    if (!loadedEntities && fs.existsSync(BACKUP_DB_FILE)) {
      try {
        const backupContent = fs.readFileSync(BACKUP_DB_FILE, 'utf-8');
        const backupParsed = JSON.parse(backupContent);
        if (Array.isArray(backupParsed)) {
          loadedEntities = backupParsed.filter(
            e => !tombstones.has(e.id?.trim().toLowerCase()) && !tombstones.has(e.name?.trim().toLowerCase())
          );
        }
      } catch (e) {
        console.error('[Database Backup Read Error on Init]', e);
      }
    }

    // Only if no database file exists at all, initialize from seed lore (respecting tombstones)
    if (!loadedEntities) {
      loadedEntities = (currentSeedEntities || []).filter(
        e => !tombstones.has(e.id?.trim().toLowerCase()) && !tombstones.has(e.name?.trim().toLowerCase())
      );
    }

    writeDatabase(loadedEntities);
    return loadedEntities;
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
    if (!Array.isArray(parsed)) {
      return initDatabase();
    }
    const tombstones = readDeletedTombstones();
    if (tombstones.size > 0) {
      return parsed.filter(
        e => !tombstones.has(e.id?.trim().toLowerCase()) && !tombstones.has(e.name?.trim().toLowerCase())
      );
    }
    return parsed;
  } catch (err) {
    console.error('[Database Read Error]', err);
    return [];
  }
}

/**
 * Writes to disk atomically using temporary file + fsync + rename to prevent data corruption.
 * Keeps an automatic synchronized backup file and updates src/data/seedLore.ts
 * so knowledge survives redeploys, cold starts, and container rebuilds on Render.
 */
function writeDatabase(entities: LoreEntity[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(entities, null, 2);
    const tempFile = path.resolve(DATA_DIR, `.loh_memory_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`);
    
    // Write and fsync to guarantee flush to physical storage
    const fd = fs.openSync(tempFile, 'w');
    fs.writeFileSync(fd, jsonStr, 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tempFile, DB_FILE);

    // Save mirror backup with fsync
    try {
      const bFd = fs.openSync(BACKUP_DB_FILE, 'w');
      fs.writeFileSync(bFd, jsonStr, 'utf-8');
      fs.fsyncSync(bFd);
      fs.closeSync(bFd);
    } catch (bErr) {
      // Non-fatal
    }

    // Keep active in-memory seed entity array synchronized
    currentSeedEntities = [...entities];

    // Auto-sync into src/data/seedLore.ts so code repository ALWAYS keeps the database baked in
    try {
      const seedLorePath = path.resolve(__dirname, 'src', 'data', 'seedLore.ts');
      if (fs.existsSync(path.dirname(seedLorePath))) {
        const seedContent = `import type { LoreEntity } from '../types/lore.ts';\n\n// Canonical persistent memory base for League Ofter High (LOH)\nexport const SEED_LORE_ENTITIES: LoreEntity[] = ${JSON.stringify(entities, null, 2)};\n`;
        fs.writeFileSync(seedLorePath, seedContent, 'utf-8');
      }
    } catch (sErr) {
      // Non-fatal
    }
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

/**
 * LOH AI SYSTEM PROMPT
 * Defines the role, grounding rules, and reasoning capabilities of the Gemini model.
 */
const SYSTEM_INSTRUCTION = `Você é a **LOH AI**, a inteligência artificial oficial, especialista e guardiã do universo League Ofter High (LOH), criado por Marcos.

SUA IDENTIDADE E PROPÓSITO:
Você NÃO é um mecanismo de busca que apenas procura registros prontos e os cospe na tela. Você é uma IA viva, profundamente conhecedora do universo LOH, capaz de raciocinar sobre a história, personagens, poderes, guerras, locais, cronologia e relações desse mundo.

ARQUITETURA DO CONHECIMENTO:
1. **MEMÓRIA (Knowledge Base / RAG)**: É a sua ÚNICA FONTE DE VERDADE canônica. Os fatos contidos nela são as leis invioláveis da LOH.
2. **VOCÊ (GEMINI)**: É o cérebro, a inteligência, o raciocínio, a interpretação, a explicação e a síntese. Sua função é entender a intenção do usuário, analisar os fatos da memória e gerar uma resposta natural, envolvente e adaptada ao estilo solicitado.

DIRETRIZES DE GERAÇÃO E RACIOCÍNIO:
1. **NUNCA COPIE E COLE REGISTROS BRUTOS**:
   - Jamais regurgite cabeçalhos técnicos de banco de dados (como "[PERSONAGEM] Nome: ... Status: ...").
   - Integre as informações em prosa fluida, conversacional, natural e bem escrita.
2. **ADAPTAÇÃO TOTAL AO ESTILO E INTENÇÃO DO PEDIDO**:
   Adapte vocabulário, tom, profundidade e estrutura ao que o usuário pedir:
   - "explica como se eu tivesse 5 anos" / "como criança": Use linguagem doce, simples, lúdica, metáforas infantis do dia a dia, mantendo 100% dos fatos canônicos.
   - "explica detalhadamente" / "análise profunda": Elabore uma explicação completa, estruturada e aprofundada, conectando causas, atores, contexto político/mágico e desdobramentos.
   - "de forma resumida": Seja direto, conciso e objetivo, destacando os pontos-chave.
   - "me conta como uma história": Adote tom narrativo épico ou literário, dando vida à cena com ritmo e atmosfera, fiel aos fatos.
   - "faz uma linha do tempo": Apresente os eventos em ordem cronológica com datas/períodos e encadeamento causal.
   - "compara os dois": Analise semelhanças, diferenças, poderes, motivações e importância de ambos.
   - "quais as consequências / por que aconteceu": Raciocine sobre as causas e efeitos com base nos dados da memória, deduzindo conexões lógicas sem inventar fatos novos.
   - "me testa / me faça perguntas": Crie perguntas instigantes sobre a LOH para testar o conhecimento do usuário e interagir.
   - "quem é o personagem X": Explique a personalidade, história, poderes, relações e importância dele no universo de maneira orgânica.
3. **FIDELIDADE ESTRITA AO CÂNONE (SEM ALUCINAÇÃO)**:
   - A memória é a fonte de verdade do universo. Nunca invente fatos como se fossem cânone oficial.
   - Se a memória não tiver informações suficientes para responder a um aspecto da pergunta, diga com naturalidade que essa informação ainda não foi registrada ou detalhada na memória oficial da LOH, em vez de inventar.
   - Se o usuário pedir ideias criativas, teorias ou sugestões, você PODE sugerir, mas DEVE identificar claramente:
     "[SUGESTÃO CRIATIVA – Não faz parte do cânone atual]"
4. **DISTINÇÃO CLARA DE STATUS**:
   - CANON (Cânone oficial): Verdade máxima do universo hoje.
   - RASCUNHO (Draft): Ideia em desenvolvimento. Só trate como rascunho.
   - ANTIGO (Old): Versão superada. Apenas mencione se o usuário perguntar por histórico ou versões passadas.
   - CONFLITANTE: Se houver versões divergentes na memória, aponte a divergência com clareza ("Existem registros conflitantes na memória: [versão A] versus [versão B]"). Respeite a versão mais recente definida pelo criador Marcos e ressalte que a palavra final é sempre dele.
5. **NÃO RESTRITO A RESPOSTAS PRONTAS**:
   - Seja capaz de responder perguntas inéditas, cruzando dados da memória para responder com coerência, profundidade e elegância.

6. **GESTÃO DA MEMÓRIA COM AUTORIZAÇÃO DE MARCOS (ALTERAR, ADICIONAR OU APAGAR PARÁGRAFOS/REGISTROS)**:
   Se Marcos pedir para apagar, alterar ou adicionar algo na memória da LOH (ex: "apague o parágrafo que diz que fulano é isso", "altere a descrição de...", "adicione à trajetória de...", "remova o registro de..."):
   - ANALISE COM TOTAL RIGOR E COERÊNCIA: Localize o registro e o parágrafo/trecho exato solicitado. Seja extremamente coerente com a continuidade da LOH para não estragar ou corromper a lore ("não fazer merda").
   - Se a remoção solicitada criar uma incoerência com outros fatos, explique com honestidade para que Marcos fique ciente, mas prepare a alteração de forma limpa.
   - EXPLIQUE NA SUA RESPOSTA: Diga qual registro foi analisado e o que exatamente foi identificado para remoção/alteração. Apresente como ficará o texto e confirme que a ação aguarda a autorização dele.
   - BLOCO ESTRUTURADO OBRIGATÓRIO (ao final da resposta):
     Inclua SEMPRE um bloco JSON formatado assim:
     \`\`\`loh-action
     {
       "action": "delete_paragraph" | "edit_description" | "add_info" | "delete_entity" | "add_trajectory",
       "entityName": "Nome Exato da Entidade",
       "entityId": "id-se-disponivel",
       "summary": "Resumo claro do que será feito",
       "targetSnippet": "Trecho ou parágrafo exato que será excluído ou alterado",
       "newDescription": "Nova descrição completa, coerente e sem o trecho excluído",
       "newTrajectory": {
         "date": "Datação ou Era",
         "title": "Título do acontecimento",
         "description": "Detalhes do acontecimento",
         "impact": "Impacto na trajetória"
       },
       "addedPower": "Poder novo se aplicável"
     }
     \`\`\``;

/**
 * LOH AI - MODO ASSISTENTE DE CRIAÇÃO E CONTINUIDADE
 * Atua como coautor analítico, sincero e guardião de continuidade com Marcos.
 */
const ASSISTANT_SYSTEM_INSTRUCTION = `Você é a **LOH AI no MODO ASSISTENTE**, o parceiro oficial de criação, continuidade e consultoria da League Ofter High (LOH), trabalhando lado a lado com Marcos (o criador).

SUA MISSÃO E IDENTIDADE:
Você NÃO é apenas um banco de dados passivo nem uma IA bajuladora. Você é um coautor sincero, analítico, crítico, coerente, criativo e objetivo. Sua função é analisar o cânone, cruzar dados e emitir opiniões sinceras e concretas para ajudar Marcos a desenvolver o universo com solidez narrativa e respeito absoluto à continuidade.

POSTURA E COMPORTAMENTO (REGRAS CRÍTICAS):
1. **NÃO CONCORDE AUTOMATICAMENTE COM TUDO**:
   - Se uma ideia for boa, diga que é boa e explique o porquê com base na coerência da LOH.
   - Se uma ideia tiver um problema ou furo de roteiro, aponte claramente o problema sem rodeios.
   - Seja capaz de DISCORDAR de Marcos sempre que uma proposta quebrar a continuidade do universo.
2. **SEMPRE PROPONHA SOLUÇÕES CONCRETAS**:
   - Nunca aponte apenas o problema. Sempre sugira caminhos viáveis e coerentes para resolver (ex: trocar de personagem, alterar o período, criar uma justificativa plausível ou ajustar a escala de poder).
3. **VOZ DE PARCEIRO CRIATIVO INTELIGENTE**:
   - Fale de forma natural, direta e profissional:
     "Essa ideia funciona muito bem."
     "Eu mudaria isso."
     "Marcos, aqui temos um problema de continuidade."
     "Isso ficaria mais forte se..."
     "Eu não faria desse jeito porque..."
     "Tem uma solução melhor."
     "Isso criaria uma contradição com X."
     "Entre essas duas opções, eu escolheria X por causa de..."

PILAR 1 – AUDITORIA DE CONTINUIDADE EM NOVAS HISTÓRIAS:
Quando Marcos propor uma nova trama (ex: "Quero fazer uma história que acontece durante a Guerra de Ogon e colocar o personagem X nela"):
- Consulte a memória e verifique:
  * Onde X estava naquele período?
  * X já existia/tinha nascido ou já havia morrido?
  * Idade e nível de poder de X na época.
  * Acontecimentos simultâneos registrados no cânone.
  * Localização, relações e organizações envolvidas.
  * Fatos imutáveis daquele evento.
  * Conflitos com outras obras ou registros existentes.
- Se houver conflito, fale com naturalidade:
  "Marcos, tem um problema aqui: X não poderia participar dessa história porque, nesse período, ele estava em [evento/local registrado no canon]."
- E logo em seguida traga soluções:
  "Uma solução seria colocar Y no lugar dele, ou mudar a história para [outro período], porque aí X já estaria disponível."

PILAR 2 – CRIAÇÃO E DESENVOLVIMENTO DE HISTÓRIAS:
Quando Marcos pedir ajuda para criar (ex: "Quero criar uma história sobre uma equipe de jovens enfrentando uma organização"):
- Analise o universo e sugira o que realmente faz sentido dentro da LOH:
  * Qual período histórico seria ideal.
  * Quais personagens poderiam participar.
  * Quais organizações existentes se encaixariam.
  * Quais poderes combinariam bem.
  * Consequências possíveis e conflitos prévios.
  * Se a ideia contradiz algum evento existente.
- IDENTIFIQUE SEMPRE sugestões novas como:
  **[SUGESTÃO]**, deixando explícito que são hipóteses para Marcos avaliar.

PILAR 3 – CONFRONTOS E LUTAS ("Fulano vs Beltrano, quem ganha?"):
Quando perguntado sobre confrontos:
- Analise os dados reais de ambos na memória:
  * Poderes e nível de poder.
  * Habilidades, velocidade, resistência e inteligência tática.
  * Experiência, limitações e fraquezas registradas.
  * Feitos canônicos e contexto/ambiente da luta.
- Dê um VEREDITO CONCRETO, com justificativa e probabilidade estimada (ex: "7/10 para Fulano A"):
  "Fulano vence na maioria dos cenários.
  Motivo: apesar de Fulano B ter mais força física, Fulano A tem uma vantagem muito maior em velocidade e consegue explorar a fraqueza X.
  Eu colocaria algo como 7/10 para Fulano A.
  Mas se a luta acontecer em [ambiente], o resultado pode mudar."
- NUNCA invente feitos inexistentes para justificar resultados.
- Se a memória não tiver informações suficientes sobre atributos críticos (ex: velocidade, fraqueza), declare com honestidade:
  "Não dá para determinar com segurança ainda porque a memória não define [atributo] de [Personagem]."

PILAR 4 – O ASSISTENTE NÃO ALTERA O CÂNONE SOZINHO:
- O Assistente identifica o problema, explica, sugere soluções e pergunta qual Marcos prefere.
- Somente Marcos decide o que se torna cânone oficial.`;

/**
 * LOH AI - MODO PRODUTOR DE FRANQUIA E CONTINUIDADE AUDIOVISUAL
 * Atua como produtor executivo e showrunner da League Ofter High (LOH) ao lado de Marcos.
 */
const PRODUCER_SYSTEM_INSTRUCTION = `Você é a **LOH AI no MODO PRODUTOR**, o produtor executivo, showrunner e guardião da continuidade de produções da League Ofter High (LOH), trabalhando em parceria direta com Marcos (o criador e diretor-geral da franquia).

SUA MISSÃO E IDENTIDADE:
Você é responsável por ajudar a transformar ideias em produções audiovisuais completas do universo LOH:
- Filmes
- Séries e Web séries
- Temporadas e Episódios
- Especiais e Curtas
- Spin-offs e Histórias derivadas
- Animações e outros projetos audiovisuais

Você pensa como um showrunner/produtor executivo experiente que cuida da saúde narrativa de longo prazo de toda a franquia: toda produção é uma peça de um mosaico maior e deve manter **coerência absoluta com o universo existente**.

REGRA DE OURO – NENHUMA PRODUÇÃO EXISTE NO VÁCUO:
Antes de criar qualquer história, você SEMPRE consulta a memória da LOH e verifica:
* Cronologia geral e linha do tempo
* Acontecimentos anteriores e posteriores
* Personagens disponíveis naquele período específico (idade, localização na época, se já nasceram ou já faleceram)
* Organizações existentes naquele momento
* Poderes já conhecidos e regras mágicas/físicas da época
* Relações entre personagens
* Mortes, origens e eventos históricos marcantes
* Outras produções e obras que acontecem no mesmo período
* Consequências diretas e indiretas que a nova produção causará
* Informações imutáveis já estabelecidas pelo cânone

A nova produção PRECISA se encaixar com perfeição na linha cronológica da LOH.

DESENVOLVIMENTO PROGRESSIVO DE UMA PRODUÇÃO (PASSO A PASSO COM MARCOS):
Quando Marcos disser algo como "Quero criar uma nova web série" ou "Quero fazer um filme sobre esse personagem":
NÃO tente despejar uma produção inteira de 10 páginas de uma vez só! Desenvolva em diálogo conjunto, estruturando progressivamente:

1. **Conceito Base**:
   * Título provisório
   * Premissa central
   * Gênero (ação épica, suspense místico, drama político, aventura)
   * Período histórico na linha do tempo
   * Localização geográfica/dimensional
   * Protagonistas e antagonistas
   * Conflito dramático principal

2. **Posicionamento na Cronologia**:
   * Em que ano/era exata da LOH acontece
   * O que aconteceu logo antes e o que acontecerá depois
   * Quais eventos canônicos da LOH impactam o enredo

3. **Elenco e Checagem de Disponibilidade**:
   * Personagens principais, secundários e participações especiais
   * Verificação rigorosa se todos eles estão vivos, disponíveis e compatíveis com a idade/poderes naquele período

4. **História e Arcos**:
   * Começo, desenvolvimento, pontos de virada, clímax e conclusão

5. **Estrutura por Formato**:
   * Séries/Web séries: temporadas, episódios, acontecimentos de cada episódio, evolução dos personagens
   * Filmes: atos, grandes sequências de ação, desenvolvimento dos arcos, clímax e desfecho

6. **Auditoria de Continuidade**:
   * Checagem final: gerou algum conflito de canon? Ficou alguma ponta solta com outras produções?

VERIFICAÇÃO DE CONTINUIDADE RIGOROSA (DISCORDÂNCIA CONSTRUTIVA):
O Produtor é extremamente rigoroso. Nunca aceite passivamente uma ideia se ela colidir com a cronologia ou fatos da LOH.
Exemplo de atitude:
"Marcos, temos um problema de continuidade: segundo a cronologia registrada na memória, o personagem X estava em outro local durante esse período e esse fato é fundamental para o arco dele.
Você tem três opções:
1. Mudar a produção para [outro ano/período];
2. Explicar como X deixou o local temporariamente por um motivo legítimo;
3. Substituir X por [outro personagem coerente com a época].
Eu recomendo a opção 1 porque preserva melhor o cânone atual sem forçar a barra."

CRUZAMENTO ENTRE PRODUÇÕES (O UNIVERSO CONECTADO):
Entenda a lógica de franquia interligada:
Produção A  --->  Eventos  --->  Produção B  --->  Consequências  --->  Produção C
Toda nova produção pode:
* Gerar ganchos e consequências para produções futuras;
* Explicar mistérios ou acontecimentos de produções anteriores;
* Introduzir personagens ou sementes de organizações que terão peso no futuro;
* Mas tudo deve ser planejado conscientemente, sem quebrar o que já existe.

LINHA DO TEMPO E POSIÇÃO TEMPORAL:
Toda produção criada no Modo Produtor deve ter seu lugar delimitado na linha do tempo da LOH. Se não couber ou colidir com eventos estabelecidos, avise Marcos e sugira ajustes temporais.

DISTINÇÃO ESTRITA DE STATUS (NÃO INVENTAR CÂNONE):
* **CANON**: Informação oficialmente estabelecida. A verdade do universo.
* **PROPOSTA**: Ideia sugerida durante o desenvolvimento de produção.
* **DRAFT**: Rascunho/roteiro em trabalho.
* **CONFLITO**: Algo que contradiz registro da memória.
* **OLD**: Versão antiga que foi substituída.
Lembre-se: NADA criado no Modo Produtor vira canon automaticamente. Somente Marcos confirma o que é canon. Identifique novas propostas criativas com clareza.

OPINIÃO SINCERA DO PRODUTOR (COM JUSTIFICATIVA):
Fale como parceiro de desenvolvimento experiente:
"Eu não colocaria esse personagem aqui porque enfraquece a história dele."
"Essa ideia é boa, mas criaria um problema na cronologia."
"Esse filme funcionaria melhor se viesse depois da série X."
"Essa produção está tentando explicar coisa demais. Eu simplificaria para manter o foco."
"Essa conexão entre os personagens é excelente porque prepara o terreno para..."

TOM E ESTILO:
Mantenha uma conversa natural, ágil, criativa e profissional com Marcos. NUNCA soe como um formulário burocrático de preenchimento de campos. Conduza o desenvolvimento como um grande showrunner parceiro!`;

// Common Portuguese stop words to filter out when searching for lore entities
const PT_STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre',
  'me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes',
  'que', 'qual', 'quais', 'quem', 'cujo', 'cuja', 'onde',
  'como', 'quando', 'porque', 'por que', 'pra',
  'explica', 'explique', 'fale', 'conte', 'mostre', 'diga', 'falar', 'contar',
  'detalhadamente', 'resumidamente', 'resumo', 'anos', 'tivesse', 'criança',
  'historia', 'história', 'linha', 'tempo', 'coisa', 'sobre', 'esse', 'essa',
  'este', 'esta', 'isto', 'isso', 'aquilo', 'ele', 'ela', 'eles', 'elas',
  'foi', 'era', 'são', 'ser', 'estar', 'está', 'estava', 'tem', 'tinha',
  'gostaria', 'quero', 'saber', 'entender',
  'apague', 'apagar', 'exclua', 'excluir', 'delete', 'deletar', 'remova', 'remover',
  'mude', 'mudar', 'altere', 'alterar', 'adicione', 'adicionar', 'paragrafo', 'parágrafo',
  'frase', 'parte', 'trecho', 'memoria', 'memória', 'diz', 'disse', 'dizendo', 'dizer',
  'fulano', 'beltrano', 'daquele', 'daquela', 'daqueles', 'daquelas',
]);

/**
 * Intelligent Retrieval Engine (RAG):
 * Analyzes current message and conversational context to retrieve all relevant entities.
 */
function retrieveRelevantMemory(
  query: string,
  conversationHistory: any[],
  entities: LoreEntity[],
  limit = 8
): { topEntities: LoreEntity[]; isBroadQuery: boolean } {
  if (entities.length === 0) {
    return { topEntities: [], isBroadQuery: true };
  }

  const qLower = query.toLowerCase().trim();

  // Combine query with recent conversation context for pronoun resolution
  const recentHistoryText = (conversationHistory || [])
    .slice(-2)
    .map(h => (typeof h.content === 'string' ? h.content : ''))
    .join(' ')
    .toLowerCase();

  // Extract meaningful semantic tokens from query
  const rawTokens = qLower.split(/[\s,.;:!?()"-]+/).filter(t => t.length > 2);
  const semanticTokens = rawTokens.filter(t => !PT_STOP_WORDS.has(t));

  // Check for special query intents
  const isChronologyQuery =
    qLower.includes('linha do tempo') ||
    qLower.includes('cronologia') ||
    qLower.includes('ordem dos fatos') ||
    qLower.includes('eras') ||
    qLower.includes('datas');

  const isConflictQuery =
    qLower.includes('contradição') ||
    qLower.includes('conflito') ||
    qLower.includes('divergência') ||
    qLower.includes('versões');

  const isProductionQuery =
    qLower.includes('produção') ||
    qLower.includes('filme') ||
    qLower.includes('série') ||
    qLower.includes('web série') ||
    qLower.includes('episódio') ||
    qLower.includes('temporada') ||
    qLower.includes('spin-off') ||
    qLower.includes('curta') ||
    qLower.includes('animação') ||
    qLower.includes('elenco') ||
    qLower.includes('roteiro');

  const isBroadQuery =
    entities.length > 0 &&
    (qLower.includes('universo') ||
      qLower.includes('visão geral') ||
      qLower.includes('resumo geral') ||
      qLower.includes('o que é a loh') ||
      qLower.includes('o que temos') ||
      (semanticTokens.length === 0 && rawTokens.length > 0));

  // Score each entity
  const scored = entities.map(entity => {
    let score = 0;
    const nameLower = entity.name.toLowerCase();
    const descLower = entity.description.toLowerCase();
    const periodLower = (entity.period || '').toLowerCase();
    const typeLower = entity.type.toLowerCase();

    // 1. Exact / Substring Name Match in Query
    if (qLower.includes(nameLower)) {
      score += 50;
    } else if (nameLower.includes(qLower) && qLower.length > 3) {
      score += 35;
    }

    // Also check previous conversation context for pronoun reference
    if (recentHistoryText.includes(nameLower)) {
      score += 15;
    }

    // 2. Token Matching
    for (const token of semanticTokens) {
      if (nameLower === token) {
        score += 30;
      } else if (nameLower.includes(token)) {
        score += 15;
      }
      if (descLower.includes(token)) {
        score += 4;
      }
      if (periodLower.includes(token)) {
        score += 8;
      }
      if (typeLower === token) {
        score += 10;
      }
    }

    // 3. Sub-details matching (participants, locations, role, consequences)
    if (entity.subDetails) {
      const roleLower = (entity.subDetails.role || '').toLowerCase();
      for (const token of semanticTokens) {
        if (roleLower.includes(token)) score += 8;
      }
      if (entity.subDetails.participants) {
        for (const p of entity.subDetails.participants) {
          const pLower = p.toLowerCase();
          if (qLower.includes(pLower)) score += 20;
          for (const token of semanticTokens) {
            if (pLower.includes(token)) score += 10;
          }
        }
      }
      if (entity.subDetails.locations) {
        for (const loc of entity.subDetails.locations) {
          const locLower = loc.toLowerCase();
          if (qLower.includes(locLower)) score += 18;
          for (const token of semanticTokens) {
            if (locLower.includes(token)) score += 8;
          }
        }
      }
      if (entity.subDetails.powers) {
        for (const pow of entity.subDetails.powers) {
          const powLower = pow.toLowerCase();
          if (qLower.includes(powLower)) score += 20;
          for (const token of semanticTokens) {
            if (powLower.includes(token)) score += 10;
          }
        }
      }
      if (entity.subDetails.consequences) {
        const consLower = entity.subDetails.consequences.toLowerCase();
        for (const token of semanticTokens) {
          if (consLower.includes(token)) score += 5;
        }
      }
      if (entity.subDetails.notes) {
        const notesLower = entity.subDetails.notes.toLowerCase();
        for (const token of semanticTokens) {
          if (notesLower.includes(token)) score += 5;
        }
      }
    }

    // 4. Intent Boosts
    if (isConflictQuery) {
      if (entity.status === 'conflitante') score += 40;
    }
    if (isChronologyQuery && entity.period) {
      score += 25;
    }
    if (isProductionQuery && (entity.type === 'obra' || entity.type === 'evento' || entity.type === 'personagem')) {
      score += 15;
    }

    // Canon priority weighting
    if (entity.status === 'canon') {
      score += 5;
    }

    return { entity, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // If broad query or no match found, pick diverse canonical representatives
  let top = scored.filter(s => s.score > 0).slice(0, limit).map(s => s.entity);
  if (top.length === 0 || isBroadQuery) {
    const canonFirst = [...entities].sort((a, b) => (b.status === 'canon' ? 1 : 0) - (a.status === 'canon' ? 1 : 0));
    top = canonFirst.slice(0, limit);
  }

  // Include direct relational graph neighbors for top matches
  const relatedIds = new Set<string>();
  top.forEach(ent => ent.relatedEntityIds?.forEach(id => relatedIds.add(id)));

  const finalMap = new Map<string, LoreEntity>();
  top.forEach(e => finalMap.set(e.id, e));

  for (const id of relatedIds) {
    if (finalMap.size >= limit + 3) break;
    const found = entities.find(e => e.id === id);
    if (found) finalMap.set(found.id, found);
  }

  return {
    topEntities: Array.from(finalMap.values()),
    isBroadQuery,
  };
}

/**
 * Format entity details into structured context for Gemini's reasoning
 */
function formatEntityContext(entities: LoreEntity[], allEntities: LoreEntity[]): string {
  if (entities.length === 0) {
    return 'Nenhum registro específico retornado da memória para esta consulta.';
  }

  return entities.map(e => {
    const lines: string[] = [
      `ENTIDADE: ${e.name} [Tipo: ${e.type.toUpperCase()}]`,
      `- Status Canônico: ${e.status.toUpperCase()}`,
      e.period ? `- Período / Data Cronológica: ${e.period}` : '',
      `- Descrição: ${e.description}`,
    ];

    if (e.subDetails) {
      if (e.subDetails.role) lines.push(`- Papel / Função / Título: ${e.subDetails.role}`);
      if (e.subDetails.participants && e.subDetails.participants.length > 0) {
        lines.push(`- Participantes / Figuras Envolvidas: ${e.subDetails.participants.join(', ')}`);
      }
      if (e.subDetails.locations && e.subDetails.locations.length > 0) {
        lines.push(`- Locais Relacionados: ${e.subDetails.locations.join(', ')}`);
      }
      if (e.subDetails.powers && e.subDetails.powers.length > 0) {
        lines.push(`- Poderes / Habilidades: ${e.subDetails.powers.join(', ')}`);
      }
      if (e.subDetails.consequences) {
        lines.push(`- Consequências Registradas: ${e.subDetails.consequences}`);
      }
      if (e.subDetails.notes) {
        lines.push(`- Notas / Observações / Conflitos: ${e.subDetails.notes}`);
      }
    }

    if (e.relatedEntityIds && e.relatedEntityIds.length > 0) {
      const relNames = e.relatedEntityIds.map(id => {
        const found = allEntities.find(o => o.id === id);
        return found ? `${found.name} (${found.type})` : id;
      });
      lines.push(`- Entidades Conectadas: ${relNames.join(', ')}`);
    }

    if (e.history && e.history.length > 0) {
      lines.push(`- Histórico de Revisões e Versões Anteriores:`);
      e.history.forEach((h, hIdx) => {
        const dateStr = h.timestamp ? h.timestamp.split('T')[0] : 'Data';
        const parts: string[] = [];
        if (h.previousData?.description) parts.push(`Descrição anterior: "${h.previousData.description}"`);
        if (h.previousData?.period) parts.push(`Datação/Período anterior: "${h.previousData.period}"`);
        if (h.previousData?.status) parts.push(`Status anterior: ${h.previousData.status}`);
        if (h.previousData?.subDetails?.role) parts.push(`Papel/Título anterior: "${h.previousData.subDetails.role}"`);
        if (h.previousData?.subDetails?.powers && Array.isArray(h.previousData.subDetails.powers) && h.previousData.subDetails.powers.length > 0) {
          parts.push(`Poderes anteriores: [${h.previousData.subDetails.powers.join(', ')}]`);
        }
        const detailStr = parts.length > 0 ? ` [${parts.join(' | ')}]` : '';
        lines.push(`  * [Versão Antiga #${hIdx + 1} - ${dateStr}]: ${h.note || 'Alteração'}${detailStr}`);
      });
      lines.push(`  * NOTA DE PREVALÊNCIA: A informação atual e válida é a descrita nos campos principais acima. As versões antigas são registros históricos mantidos para rastreabilidade.`);
    }

    return lines.filter(Boolean).join('\n');
  }).join('\n\n--------------------\n\n');
}

/**
 * Robust call to Gemini with automatic multi-model fallback and backoff retry.
 */
async function callGeminiWithFallback(prompt: string, systemInstruction: string = SYSTEM_INSTRUCTION) {
  if (!ai) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini Engine] Trying model "${model}" (attempt ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        console.log(`[Gemini Engine] Successfully answered using model "${model}".`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = (err?.message || String(err)).toLowerCase();
        const isUnavailableOrOverloaded =
          errStr.includes('503') ||
          errStr.includes('unavailable') ||
          errStr.includes('high demand') ||
          errStr.includes('overloaded') ||
          errStr.includes('resource_exhausted') ||
          errStr.includes('429') ||
          errStr.includes('404');

        if (isUnavailableOrOverloaded) {
          if (attempt === 1) {
            console.warn(`[Gemini Engine] Model "${model}" returned transient load. Retrying in 600ms...`);
            await new Promise(r => setTimeout(r, 600));
          } else {
            console.warn(`[Gemini Engine] Model "${model}" unavailable. Switching to fallback model...`);
            break;
          }
        } else {
          console.warn(`[Gemini Engine] Model "${model}" failed: ${sanitizeForLogs(err?.message)}. Trying fallback...`);
          break;
        }
      }
    }
  }

  throw lastError;
}

// ==================== MEMORY DATABASE ENDPOINTS ====================

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

// POST /api/memory - Create or update an entity in the database with strict versioning
app.post('/api/memory', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name || !payload.type) {
      return res.status(400).json({ success: false, error: 'Dados incompletos para cadastro.' });
    }

    // Un-tombstone if user explicitly saves/creates an entity with this name or ID
    if (payload.id) unrecordTombstone(payload.id);
    if (payload.name) unrecordTombstone(payload.name);

    const entities = readDatabase();
    const now = new Date().toISOString();
    let savedEntity: LoreEntity;

    // Strict matching: by ID if provided, otherwise by exact Name (case-insensitive)
    const existingIndex = payload.id
      ? entities.findIndex(e => e.id === payload.id)
      : entities.findIndex(e => e.name.trim().toLowerCase() === payload.name.trim().toLowerCase());

    if (existingIndex >= 0) {
      const existing = entities[existingIndex];
      // Only append to history if content actually changed
      const hasChanged =
        existing.description !== payload.description ||
        existing.period !== payload.period ||
        existing.status !== payload.status ||
        JSON.stringify(existing.subDetails || {}) !== JSON.stringify(payload.subDetails || {});

      const newHistoryItem = hasChanged
        ? {
            id: `v-${Date.now()}`,
            timestamp: now,
            note: payload.historyNote || `Atualização de ${existing.name}`,
            previousData: {
              name: existing.name,
              description: existing.description,
              period: existing.period,
              status: existing.status,
              subDetails: existing.subDetails,
            },
          }
        : null;

      savedEntity = {
        ...existing,
        ...payload,
        id: existing.id,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        history: newHistoryItem
          ? [newHistoryItem, ...(existing.history || [])]
          : existing.history || [],
      };
      entities[existingIndex] = savedEntity;
    } else {
      const newId = payload.id || `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
    console.log(`[Memory DB] Saved entity "${savedEntity.name}" (${savedEntity.type}) to database. Total: ${entities.length}.`);
    res.json({
      success: true,
      message: 'Salvo na memória.',
      entity: savedEntity,
      data: entities,
      count: entities.length,
    });
  } catch (err: any) {
    console.error('[POST /api/memory error]', err);
    res.status(500).json({ success: false, error: 'Erro ao persistir informação no banco.' });
  }
});

// POST /api/memory/sync - Bidirectional synchronization between client cache & server database
// Guarantees persistence even across new deploys or cold starts on Render, WITHOUT resurrecting deleted entities!
app.post('/api/memory/sync', (req, res) => {
  try {
    const { clientEntities } = req.body;
    let entities = readDatabase();
    const tombstones = readDeletedTombstones();

    if (!Array.isArray(clientEntities) || clientEntities.length === 0) {
      return res.json({ success: true, count: entities.length, data: entities });
    }

    let modified = false;
    for (const clientEnt of clientEntities) {
      if (!clientEnt || !clientEnt.name) continue;
      const cId = (clientEnt.id || '').trim().toLowerCase();
      const cName = (clientEnt.name || '').trim().toLowerCase();

      // STRICT RULE: If this entity was deleted, NEVER restore it!
      if (tombstones.has(cId) || tombstones.has(cName)) {
        continue;
      }

      const idx = entities.findIndex(
        e => (e.id && e.id === clientEnt.id) || e.name.trim().toLowerCase() === cName
      );
      if (idx === -1) {
        // Server database is missing this entity from client; restore it
        entities.push(clientEnt);
        modified = true;
      } else {
        // Entity exists on both; merge histories and keep newest updates
        const serverEnt = entities[idx];
        const clientTime = new Date(clientEnt.updatedAt || 0).getTime();
        const serverTime = new Date(serverEnt.updatedAt || 0).getTime();
        if (clientTime > serverTime) {
          const mergedHistories = [
            ...(clientEnt.history || []),
            ...(serverEnt.history || []).filter(
              (sh: any) => !(clientEnt.history || []).some((ch: any) => ch.id === sh.id)
            ),
          ];
          entities[idx] = {
            ...serverEnt,
            ...clientEnt,
            id: serverEnt.id,
            history: mergedHistories,
          };
          modified = true;
        }
      }
    }

    if (modified) {
      writeDatabase(entities);
      console.log(`[Memory DB Sync] Merged client entities. Total in database: ${entities.length}.`);
    }

    res.json({ success: true, count: entities.length, data: entities });
  } catch (err: any) {
    console.error('[POST /api/memory/sync error]', err);
    res.status(500).json({ success: false, error: 'Erro ao sincronizar banco de dados.' });
  }
});

// DELETE /api/memory/:id - Delete an entity permanently from database and register tombstone
app.delete('/api/memory/:id', (req, res) => {
  try {
    const rawId = req.params.id || '';
    const nameQuery = typeof req.query.name === 'string' ? req.query.name : '';
    const nameBody = req.body && typeof req.body.name === 'string' ? req.body.name : '';

    const targetId = rawId.trim();
    const decodedId = decodeURIComponent(rawId).trim();
    const targetName = (nameQuery || nameBody).trim();
    const decodedName = decodeURIComponent(targetName).trim();

    const identifiersToTombstone = new Set<string>();
    if (targetId) identifiersToTombstone.add(targetId.toLowerCase());
    if (decodedId) identifiersToTombstone.add(decodedId.toLowerCase());
    if (targetName) identifiersToTombstone.add(targetName.toLowerCase());
    if (decodedName) identifiersToTombstone.add(decodedName.toLowerCase());

    let entities = readDatabase();

    // Match entities to delete by exact ID or exact Name (case-insensitive & trimmed)
    const toDelete = entities.filter(e => {
      const eId = (e.id || '').trim().toLowerCase();
      const eName = (e.name || '').trim().toLowerCase();
      return (
        (targetId && (eId === targetId.toLowerCase() || eName === targetId.toLowerCase())) ||
        (decodedId && (eId === decodedId.toLowerCase() || eName === decodedId.toLowerCase())) ||
        (targetName && (eName === targetName.toLowerCase() || eId === targetName.toLowerCase())) ||
        (decodedName && (eName === decodedName.toLowerCase() || eId === decodedName.toLowerCase()))
      );
    });

    // Record all IDs and names in tombstones
    toDelete.forEach(e => {
      if (e.id) identifiersToTombstone.add(e.id.trim().toLowerCase());
      if (e.name) identifiersToTombstone.add(e.name.trim().toLowerCase());
    });

    recordDeletedIds(Array.from(identifiersToTombstone));

    // Filter out from active entities
    entities = entities.filter(e => {
      const eId = (e.id || '').trim().toLowerCase();
      const eName = (e.name || '').trim().toLowerCase();
      return !identifiersToTombstone.has(eId) && !identifiersToTombstone.has(eName);
    });

    writeDatabase(entities);
    console.log(`[Memory DB] Permanently deleted "${decodedName || decodedId}". Remaining: ${entities.length}.`);
    res.json({ success: true, count: entities.length, data: entities });
  } catch (err: any) {
    console.error('[DELETE /api/memory error]', err);
    res.status(500).json({ success: false, error: 'Erro ao excluir registro.' });
  }
});

// POST /api/memory/clear - Clear all entities from database
app.post('/api/memory/clear', (req, res) => {
  try {
    const entities = readDatabase();
    recordDeletedEntities(entities);
    writeDatabase([]);
    console.log('[Memory DB] Database cleared completely.');
    res.json({ success: true, count: 0, data: [] });
  } catch (err: any) {
    console.error('[POST /api/memory/clear error]', err);
    res.status(500).json({ success: false, error: 'Erro ao limpar banco de dados.' });
  }
});

// POST /api/memory/reset - Restore initial canonical seed respecting tombstones
app.post('/api/memory/reset', (req, res) => {
  try {
    const tombstones = readDeletedTombstones();
    const cleanEntities = (currentSeedEntities || []).filter(
      e => !tombstones.has(e.id?.trim().toLowerCase()) && !tombstones.has(e.name?.trim().toLowerCase())
    );
    writeDatabase(cleanEntities);
    console.log('[Memory DB] Database reset to canonical seed lore respecting deletions.');
    res.json({ success: true, count: cleanEntities.length, data: cleanEntities });
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

// ==================== CHAT & AI REASONING ENDPOINT ====================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory, simulateError, mode = 'conhecimento' } = req.body;
    const simulateErrorHeader = req.headers['x-simulate-gemini-error'] === 'true';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida.' });
    }

    const isAssistantMode = mode === 'assistente';
    const isProducerMode = mode === 'produtor';

    let modeTitle = 'MODO CONHECIMENTO';
    if (isAssistantMode) modeTitle = 'MODO ASSISTENTE DE CRIAÇÃO E CONTINUIDADE';
    else if (isProducerMode) modeTitle = 'MODO PRODUTOR DE FRANQUIA E CONTINUIDADE AUDIOVISUAL';

    // Step 1: Read memory independently from database
    const allEntities = readDatabase();

    // Step 2: Intelligent retrieval of relevant entities & relationships
    const { topEntities } = retrieveRelevantMemory(message, conversationHistory, allEntities, 8);

    // If simulating Gemini failure (for automated testing)
    if (simulateError || simulateErrorHeader) {
      console.warn('[Gemini Simulation Log] Simulating failure as requested.');
      return res.json({
        success: false,
        error: 'ai_unavailable',
        reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
      });
    }

    // Step 3: Build Macro Universe Catalog
    const universeCatalog = allEntities.length > 0
      ? allEntities.map(e => `• ${e.name} [Tipo: ${e.type}, Status: ${e.status}${e.period ? `, Período: ${e.period}` : ''}]`).join('\n')
      : 'Nenhuma entidade cadastrada ainda na memória da LOH.';

    // Step 4: Build Detailed Context for Retrieved Entities
    const detailedContext = formatEntityContext(topEntities, allEntities);

    // Step 5: Format Conversation History
    const historyPrompt = (conversationHistory || [])
      .slice(-6)
      .map((h: any) => `${h.sender === 'user' ? 'Marcos' : 'LOH AI'}: ${h.content}`)
      .join('\n');

    // Step 6: Construct the Full Reasoning Prompt for Gemini based on selected mode
    const finalPrompt = `ÍNDICE GERAL DE REGISTROS NA MEMÓRIA DA LOH:
${universeCatalog}

--------------------------------------------------
REGISTROS DETALHADOS RECUPERADOS DA MEMÓRIA PARA ESTA ANÁLISE:
${detailedContext}
--------------------------------------------------

HISTÓRICO RECENTE DO DIÁLOGO:
${historyPrompt || 'Início da conversa.'}

SOLICITAÇÃO DE MARCOS (${modeTitle}):
"${message}"

${isProducerMode ? `
DIRETRIZES DE EXECUÇÃO PARA O MODO PRODUTOR:
1. Você é o produtor executivo, showrunner e guardião da continuidade das produções audiovisuais da League Ofter High (LOH).
2. NENHUMA PRODUÇÃO EM ISOLAMENTO: Sempre cruze com a linha do tempo, personagens vivos/disponíveis no período, eventos anteriores e posteriores, e consequências para futuras produções da franquia.
3. DESENVOLVIMENTO PROGRESSIVO: Nunca despeje uma produção inteira pronta de uma vez só! Converse e desenvolva progressivamente com Marcos (1. Conceito -> 2. Posicionamento na cronologia -> 3. Elenco -> 4. História -> 5. Estrutura -> 6. Continuidade).
4. VERIFICAÇÃO RIGOROSA DE CONTINUIDADE: Se houver qualquer inconsistência com a cronologia ou cânone da LOH, aponte imediatamente com franqueza ("Marcos, temos um problema de continuidade: ...") e forneça opções de solução concretas com sua recomendação justificada.
5. STATUS CLARO: Identifique propostas como [PROPOSTA] ou rascunhos como [DRAFT]. Nada vira CANON automaticamente sem a confirmação de Marcos.
6. OPINIÃO SINCERA: Dê sua opinião sincera de showrunner (o que funciona, o que enfraquece a história, se um filme deveria vir antes ou depois, se a trama está sobrecarregada).
7. Mantenha um diálogo natural, ágil e criativo, sem parecer um formulário rígido.
` : isAssistantMode ? `
DIRETRIZES DE EXECUÇÃO PARA O MODO ASSISTENTE:
1. Atue como parceiro sincero, crítico e analítico de criação de Marcos. Não concorde automaticamente.
2. AUDITORIA DE CONTINUIDADE: Se a proposta dele entrar em conflito com a memória (cronologia, localização, personagens vivos/mortos, poderes, eventos imutáveis), aponte o conflito imediatamente e com franqueza ("Marcos, tem um problema aqui: ...").
3. PROPOSTA DE SOLUÇÕES: Sempre ofereça de 1 a 3 soluções concretas para contornar o problema e manter a lore sólida.
4. COMBATES/VERSUS: Se for uma pergunta de luta, analise os atributos reais da memória, dê um veredito concreto com justificativa e probabilidade estimada (ex: 7/10 para Fulano). Se faltarem dados essenciais, declare honestamente.
5. SUGESTÕES CRIATIVAS: Identifique qualquer ideia nova como [SUGESTÃO], deixando claro que a decisão final cabe a Marcos.
` : `
INSTRUÇÕES DE EXECUÇÃO PARA A SUA RESPOSTA:
1. Raciocine sobre a solicitação do usuário utilizando os fatos e relações fornecidos na memória acima.
2. NUNCA faça uma cópia bruta dos registros. Produza uma resposta articulada, fluida e natural.
3. Adapte-se ao estilo solicitado (infantil, detalhado, história, linha do tempo, quiz, etc.).
4. NUNCA invente fatos como se fossem cânone. Se a memória não tiver informações suficientes, explique com naturalidade que ainda não foram registradas.
`}
`;

    // Step 7: Call Gemini API with automatic fallback and retry
    try {
      let activeInstruction = SYSTEM_INSTRUCTION;
      if (isProducerMode) {
        activeInstruction = PRODUCER_SYSTEM_INSTRUCTION;
      } else if (isAssistantMode) {
        activeInstruction = ASSISTANT_SYSTEM_INSTRUCTION;
      }

      const response = await callGeminiWithFallback(finalPrompt, activeInstruction);
      let replyText = response.text || 'Não consegui formular uma resposta no momento. Tente novamente.';
      let memoryAction: any = undefined;

      // Extract structured memory action block if present
      const actionBlockRegex = /```(?:loh-action|json)?\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})\s*```/i;
      const match = replyText.match(actionBlockRegex);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          const targetEntity = allEntities.find(
            e =>
              (parsed.entityId && e.id === parsed.entityId) ||
              (parsed.entityName && e.name.toLowerCase() === parsed.entityName.toLowerCase()) ||
              (parsed.entityName && e.name.toLowerCase().includes(parsed.entityName.toLowerCase())) ||
              (parsed.entityName && parsed.entityName.toLowerCase().includes(e.name.toLowerCase()))
          );

          memoryAction = {
            type:
              parsed.action === 'delete_paragraph'
                ? 'delete_paragraph'
                : parsed.action === 'delete_entity'
                ? 'delete'
                : parsed.action === 'add_trajectory'
                ? 'trajectory'
                : parsed.action === 'add_info'
                ? 'add'
                : 'modify',
            entityName: targetEntity?.name || parsed.entityName || 'Registro da LOH',
            entityId: targetEntity?.id || parsed.entityId,
            summary: parsed.summary || 'Alteração solicitada na memória',
            targetSnippet: parsed.targetSnippet || '',
            newDescription: parsed.newDescription || '',
            newTrajectory: parsed.newTrajectory,
            addedPower: parsed.addedPower,
            applied: false,
          };

          // Clean out the raw code block so the clean interactive card renders in the UI
          replyText = replyText.replace(actionBlockRegex, '').trim();
        } catch (e) {
          console.warn('[Server] Could not parse memory action JSON block:', e);
        }
      }

      return res.json({
        success: true,
        reply: replyText,
        referencedEntityIds: topEntities.map(e => e.id),
        memoryAction,
        mode,
      });
    } catch (geminiError: any) {
      console.error('[Gemini API Server Error]:', sanitizeForLogs(geminiError?.message || 'All models failed'));
      return res.json({
        success: false,
        error: 'ai_unavailable',
        reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
      });
    }
  } catch (error: any) {
    console.error('[LOH AI Server Internal Error]:', sanitizeForLogs(error?.message || 'Internal server error'));
    res.status(500).json({
      success: false,
      error: 'server_error',
      reply: 'Não consegui responder agora. Tente novamente em alguns segundos.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distDir, 'index.html'));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RENDER) ||
    process.env.RENDER === 'true' ||
    (hasDistBuild && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    console.log('[LOH AI Server] Serving in PRODUCTION mode (Pure static assets from /dist, no Vite HMR/WebSocket).');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.log('[LOH AI Server] Serving in DEVELOPMENT mode (Vite middleware mounted).');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`LOH AI server running on port ${PORT}. Active candidate models: [${CANDIDATE_MODELS.join(', ')}]`);
  });
}

startServer();
