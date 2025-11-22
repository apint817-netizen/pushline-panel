// panel/src/App.tsx
import { useEffect, useState } from "react";

import { HeaderBar } from "./components/HeaderBar";
import { TabsNav } from "./components/TabsNav";
import { Toasts } from "./components/Toasts";
import OperatorDrawer from "./components/OperatorDrawer";

import InboxSection from "./sections/InboxSection";
import BroadcastSection from "./sections/BroadcastSection";
import OperatorsSection from "./sections/OperatorsSection";
import ReportsSection from "./sections/ReportsSection";
import SettingsSection from "./sections/SettingsSection";
import AiAssistantSection from "./sections/AiAssistantSection";

import { useBackendData } from "./hooks/useBackendData";

import type { Operator } from "./api";
import { HistoryTab } from "./components/HistoryTab";

/* =================== Типы =================== */
type Tab =
  | "inbox"
  | "broadcast"
  | "operators"
  | "reports"
  | "history"
  | "settings"
  | "ai";

type Toast = { id: string; text: string };

/* =================== Константы =================== */
const LS = {
  TAB: "pushline.tab",
  SAFE: "pushline.safe",
  TOTAL: "pushline.broadcast.total",
  THEME: "pushline.theme",
  PIN: "pushlineToken",
};

/* =================== Утилиты =================== */
function resolveOperatorName(
  operators: Operator[],
  id?: string
): string | null {
  if (!id) return null;
  const match = operators.find((o) => o.id === id);
  return match ? match.name : id;
}

/* =================== Главный компонент =================== */
export default function App() {
  /* ---------- Persisted UI State ---------- */
  const [tab, setTab] = useState<Tab>(
    () => (localStorage.getItem(LS.TAB) as Tab) || "inbox"
  );

  const [safeMode, setSafeMode] = useState<boolean>(() => {
    const v = localStorage.getItem(LS.SAFE);
    return v === null ? true : v === "1";
  });

  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem(LS.THEME) as "dark" | "light") || "dark"
  );

  const [adminPin, setAdminPin] = useState<string>(
    () => localStorage.getItem(LS.PIN) || ""
  );

  /* ---------- LocalStorage sync ---------- */
  useEffect(() => {
    localStorage.setItem(LS.TAB, tab);
  }, [tab]);

  useEffect(() => {
    localStorage.setItem(LS.SAFE, safeMode ? "1" : "0");
  }, [safeMode]);

  useEffect(() => {
    localStorage.setItem(LS.THEME, theme);
    const root = document.documentElement;
    if (theme === "light") root.classList.add("theme-light");
    else root.classList.remove("theme-light");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LS.PIN, adminPin);
  }, [adminPin]);

  /* ---------- Toasts ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  function pushToast(text: string) {
    const id = Math.random().toString(36).slice(2, 7);
    setToasts((t) => [{ id, text }, ...t].slice(0, 5));
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }

  /* ---------- Backend data via hook ---------- */
  const needLiveData =
    tab === "inbox" || tab === "broadcast" || tab === "operators";

  const {
    inbox,
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

    markReadLocal,
    deleteChat,
    deleteAllChats,
    beepRef,
  } = useBackendData(pushToast, needLiveData);

  /* ---------- UI ---------- */
  return (
    <div className="app-shell">
      {/* Общий glow и фон задаются через .app-shell в CSS */}

      <div className="app-shell-inner">
        {/* HEADER */}
        <header className="app-shell-header">
          <HeaderBar
            safeMode={safeMode}
            onToggleSafeMode={() => setSafeMode(!safeMode)}
            theme={theme}
            onToggleTheme={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
          />
        </header>

        {/* MAIN AREA: NAV + CONTENT */}
        <div className="app-shell-main">
          {/* Навигация как отдельная карточка слева */}
          <aside className="app-shell-nav">
            <div className="app-shell-nav-card">
              <TabsNav
                current={tab}
                unread={unreadCount}
                onChange={(next) => setTab(next as Tab)}
              />
            </div>
          </aside>

          {/* Контент вкладок */}
          <main
            key={tab}
            className="app-shell-content animate-fade-in"
          >
            <section
              className={
                tab === "reports"
                  ? "content-section content-section-wide"
                  : "content-section"
              }
            >
              {tab === "inbox" && (
                <InboxSection
                  inbox={inbox}
                  operators={operators}
                  activeId={activeId}
                  assigned={assigned}
                  draft={draft}
                  active={active}
                  setActiveId={(id) => setActiveId(id)}
                  setDraft={(v) => setDraft(v)}
                  assignOperatorLocal={assignOperatorLocal}
                  assignChatToOperator={assignChatToOperator}
                  autoAssignActiveChat={autoAssignActiveChat}
                  autoDistributeAllNew={autoDistributeAllNew}
                  sendReply={sendReply}
                  markReadLocal={markReadLocal}
                  pushToast={pushToast}
                  resolveOperatorName={(ops, id) =>
                    resolveOperatorName(ops, id)
                  }
                  deleteChat={deleteChat}
                  deleteAllChats={deleteAllChats}
                />
              )}

              {tab === "broadcast" && (
                <BroadcastSection
                  safeMode={safeMode}
                  totalInitStateKey={LS.TOTAL}
                  pushToast={pushToast}
                />
              )}

              {tab === "operators" && (
                <OperatorsSection
                  operators={operators}
                  onAssign={assignChatToOperator}
                  onToggleOnline={toggleOnline}
                  onOpenDetails={(op) => setDetails(op)}
                  canAssign={!!active}
                />
              )}

              {tab === "reports" && <ReportsSection />}

              {tab === "history" && <HistoryTab />}

              {tab === "ai" && <AiAssistantSection />}

              {tab === "settings" && (
                <SettingsSection
                  safeMode={safeMode}
                  onToggleSafeMode={() => setSafeMode(!safeMode)}
                  theme={theme}
                  onToggleTheme={() =>
                    setTheme(theme === "dark" ? "light" : "dark")
                  }
                  adminPin={adminPin}
                  onChangePin={(next) => {
                    setAdminPin(next);
                    pushToast(
                      next
                        ? "PIN сохранён локально"
                        : "PIN очищен (теперь придётся вводить вручную)"
                    );
                  }}
                />
              )}
            </section>
          </main>
        </div>

        {/* FOOTER */}
        <footer className="app-shell-footer">
          © {new Date().getFullYear()} Pushline • PWA • Admin Pult
        </footer>
      </div>

      {/* TOASTS */}
      <Toasts toasts={toasts} />

      {/* DRAWER ОПЕРАТОРА */}
      <OperatorDrawer
        operator={details}
        onClose={() => setDetails(null)}
        onSave={(patch) => {
          if (!details) return;
          fetch(`http://localhost:3001/operators/${details.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
            .then((r) => r.json())
            .then((updated: Operator | { error: string }) => {
              if ((updated as any).error) {
                pushToast("Ошибка сохранения оператора");
                return;
              }
              pushToast("Сохранено");
              setDetails(null);
            })
            .catch(() => {
              pushToast("Сервер недоступен (save operator)");
            });
        }}
      />

      {/* AUDIO BEEP */}
      <audio ref={beepRef} src="/notify.mp3" preload="auto" />
    </div>
  );
}
