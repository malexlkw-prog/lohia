export type EntityType = 
  | 'personagem'
  | 'evento'
  | 'producao'
  | 'filme'
  | 'serie'
  | 'webserie'
  | 'episodio'
  | 'local'
  | 'organizacao'
  | 'poder'
  | 'lore'
  | 'ideia'
  | 'obra'
  | 'outro';

export type CanonStatus = 'canon' | 'rascunho' | 'antiga' | 'conflitante' | 'proposta';

export interface VersionRecord {
  id: string;
  timestamp: string;
  note: string;
  previousData: {
    description?: string;
    period?: string;
    status?: CanonStatus;
    [key: string]: any;
  };
}

export interface CharacterMilestone {
  id: string;
  date: string; // e.g. "5 anos de idade", "100 a.C.", "Ano 2024", "Pós-Guerra de Ogon"
  title: string;
  description: string;
  impact?: string;
  relatedEntities?: string[];
  createdAt?: string;
}

export interface LoreEntity {
  id: string;
  name: string;
  type: EntityType;
  status: CanonStatus;
  description: string;
  period?: string; // e.g. "200 a.C.", "Era de Ogon", "Século IV"
  yearOrder?: number; // Numeric sequence for chronological sorting
  subDetails?: {
    role?: string;
    aliases?: string[];
    species?: string;
    affiliation?: string[];
    powers?: string[];
    participants?: string[];
    consequences?: string;
    locations?: string[];
    keyFigures?: string[];
    previousEvents?: string[];
    nextEvents?: string[];
    founders?: string[];
    classification?: string;
    workType?: string;
    notes?: string;
    trajectory?: CharacterMilestone[];
  };
  relatedEntityIds: string[];
  history: VersionRecord[];
  historyNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryActionRecord {
  type: 'modify' | 'delete' | 'add' | 'trajectory' | 'delete_paragraph';
  entityName: string;
  entityId?: string;
  summary: string;
  beforeSnippet?: string;
  afterSnippet?: string;
  targetSnippet?: string;
  newDescription?: string;
  newTrajectory?: {
    date: string;
    title: string;
    description: string;
    impact?: string;
  };
  addedPower?: string;
  applied?: boolean;
  rejected?: boolean;
}

export interface Contradiction {
  id: string;
  title: string;
  entityId: string;
  entityName: string;
  details: string;
  versionA: string;
  versionB: string;
  resolved: boolean;
  chosenVersion?: 'A' | 'B' | 'custom';
}

export type AIMode = 'conhecimento' | 'assistente' | 'produtor';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AIMode;
  referencedEntityIds?: string[];
  contradictionWarning?: Contradiction;
  memoryAction?: MemoryActionRecord;
  isSuggestion?: boolean;
  isConnectionError?: boolean;
  lastFailedQuery?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  mode: AIMode;
}
