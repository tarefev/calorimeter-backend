import crypto from "crypto";

// Normalize upsert array: ensure each item has id (generate if missing)
export function normalizeUpsert<T extends { id?: string }>(
  items: T[] | undefined
) {
  if (!items) return [] as T[];
  return items.map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() }));
}

// Split payload into create/update/delete sets for DB operations
export function splitPatchPayload<T extends { id?: string }>(
  payload: { upsert?: T[]; delete?: string[] } | undefined
) {
  if (!payload) return { upsert: [], deleteIds: [] as string[] };
  const upsert = normalizeUpsert(payload.upsert ?? []);
  const deleteIds = payload.delete ?? [];
  return { upsert, deleteIds };
}
