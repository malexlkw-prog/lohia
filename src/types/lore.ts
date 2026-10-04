export type EntityType = 
  | 'personagem'
  | 'evento'
  | 'local'
  | 'organizacao'
  | 'poder'
  | 'obra'
  | 'outro';

export type CanonStatus = 'canon' | 'rascunho' | 'antiga' | 'conflitante';

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
  };
  relatedEntityIds: string[];
  history: VersionRecord[];
  createdAt: string;
  updatedAt: string;
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referencedEntityIds?: string[];
  contradictionWarning?: Contradiction;
  isSuggestion?: boolean;
  isConnectionError?: boolean;
  lastFailedQuery?: string;
}
