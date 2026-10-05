import { LoreEntity, Contradiction } from '../types/lore';
import { SEED_LORE_ENTITIES } from '../data/seedLore';

const STORAGE_KEY = 'loh_ai_universe_memory_v1';
const DELETED_STORAGE_KEY = 'loh_ai_deleted_ids_v1';

export function getLocalDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(s => String(s).toLowerCase()) : []);
  } catch (e) {
    return new Set();
  }
}

export function addLocalDeletedId(identifier: string): void {
  try {
    const set = getLocalDeletedIds();
    set.add(identifier.trim().toLowerCase());
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    // Non-fatal
  }
}

export function removeLocalDeletedId(identifier: string): void {
  try {
    const set = getLocalDeletedIds();
    set.delete(identifier.trim().toLowerCase());
    localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    // Non-fatal
  }
}

// Initial local storage fallback
export function getStoredEntitiesLocal(): LoreEntity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, '[]');
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEY, '[]');
      return [];
    }
    const deleted = getLocalDeletedIds();
    return parsed.filter(e => {
      const eId = (e.id || '').trim().toLowerCase();
      const eName = (e.name || '').trim().toLowerCase();
      return !deleted.has(eId) && !deleted.has(eName);
    });
  } catch (e) {
    console.error('Failed to load LOH memory from localStorage:', e);
    return [];
  }
}

export function saveEntitiesLocal(entities: LoreEntity[]): void {
  try {
    const deleted = getLocalDeletedIds();
    const clean = entities.filter(e => {
      const eId = (e.id || '').trim().toLowerCase();
      const eName = (e.name || '').trim().toLowerCase();
      return !deleted.has(eId) && !deleted.has(eName);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to save LOH memory locally:', e);
  }
}

/**
 * Clear all memory records from database and local storage
 */
export async function clearDatabaseMemory(): Promise<LoreEntity[]> {
  try {
    const current = getStoredEntitiesLocal();
    current.forEach(e => {
      if (e.id) addLocalDeletedId(e.id);
      if (e.name) addLocalDeletedId(e.name);
    });
    saveEntitiesLocal([]);
    const res = await fetch('/api/memory/clear', { method: 'POST' });
    if (res.ok) {
      return [];
    }
  } catch (err) {
    console.error('[Database clear error]', err);
  }
  saveEntitiesLocal([]);
  return [];
}

/**
 * Fetch memory directly from backend database
 */
export async function fetchEntitiesFromDatabase(): Promise<LoreEntity[]> {
  try {
    const res = await fetch('/api/memory');
    if (!res.ok) throw new Error('Falha ao consultar banco da LOH.');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const deleted = getLocalDeletedIds();
      const serverEntities: LoreEntity[] = json.data.filter((e: LoreEntity) => {
        const eId = (e.id || '').trim().toLowerCase();
        const eName = (e.name || '').trim().toLowerCase();
        return !deleted.has(eId) && !deleted.has(eName);
      });
      saveEntitiesLocal(serverEntities);
      return serverEntities;
    }
    return getStoredEntitiesLocal();
  } catch (err) {
    console.error('[Memory DB Sync Error, using local cache]', err);
    return getStoredEntitiesLocal();
  }
}

/**
 * Persist an entity directly to backend database
 */
export async function saveEntityToDatabase(
  entity: Omit<LoreEntity, 'id' | 'createdAt' | 'updatedAt' | 'history'> & { id?: string }
): Promise<{ entity: LoreEntity; updatedEntities: LoreEntity[] }> {
  // If previously deleted, un-record from tombstones
  if (entity.id) removeLocalDeletedId(entity.id);
  if (entity.name) removeLocalDeletedId(entity.name);

  try {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.entity) {
        const deleted = getLocalDeletedIds();
        const updatedList: LoreEntity[] = (Array.isArray(data.data)
          ? data.data
          : [data.entity, ...getStoredEntitiesLocal().filter(e => e.id !== data.entity.id)]
        ).filter((e: LoreEntity) => {
          const eId = (e.id || '').trim().toLowerCase();
          const eName = (e.name || '').trim().toLowerCase();
          return !deleted.has(eId) && !deleted.has(eName);
        });
        saveEntitiesLocal(updatedList);
        return { entity: data.entity, updatedEntities: updatedList };
      }
    }
  } catch (err) {
    console.error('[Database save error, falling back to local storage]', err);
  }

  // Local fallback if server unreachable
  const entities = getStoredEntitiesLocal();
  const now = new Date().toISOString();
  const existingIndex = entity.id
    ? entities.findIndex(e => e.id === entity.id)
    : entities.findIndex(e => e.name.trim().toLowerCase() === entity.name.trim().toLowerCase());

  if (existingIndex >= 0) {
    const existing = entities[existingIndex];
    const newHistoryItem = {
      id: `v-${Date.now()}`,
      timestamp: now,
      note: `Atualização de ${existing.name}`,
      previousData: {
        name: existing.name,
        description: existing.description,
        period: existing.period,
        status: existing.status,
        subDetails: existing.subDetails,
      },
    };
    const updatedEntity: LoreEntity = {
      ...existing,
      ...entity,
      id: existing.id,
      updatedAt: now,
      history: [newHistoryItem, ...(existing.history || [])],
    };
    entities[existingIndex] = updatedEntity;
    saveEntitiesLocal(entities);
    return { entity: updatedEntity, updatedEntities: entities };
  }

  const newId = entity.id || `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newEntity: LoreEntity = {
    ...entity,
    id: newId,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  const updatedEntities = [newEntity, ...entities];
  saveEntitiesLocal(updatedEntities);
  return { entity: newEntity, updatedEntities };
}

/**
 * Delete an entity permanently from the database and local storage
 */
export async function deleteEntityFromDatabase(id: string, name?: string): Promise<LoreEntity[]> {
  // 1. Immediately record in local tombstone registry so it can NEVER resurrect
  if (id) addLocalDeletedId(id);
  if (name) addLocalDeletedId(name);

  // 2. Remove from local storage immediately so UI never flashes back
  const currentLocal = getStoredEntitiesLocal();
  const matched = currentLocal.find(
    e => (id && e.id === id) || 
         (name && e.name.trim().toLowerCase() === name.trim().toLowerCase()) ||
         (id && e.name.trim().toLowerCase() === id.trim().toLowerCase())
  );
  if (matched) {
    if (matched.id) addLocalDeletedId(matched.id);
    if (matched.name) addLocalDeletedId(matched.name);
  }
  const remaining = currentLocal.filter(e => {
    const eId = (e.id || '').trim().toLowerCase();
    const eName = (e.name || '').trim().toLowerCase();
    if (id && (eId === id.trim().toLowerCase() || eName === id.trim().toLowerCase())) return false;
    if (name && (eName === name.trim().toLowerCase() || eId === name.trim().toLowerCase())) return false;
    return true;
  });
  saveEntitiesLocal(remaining);

  // 3. Delete from backend persistent database
  try {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const res = await fetch(`/api/memory/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const deleted = getLocalDeletedIds();
        const serverFiltered = data.data.filter((e: LoreEntity) => {
          const eId = (e.id || '').trim().toLowerCase();
          const eName = (e.name || '').trim().toLowerCase();
          return !deleted.has(eId) && !deleted.has(eName);
        });
        saveEntitiesLocal(serverFiltered);
        return serverFiltered;
      }
    }
  } catch (err) {
    console.error('[Database delete error]', err);
  }

  return remaining;
}

