// src/api.ts
// Централизованный слой общения с backend.
// BASE_URL = VITE_API_BASE (например, https://pushline-server.onrender.com/api)
// или локально http://localhost:3001/api

const BASE_URL =
  import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

console.log("[Pushline] API BASE_URL =", BASE_URL);

// ===== Auth headers (PIN/токен задел) =====

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("pushlineToken");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// ===== Базовые HTTP-helpers =====

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error("GET " + path + " failed " + res.status);
  }
  return res.json();
}

async function apiPost<T>(
  path: string,
  body: any,
  opts?: { formData?: boolean }
): Promise<T> {
  let fetchOpts: RequestInit;

  if (opts?.formData) {
    // body = FormData
    fetchOpts = {
      method: "POST",
      headers: {
        ...authHeaders(),
        // не ставим Content-Type вручную, браузер сам
      },
      body,
    };
  } else {
    fetchOpts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body ?? {}),
    };
  }

  const res = await fetch(BASE_URL + path, fetchOpts);
  if (!res.ok) {
    throw new Error("POST " + path + " failed " + res.status);
  }
  return res.json();
}

async function apiPatch<T>(path: string, body: any): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw new Error("PATCH " + path + " failed " + res.status);
  }
  return res.json();
}

// ===== Types (синхронизированы с backend/index.ts) =====

export type InboxHistoryItem = {
  who: "client" | "operator";
  text: string;
  at: string; // ISO
};

export type InboxMsg = {
  id: string;
  from: string;
  topic: string;
  text: string;
  at: string;
  status: "new" | "routed" | "replied";
  history: InboxHistoryItem[];
  assignedTo?: string;
  unread?: boolean;
};

export type Operator = {
  id: string;
  name: string;
  role: "admin" | "operator";
  online: boolean;
  activeChats: number;
  load: number; // 0..100
  e164?: string; // реальное поле в backend
  phone?: string; // оставлено для совместимости, если где-то так зовётся
};

export type BroadcastPlan = {
  total: number;
  limit: number;
  waves: number;
  lastWaveSize: number;
  avgDelay: number;
  avgWaveMs: number;
  approxTotalMs: number;
};

export type BroadcastStatus = {
  ok: boolean;
  status: "idle" | "running" | "paused" | "done";
  sent: number;
  errors: number;
  total: number;
  startedAt: number | null;
  wavesTotal: number;
  waveIndex: number;
  cooldownUntil: number | null;
  mode: "image" | "video" | "both" | "text";
  plan: BroadcastPlan;
};

export type TemplatesResponse = {
  ok: boolean;
  templates: string[];
};

export type FireBroadcastResponse = {
  ok: boolean;
  started: boolean;
  plan: BroadcastPlan;
};

export type MediaItem = {
  filename: string;
  webUrl: string;
  path?: string;
};

export type MediaInfo = {
  ok: boolean;
  image: MediaItem | null;
  images: MediaItem[];
  video: MediaItem | null;
};

export type HistoryRow = {
  timestamp: string;
  phone: string;
  name: string;
  status: string;
  details: string;
};

// ===== HEALTH =====

export function apiHealth() {
  // BASE_URL уже включает /api, так что /health -> /api/health
  return apiGet<{ ok: boolean }>("/health");
}

// ===== INBOX =====

export function getInbox() {
  return apiGet<InboxMsg[]>("/inbox");
}

export function makeFakeInboxMsg() {
  return apiPost<InboxMsg>("/inbox/fake", {});
}

export function sendReplyToClient(id: string, text: string) {
  // PATCH /inbox/:id/reply { text }
  return apiPatch<InboxMsg>(`/inbox/${id}/reply`, { text });
}

export async function apiAssignChatToOperator(messageId: string, operatorId: string) {
  // PATCH /inbox/:id/assign { operatorId }
  return apiPatch<{
    ok: true;
    message: InboxMsg;
    operator: Operator;
  }>(`/inbox/${messageId}/assign`, { operatorId });
}

// старое имя (оставляем для совместимости)
export const assignChatToOperator = apiAssignChatToOperator;

export function markChatRead(messageId: string) {
  return apiPatch<{ ok: true }>(`/inbox/${messageId}/read`, {});
}

// ===== OPERATORS =====

export function getOperators() {
  return apiGet<Operator[]>("/operators");
}

export function patchOperator(
  operatorId: string,
  data: Partial<Pick<Operator, "online" | "activeChats" | "load" | "name" | "role">>
) {
  // PATCH /operators/:id { ... }
  return apiPatch<Operator>(`/operators/${operatorId}`, data);
}

