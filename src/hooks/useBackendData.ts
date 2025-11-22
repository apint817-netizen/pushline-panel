import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInbox,
  getOperators as apiGetOperators,
  sendReplyToClient,
  apiAssignChatToOperator,
  apiPatchOperator,
} from "../api";

import type { InboxMsg, Operator } from "../api";

const NEW_MSG_BEEP = "/notify.mp3";
const MAX_LOAD_BEFORE_SKIP = 80;

export function useBackendData(
  pushToast: (t: string) => void,
  enabled: boolean
) {
  // ---------------- state ----------------
  const [inbox, setInbox] = useState<InboxMsg[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  const [operators, setOperators] = useState<Operator[]>([]);

  const [details, setDetails] = useState<Operator | null>(null);

  const prevInboxRef = useRef<InboxMsg[]>([]);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  // локально скрытые (удалённые пользователем) чаты
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // ---------------- derived ----------------
  const filteredInbox = useMemo(() => {
    return inbox.filter((m) => !deletedIds.has(m.id));
  }, [inbox, deletedIds]);

  const active = useMemo(() => {
    if (!activeId) return null;
    return filteredInbox.find((m) => m.id === activeId) ?? null;
  }, [filteredInbox, activeId]);

  const unreadCount = useMemo(() => {
    return filteredInbox.filter((m) => m.status === "new").length;
  }, [filteredInbox]);

  // ---------------- helpers ----------------
  function markReadLocal(id: string) {
    setInbox((prev) =>
      prev.map((m) =>
        m.id === id && m.status === "new"
          ? { ...m, status: "routed", unread: false }
          : m
      )
    );
  }

  async function sendReply() {
    const text = draft.trim();
    if (!active || !text) return;

    try {
      const updated = await sendReplyToClient(active.id, text);

      setInbox((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );

      setDraft("");
      pushToast("Ответ отправлен");
    } catch {
      pushToast("Не удалось отправить ответ");
    }
  }

  function assignOperatorLocal(msgId: string, operatorId: string) {
    setAssigned((s) => ({ ...s, [msgId]: operatorId }));
    markReadLocal(msgId);
  }

  async function toggleOnline(id: string) {
    const op = operators.find((o) => o.id === id);
    if (!op) return;

    try {
      const updated = await apiPatchOperator(id, { online: !op.online });
      setOperators((list) =>
        list.map((o) => (o.id === updated.id ? updated : o))
      );
      pushToast(
        `${updated.name}: ${updated.online ? "online" : "offline"}`
      );
    } catch {
      pushToast("Ошибка смены статуса оператора");
    }
  }

  function pickLeastLoadedOnline(ops: Operator[]): Operator | null {
    const online = ops.filter((o) => o.online);
    if (online.length === 0) return null;
    return [...online].sort(
      (a, b) => a.load - b.load || a.activeChats - b.activeChats
    )[0];
  }

  async function assignChatToOperator(opId: string) {
    if (!active) return;

    try {
      const resp = await apiAssignChatToOperator(active.id, opId);

      const updatedMsg: InboxMsg = resp.message;
      const updatedOp: Operator = resp.operator;

      setAssigned((prev) => ({
        ...prev,
        [updatedMsg.id]: updatedOp.id,
      }));

      setInbox((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
      );

      setOperators((prev) =>
        prev.map((o) => (o.id === updatedOp.id ? updatedOp : o))
      );

      pushToast(`Чат назначен: ${updatedOp.name}`);
    } catch {
      pushToast("Ошибка назначения");
    }
  }

  function autoAssignActiveChat() {
    if (!active) {
      pushToast("Сначала выберите чат слева");
      return;
    }
    const winner = pickLeastLoadedOnline(operators);
    if (!winner) {
      pushToast("Нет онлайн-операторов");
      return;
    }
    assignChatToOperator(winner.id);
  }

  function findBestOperatorForAuto(ops: Operator[]): Operator | null {
    const pool = ops.filter(
      (o) => o.online && o.load < MAX_LOAD_BEFORE_SKIP
    );
    if (pool.length === 0) return null;
    return [...pool].sort(
      (a, b) => a.load - b.load || a.activeChats - b.activeChats
    )[0];
  }

  function autoDistributeAllNew() {
    const candidates = filteredInbox.filter(
      (msg) =>
        !assigned[msg.id] &&
        msg.status !== "replied"
    );

    if (candidates.length === 0) {
      pushToast("Нет чатов для распределения");
      return;
    }

    let distributedCount = 0;
    let tempOps = [...operators];
    const newAssigned: Record<string, string> = {};

    for (const msg of candidates) {
      const winner = findBestOperatorForAuto(tempOps);
      if (!winner) break;

      newAssigned[msg.id] = winner.id;
      distributedCount++;

      tempOps = tempOps.map((op) =>
        op.id === winner.id
          ? {
              ...op,
              activeChats: op.activeChats + 1,
              load: Math.min(100, op.load + 5),
            }
          : op
      );
    }

    if (distributedCount === 0) {
      pushToast("Некому выдать: все операторы заняты");
      return;
    }

    setAssigned((prev) => ({
      ...prev,
      ...newAssigned,
    }));

    const idsJustAssigned = Object.keys(newAssigned);
    if (idsJustAssigned.length > 0) {
      setInbox((prev) =>
        prev.map((m) =>
          idsJustAssigned.includes(m.id) && m.status === "new"
            ? { ...m, status: "routed" }
            : m
        )
      );
    }

    setOperators(tempOps);

    pushToast(`Распределено: ${distributedCount} шт`);
  }

  // Удалить один чат
  async function deleteChat() {
    if (!active) {
      pushToast("Чат не выбран");
      return;
    }

    const chatId = active.id;

    // пометить как удалённый локально
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });

    // сбросить выделение/черновик
    setAssigned((prev) => {
      const copy = { ...prev };
      delete copy[chatId];
      return copy;
    });
    setActiveId((old) => (old === chatId ? null : old));
    setDraft("");

    // попросить сервер вырезать из своего inbox.json
    try {
      const resp = await fetch(
        `http://localhost:3001/inbox/${chatId}`,
        { method: "DELETE" }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || (data as any).error) {
        pushToast("Удалено локально. Сервер не подтвердил.");
        return;
      }
      pushToast("Чат удалён");
    } catch {
      pushToast("Чат скрыт локально (сервер оффлайн?)");
    }
  }

  // ⭐ NEW: Удалить ВСЕ чаты
  async function deleteAllChats() {
    // 1. Локально просто обнуляем всё, чтобы UI стал пустой мгновенно
    setInbox([]);
    setDeletedIds(new Set()); // очищаем, потому что инбокс пуст
    setAssigned({});
    setActiveId(null);
    setDraft("");

    // 2. Говорим серверу подчистить свой inboxMessages и сохранить пустой inbox.json
    try {
      const resp = await fetch("http://localhost:3001/inbox", {
        method: "DELETE",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || (data as any).error) {
        pushToast("Локально очищено. Сервер не подтвердил очистку.");
        return;
      }

      pushToast("Все чаты удалены");
    } catch {
      pushToast("Чаты скрыты локально (сервер оффлайн?)");
    }
  }

  // ---------------- polling ----------------
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stop = false;

    async function loadOperatorsOnce() {
      try {
        const data = await apiGetOperators();
        if (!stop) setOperators(data);
      } catch {
        if (!stop) pushToast("Сервер недоступен (operators)");
      }
    }

    async function loadInboxOnce(firstLoad: boolean) {
      try {
        const data = await getInbox(); // сырые данные с сервера
        if (stop) return;

        // отбрасываем любые чаты, которые были удалены локально в рамках сессии
        const visibleData = data.filter(
          (m) => !deletedIds.has(m.id)
        );

        const prevIds = new Set(prevInboxRef.current.map((m) => m.id));
        const hadUnreadBefore = prevInboxRef.current.some(
          (m) => m.status === "new"
        );
        const gotNewUnreadNow = visibleData.some(
          (m) => m.status === "new" && !prevIds.has(m.id)
        );

        // записываем текущее состояние инбокса
        setInbox(() => {
          prevInboxRef.current = visibleData;
          return visibleData;
        });

        // авто-выбор первого чата при первом заходе
        if ((firstLoad || inbox.length === 0) && visibleData[0]?.id) {
          setActiveId((old) => old ?? visibleData[0].id);
        }

        // карта назначений
        const map: Record<string, string> = {};
        visibleData.forEach((m) => {
          if (m.assignedTo) map[m.id] = m.assignedTo;
        });
        setAssigned(map);

        // звук на новые входящие
        if (
          gotNewUnreadNow &&
          !hadUnreadBefore &&
          beepRef.current
        ) {
          try {
            beepRef.current.currentTime = 0;
            void beepRef.current.play();
          } catch {
            /* autoplay блокируется - ок */
          }
        }
      } catch {
        if (!stop) pushToast("Сервер недоступен (inbox)");
      }
    }

    loadOperatorsOnce();
    loadInboxOnce(true);

    const iv = setInterval(() => loadInboxOnce(false), 3000);

    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [enabled, pushToast, deletedIds]);

  // ---------------- return API ----------------
  return {
    inbox: filteredInbox,
    activeId,
    active,
    draft,
    assigned,
    operators,
    details,
    unreadCount,

    setActiveId,
    setDraft,
    setDetails,

    sendReply,
    assignChatToOperator,
    assignOperatorLocal,
    autoAssignActiveChat,
    autoDistributeAllNew,
    toggleOnline,

    beepRef,
    markReadLocal,

    deleteChat,
    deleteAllChats, // ⭐ NEW - отдаём наружу
  };
}
