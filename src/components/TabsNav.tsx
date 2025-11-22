import React from "react";

export type Tab =
  | "inbox"
  | "broadcast"
  | "operators"
  | "reports"
  | "history"
  | "settings"
  | "ai";

const items: { id: Tab; label: string; icon: string }[] = [
  { id: "inbox", label: "Входящие", icon: "💬" },
  { id: "broadcast", label: "Рассылка", icon: "📤" },
  { id: "history", label: "История", icon: "📑" },
  { id: "operators", label: "Операторы", icon: "👥" },
  { id: "reports", label: "Отчёты", icon: "📊" },
  { id: "ai", label: "AI-помощник", icon: "✨" },
  { id: "settings", label: "Настройки", icon: "⚙️" },
];

export function TabsNav({
  current,
  unread,
  onChange,
}: {
  current: Tab;
  unread: number;
  onChange: (next: Tab) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <TabButton
          key={item.id}
          item={item}
          current={current}
          unread={unread}
          onClick={onChange}
        />
      ))}
    </nav>
  );
}

function TabButton({
  item,
  current,
  unread,
  onClick,
}: {
  item: { id: Tab; label: string; icon: string };
  current: Tab;
  unread: number;
  onClick: (next: Tab) => void;
}) {
  const active = item.id === current;

  return (
    <button
      onClick={() => onClick(item.id)}
      className={`group w-full text-left rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 text-[13px] transition-all ${
        active
          ? "bg-[rgba(15,23,42,0.95)] border border-[rgba(248,113,37,0.7)] shadow-[0_0_0_1px_rgba(15,23,42,0.85),0_12px_30px_rgba(0,0,0,0.55)]"
          : "bg-[rgba(15,23,42,0.7)] border border-[rgba(30,64,175,0.4)] hover:bg-[rgba(15,23,42,0.9)] hover:border-[rgba(96,165,250,0.7)]"
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[rgba(15,23,42,1)] text-[13px]">
          {item.icon}
        </span>
        <span
          className={`truncate ${
            active ? "text-light" : "text-[rgba(226,232,240,0.86)]"
          }`}
        >
          {item.label}
        </span>
      </div>

      {item.id === "inbox" && unread > 0 && (
        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[rgba(248,113,37,0.95)] text-[11px] text-white font-medium">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