// alias, если где-то используется именно apiPatchOperator
export const apiPatchOperator = patchOperator;

// ===== MEDIA (картинки/видео для рассылки) =====

export function getBroadcastMedia() {
  // GET /broadcast/media
  return apiGet<MediaInfo>("/broadcast/media");
}

export function clearBroadcastMedia() {
  // POST /broadcast/media/clear {}
  return apiPost<{ ok: boolean }>("/broadcast/media/clear", {});
}

// ===== CONTACTS / TEMPLATES UPLOAD =====
// ВАЖНО: backend-роуты: /api/contacts/upload и /api/templates/upload
// BASE_URL уже содержит /api, поэтому тут путь именно /contacts/upload и /templates/upload.

export function uploadContactsFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{
    ok: true;
    rows: number;
    totalContacts: number;
    plan: BroadcastPlan;
  }>("/contacts/upload", form, { formData: true });
}

export function uploadTemplatesFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{
    ok: true;
    templates: number;
    totalTemplates: number;
    plan: BroadcastPlan;
  }>("/templates/upload", form, { formData: true });
}

export function fetchTemplatesActive() {
  return apiGet<TemplatesResponse>("/templates");
}

// ===== Загрузка медиа (image/video) =====

export function uploadImageFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{
    ok: boolean;
    type: "image";
    filename: string;
    size: number;
  }>("/upload-media/image", form, { formData: true });
}

export function uploadVideoFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{
    ok: boolean;
    type: "video";
    filename: string;
    size: number;
  }>("/upload-media/video", form, { formData: true });
}

// ===== AUTO-REPLIES (автоответы) =====

export function uploadAutorepliesFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{
    ok: boolean;
    counts: { thanks: number; negative: number };
  }>("/autoreplies/upload", form, { formData: true });
}

export function fetchAutorepliesInfo() {
  return apiGet<{
    ok: boolean;
    counts: { thanks: number; negative: number };
    preview: { thanks: string[]; negative: string[] };
  }>("/autoreplies");
}

// ===== BROADCAST (рассылка) =====

export function getBroadcastStatusApi() {
  return apiGet<BroadcastStatus>("/broadcast/status");
}

export function getBroadcastPlanApi() {
  return apiGet<{ ok: boolean; plan: BroadcastPlan }>("/broadcast/plan");
}

// Запуск волны (ручной wave)
export function waveBroadcast(adminPin: string, mode: "image" | "video" | "both" | "text") {
  return apiPost<BroadcastStatus>("/broadcast/wave", {
    adminPin,
    mode,
  });
}

// Полный автозапуск (fire + авто-волны с cooldown’ом)
export function fireBroadcast(adminPin: string, mode: "image" | "video" | "both" | "text" = "image") {
  // /broadcast/fire { adminPin, mode }, PIN-проверка уже есть на сервере
  return apiPost<FireBroadcastResponse>("/broadcast/fire", {
    adminPin,
    mode,
  });
}

export function pauseBroadcast() {
  return apiPost<BroadcastStatus>("/broadcast/pause", {});
}

export function resetBroadcast() {
  return apiPost<BroadcastStatus>("/broadcast/reset", {});
}

export function stopBroadcast() {
  return apiPost<BroadcastStatus>("/broadcast/stop", {});
}

// Тестовая отправка 1 контакту
export function testSendBroadcast(
  to: string,
  text: string,
  mode: "image" | "video" | "both" | "text" = "image"
) {
  // backend: /broadcast/test-direct { to, text, mode }
  return apiPost<any>("/broadcast/test-direct", { to, text, mode });
}

// ===== История / отчёты =====

export function getBroadcastLast(limit = 500) {
  // GET /broadcast/last?limit=...
  return apiGet<{
    ok: boolean;
    count: number;
    data: HistoryRow[];
  }>(`/broadcast/last?limit=${encodeURIComponent(String(limit))}`);
}

export function getBroadcastLastWave() {
  // GET /broadcast/last-wave
  return apiGet<{
    ok: boolean;
    total: number;
    phones: string[];
    records: HistoryRow[];
  }>("/broadcast/last-wave");
}

export function getBroadcastSentCache() {
  // GET /broadcast/sent-cache
  return apiGet<{
    ok: boolean;
    total: number;
    phones: string[];
  }>("/broadcast/sent-cache");
}
