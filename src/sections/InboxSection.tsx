import React from "react";
import type { InboxMsg as Msg, Operator } from "../api";

type InboxSectionProps = {
  inbox: Msg[];
  operators: Operator[];
  activeId: string | null;
  assigned: Record<string, string>;
  draft: string;
  active: Msg | null;

  setActiveId: (id: string) => void;
  setDraft: (v: string) => void;

  assignOperatorLocal: (msgId: string, operatorId: string) => void;
  assignChatToOperator: (opId: string) => void;
  autoAssignActiveChat: () => void;
  autoDistributeAllNew: () => void;
  sendReply: () => void;
  markReadLocal: (id: string) => void;

  pushToast: (text: string) => void;
  resolveOperatorName: (ops: Operator[], id?: string) => string | null;

  deleteChat: () => void; // удалить выбранный чат
  deleteAllChats: () => void; // очистить всё
};

const QUICK_TEMPLATES = [
  "Здравствуйте! Проверяю статус заказа, вернусь с ответом в течение 3–5 минут 👌",
  "Спасибо за отзыв! Передал команде 💛",
  "Да, доступна оплата СБП. Отправить ссылку?",
];

export default function InboxSection(props: InboxSectionProps) {
  const {
    inbox,
    operators,
    activeId,
    assigned,
    draft,
    active,

    setActiveId,
    setDraft,

    assignOperatorLocal,
    assignChatToOperator,
    autoAssignActiveChat,
    autoDistributeAllNew,
    sendReply,
    markReadLocal,

    pushToast,
    resolveOperatorName,

    deleteChat,
    deleteAllChats,
  } = props;

  function insertTemplate(t: string) {
    setDraft(draft ? `${draft} ${t}` : t);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] gap-4 xl:gap-6">
      {/* LEFT: список диалогов */}
      <div className="card h-full flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[rgba(148,163,184,0.9)]">
              Входящие
            </div>
            <div className="mt-1 text-[13px] text-muted">
              Активных диалогов:{" "}
              <span className="text-light font-medium">{inbox.length}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-end">
            <button
              className="chip-btn text-[11px]"
              onClick={async () => {
                try {
                  const r = await fetch("http://localhost:3001/inbox/fake", {
                    method: "POST",
                  });
                  const newMsg = (await r.json()) as Msg | { error: string };
                  if ((newMsg as any).error) {
                    pushToast("Ошибка создания сообщения");
                    return;
                  }
                  pushToast("Новое входящее сообщение (фейк)");
                } catch {
                  pushToast("Сервер недоступен (fake)");
                }
              }}
            >
              + фейк
            </button>

            <button
              className="chip-btn text-[11px]"
              onClick={autoDistributeAllNew}
            >
              Распределить новые
            </button>

            <button
              className="chip-btn text-[11px] border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => {
                if (
                  window.confirm(
                    "Удалить ВСЕ чаты из панели?\nЭто очистит список диалогов в панели навсегда (WhatsApp не трогаем)."
                  )
                ) {
                  deleteAllChats();
                }
              }}
            >
              Очистить всё
            </button>
          </div>
        </div>

        {/* список */}
        <div className="mt-1 flex-1 rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,23,42,0.92)]/90 shadow-[0_20px_45px_rgba(0,0,0,0.65)] overflow-hidden">
          {inbox.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4 py-10 text-[12px] text-muted text-center">
              Пока нет входящих. Как только клиент напишет в WhatsApp — диалог
              появится здесь.
            </div>
          ) : (
            <div className="max-h-[64vh] overflow-auto pr-1 py-1">
              <div className="space-y-1.5 px-2">
                {inbox.map((m) => {
                  const isActive = m.id === activeId;
                  const assignedName =
                    (assigned[m.id] ?? m.assignedTo) &&
                    resolveOperatorName(
                      operators,
                      assigned[m.id] ?? m.assignedTo
                    );

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveId(m.id);
                        markReadLocal(m.id);
                      }}
                      className={`w-full text-left chat-item ${
                        isActive ? "chat-item-active" : ""
                      } !bg-[rgba(15,23,42,0.98)]/95 ${
                        isActive
                          ? "!border-[rgba(248,113,37,0.85)]"
                          : "!border-[rgba(30,64,175,0.55)] hover:!border-[rgba(96,165,250,0.9)]"
                      } rounded-2xl px-3 py-2.5 transition-all duration-150`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-client-number text-[13px] leading-tight truncate"
                              title={m.from}
                            >
                              {m.from}
                            </span>
                            {m.status === "new" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5 text-chat-topic truncate">
                            Тема:{" "}
                            <span className="font-medium">
                              {m.topic || "Общая"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted whitespace-nowrap">
                            {new Date(m.at).toLocaleTimeString()}
                          </span>
                          <span
                            className={`tag text-[10px] ${
                              m.status === "new"
                                ? "tag-red"
                                : m.status === "routed"
                                ? "tag-yellow"
                                : "tag-green"
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 text-[12px] text-chatpreview line-clamp-2">
                        {m.text}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {assignedName && (
                          <span className="tag tag-blue text-[10px]">
                            {assignedName}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: чат с клиентом */}
      <div className="card h-full flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted text-[13px]">
            Выберите диалог слева, чтобы открыть переписку с клиентом.
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3">
            {/* Header чата */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-2xl bg-[radial-gradient(circle_at_0_0,var(--accent)_0%,var(--accent-soft)_45%,rgba(15,23,42,1)_100%)] flex items-center justify-center text-[13px] font-semibold text-white">
                  {active.from.slice(-4)}
                </div>
                <div className="flex flex-col">
                  <div className="text-[15px] font-semibold text-light leading-tight">
                    {active.from}
                  </div>
                  <div className="text-[11px] text-muted mt-[2px]">
                    Тема: {active.topic || "Общая"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                <select
                  className="select-shell text-xs min-w-[160px]"
                  value={assigned[active.id] ?? active.assignedTo ?? ""}
                  onChange={(e) => {
                    const opId = e.target.value;
                    assignOperatorLocal(active.id, opId);
                  }}
                >
                  <option value="">Назначить оператора…</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} {op.role === "admin" ? "(admin)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  className="chip-btn text-[11px]"
                  onClick={autoAssignActiveChat}
                >
                  Автоназначить
                </button>

                <button
                  className="chip-btn text-[11px] border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Удалить этот чат из панели навсегда?\nИстория пропадёт из панели, WhatsApp не трогаем."
                      )
                    ) {
                      deleteChat();
                    }
                  }}
                >
                  Удалить чат
                </button>

                <span
                  className={`tag text-[10px] ${
                    active.status === "replied"
                      ? "tag-green"
                      : active.status === "routed"
                      ? "tag-yellow"
                      : "tag-red"
                  }`}
                >
                  {active.status}
                </span>
              </div>
            </div>

            {/* История сообщений */}
            <div className="flex-1 min-h-[220px] rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,23,42,0.95)]/95 px-3.5 py-3 max-h-[42vh] overflow-auto">
              {(active.history ?? []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-[12px] text-muted">
                  История сообщений пока пуста.
                </div>
              ) : (
                (active.history ?? []).map((h, i) => (
                  <div
                    key={i}
                    className={`mb-3 ${
                      h.who === "operator" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={
                        h.who === "operator"
                          ? "bubble-operator ml-auto"
                          : "bubble-client"
                      }
                    >
                      <div
                        className={
                          h.who === "operator"
                            ? "text-[13px] whitespace-pre-wrap leading-snug text-black"
                            : "text-[13px] whitespace-pre-wrap leading-snug text-chatpreview"
                        }
                      >
                        {h.text}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted mt-1">
                      {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Быстрые ответы */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((t, idx) => (
                <button
                  key={idx}
                  className="chip-btn text-[11px]"
                  onClick={() => insertTemplate(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Поле ввода ответа */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="input-shell flex-1 text-[13px]"
                placeholder="Ответ клиенту…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    sendReply();
                  }
                }}
              />
              <button className="btn btn-primary sm:w-[150px]" onClick={sendReply}>
                Отправить
              </button>
            </div>

            {/* Серверное назначение */}
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted mt-1">
              <span className="mr-1">Серверное назначение:</span>
              {operators.map((op) => (
                <button
                  key={op.id}
                  className="chip-btn"
                  disabled={!active}
                  onClick={() => assignChatToOperator(op.id)}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
