// src/api.ts
// Централизованный слой общения с backend.
// Использует BASE_URL из .env (VITE_API_BASE), иначе localhost:3001.

const BASE_URL =
  import.meta.env.VITE_API_BASE || "http://localhost:3001";

// Заготовка под авторизацию через PIN/токен
// Заготовка под авторизацию через PIN/токен
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("pushlineToken");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

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
  phone?: string; // в файле operators.json называется phone
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
  // сервер сейчас отдает { ok, started, plan }
  started?: boolean;
  plan?: BroadcastPlan;
  // оставляем поле для совместимости, если где-то ждут relay
  relay?: any;
};

// ===== Concrete API calls =====

// INBOX
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

// --- универсальный экспорт для назначения оператора ---
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

// OPERATORS
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

// CONTACTS / TEMPLATES UPLOAD
export function uploadContactsFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{ ok: true; rows: number; totalContacts: number }>(
    "/upload-contacts",
    form,
    { formData: true }
  );
}

export function uploadTemplatesFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPost<{ ok: true; templates: number; totalTemplates: number }>(
    "/upload-templates",
    form,
    { formData: true }
  );
}

export function fetchTemplatesActive() {
  return apiGet<TemplatesResponse>("/templates");
}

// BROADCAST
export function fireBroadcast(adminPin: string) {
  // /broadcast/fire { adminPin }, PIN-проверка уже есть на сервере
  return apiPost<FireBroadcastResponse>("/broadcast/fire", {
    adminPin,
  });
}

export function pauseBroadcast() {
  return apiPost<BroadcastStatus>("/broadcast/pause", {});
}

export function resetBroadcast() {
  return apiPost<BroadcastStatus>("/broadcast/reset", {});
}

export function getBroadcastStatusApi() {
  return apiGet<BroadcastStatus>("/broadcast/status");
}

// Тестовая отправка
export function testSendBroadcast(to: string, name?: string) {
  // на backend маршрут называется /broadcast/test-direct
  // ответ проксируется из бота, поэтому тип оставляем any
  return apiPost<any>("/broadcast/test-direct", { to, name });
}
