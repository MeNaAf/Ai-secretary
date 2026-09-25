import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type SemanticMemory = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

const storagePath = resolve(process.env.AI_SECRETARY_DATA_DIR ?? "./data", "semantic-memory.json");
const memories = new Map<string, SemanticMemory>();

function hydrate() {
  try {
    if (!existsSync(storagePath)) return;
    const data = JSON.parse(readFileSync(storagePath, "utf8")) as SemanticMemory[];
    for (const item of data) memories.set(item.id, item);
  } catch {}
}

function persist() {
  try {
    mkdirSync(dirname(storagePath), { recursive: true });
    const temp = storagePath + ".tmp";
    writeFileSync(temp, JSON.stringify([...memories.values()]), "utf8");
    renameSync(temp, storagePath);
  } catch {}
}

hydrate();

export function remember(userId: string, text: string) {
  const normalized = text.trim();
  if (!normalized) return undefined;
  const existing = [...memories.values()].find(
    item => item.userId === userId && item.text.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const item: SemanticMemory = {
    id: crypto.randomUUID(),
    userId,
    text: normalized,
    createdAt: now,
    updatedAt: now
  };
  memories.set(item.id, item);
  persist();
  return item;
}

export function listRelevantMemories(userId: string, query: string, limit = 8) {
  const words = new Set(
    query.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2)
  );

  return [...memories.values()]
    .filter(item => item.userId === userId)
    .map(item => {
      const itemWords = new Set(item.text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
      let score = 0;
      for (const word of words) if (itemWords.has(word)) score++;
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, limit)
    .map(entry => entry.item);
}

export function listMemories(userId: string) {
  return [...memories.values()]
    .filter(item => item.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function forgetMemory(userId: string, id: string) {
  const item = memories.get(id);
  if (!item || item.userId !== userId) return false;
  memories.delete(id);
  persist();
  return true;
}