/**
 * Reset database to canonical seed
 */
export async function resetDatabaseMemory(): Promise<LoreEntity[]> {
  try {
    const res = await fetch('/api/memory/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        saveEntitiesLocal(data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.error('[Database reset error]', err);
  }
  saveEntitiesLocal(SEED_LORE_ENTITIES);
  return SEED_LORE_ENTITIES;
}

/**
 * Import database from JSON array
 */
export async function importDatabaseMemory(entities: LoreEntity[]): Promise<LoreEntity[]> {
  try {
    const res = await fetch('/api/memory/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entities }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        saveEntitiesLocal(data.data);
        return data.data;
      }
    }
  } catch (err) {
    console.error('[Database import error]', err);
  }
  saveEntitiesLocal(entities);
  return entities;
}

/**
 * Contradiction Scanner:
 * Discovers conflicting entities or unresolved timeline clashes.
 */
export function detectContradictions(entities: LoreEntity[]): Contradiction[] {
  const contradictions: Contradiction[] = [];
  for (const ent of entities) {
    if (ent.status === 'conflitante') {
      contradictions.push({
        id: `conflict-${ent.id}`,
        title: `Contradição em: ${ent.name}`,
        entityId: ent.id,
        entityName: ent.name,
        details: ent.subDetails?.notes || `Existem registros conflitantes para ${ent.name}.`,
        versionA: ent.period?.includes('Registro A')
          ? '8 anos após a Destruição de Ogon (-192 a.C.)'
          : 'Versão Canônica Registrada',
        versionB: ent.period?.includes('Registro B')
          ? '110 anos após a Destruição de Ogon (-90 a.C.)'
          : 'Versão Alternativa dos Manuscritos',
        resolved: false,
      });
    }

    if (ent.type === 'evento' && ent.yearOrder !== undefined) {
      if (ent.description.toLowerCase().includes('após a destruição de ogon') && ent.yearOrder < -200) {
        contradictions.push({
          id: `conflict-timeline-${ent.id}`,
          title: `Anomalia Temporal: ${ent.name}`,
          entityId: ent.id,
          entityName: ent.name,
          details: `O evento afirma ter ocorrido após a Destruição de Ogon (-200 a.C.), mas sua datação registrada é ${ent.period}.`,
          versionA: 'Pós-Destruição (posterior a 200 a.C.)',
          versionB: `Datação anterior registrada (${ent.period})`,
          resolved: false,
        });
      }
    }
  }
  return contradictions;
}
