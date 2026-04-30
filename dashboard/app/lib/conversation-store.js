"use client";

const STORAGE_PREFIX = "helix_conversations_v1";
const MAX_STORAGE_BYTES = 4_500_000;

function storageKey(mode, brandId) {
  const scope = mode === "free" ? "free" : `brand_${brandId || "none"}`;
  return `${STORAGE_PREFIX}_${scope}`;
}

function readAll(mode, brandId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(mode, brandId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(mode, brandId, conversations) {
  if (typeof window === "undefined") return;
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  );
  let serialized = JSON.stringify(sorted);

  while (serialized.length > MAX_STORAGE_BYTES && sorted.length > 1) {
    sorted.pop();
    serialized = JSON.stringify(sorted);
  }

  try {
    window.localStorage.setItem(storageKey(mode, brandId), serialized);
  } catch (err) {
    if (sorted.length > 1) {
      sorted.pop();
      try {
        window.localStorage.setItem(
          storageKey(mode, brandId),
          JSON.stringify(sorted)
        );
      } catch {}
    }
  }
}

function generateId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `conv_${Date.now().toString(36)}_${random}`;
}

export function generateTitle(firstUserMessage) {
  if (!firstUserMessage) return "Percakapan baru";
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 50) return trimmed;
  const cut = trimmed.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function listConversations(mode, brandId) {
  return readAll(mode, brandId);
}

export function getConversation(id, mode, brandId) {
  return readAll(mode, brandId).find((c) => c.id === id) || null;
}

export function createConversation(mode, brandId, firstUserMessage) {
  const now = new Date().toISOString();
  const conversation = {
    id: generateId(),
    title: generateTitle(firstUserMessage),
    created_at: now,
    updated_at: now,
    messages: [],
  };
  const all = readAll(mode, brandId);
  writeAll(mode, brandId, [conversation, ...all]);
  return conversation;
}

export function updateConversation(id, mode, brandId, messages) {
  const all = readAll(mode, brandId);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = {
    ...all[idx],
    messages,
    updated_at: new Date().toISOString(),
  };
  if (
    (!all[idx].title || all[idx].title === "Percakapan baru") &&
    messages.length > 0
  ) {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) updated.title = generateTitle(firstUser.content);
  }
  all[idx] = updated;
  writeAll(mode, brandId, all);
  return updated;
}

export function deleteConversation(id, mode, brandId) {
  const all = readAll(mode, brandId);
  const filtered = all.filter((c) => c.id !== id);
  writeAll(mode, brandId, filtered);
}

export function clearAllConversations(mode, brandId) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(mode, brandId));
}

export function groupByDate(conversations) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfLast7 = new Date(startOfToday);
  startOfLast7.setDate(startOfLast7.getDate() - 7);
  const startOfLast30 = new Date(startOfToday);
  startOfLast30.setDate(startOfLast30.getDate() - 30);

  const groups = {
    today: [],
    yesterday: [],
    last7: [],
    last30: [],
    older: [],
  };

  for (const conv of conversations) {
    const updated = new Date(conv.updated_at);
    if (updated >= startOfToday) groups.today.push(conv);
    else if (updated >= startOfYesterday) groups.yesterday.push(conv);
    else if (updated >= startOfLast7) groups.last7.push(conv);
    else if (updated >= startOfLast30) groups.last30.push(conv);
    else groups.older.push(conv);
  }

  return groups;
}
