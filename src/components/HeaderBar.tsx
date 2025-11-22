export function HeaderBar({
  safeMode,
  onToggleSafeMode,
  theme,
  onToggleTheme,
}: {
  safeMode: boolean;
  onToggleSafeMode: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  return (
    <div className="w-full px-4 md:px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Лого + текст */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-[radial-gradient(circle_at_0_0,var(--accent)_0%,var(--accent-soft)_40%,rgba(15,23,42,1)_100%)] shadow-[0_0_25px_rgba(248,113,37,0.45)] flex items-center justify-center text-[15px] font-semibold text-white select-none">
            PL
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] md:text-[19px] font-semibold tracking-tight text-light">
                Pushline
              </h1>
              <span className="px-2 py-[2px] rounded-full text-[10px] uppercase tracking-wide bg-[rgba(148,163,184,0.18)] text-muted border border-[rgba(148,163,184,0.38)]">
                PULT
              </span>
            </div>
            <p className="text-[12px] text-muted mt-[2px]">
              Панель рассылок и диалогов в WhatsApp
            </p>
          </div>
        </div>

        {/* Переключатели */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[11px]">
          <SafeSwitch checked={safeMode} onToggle={onToggleSafeMode} />
          <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </div>
  );
}

/* SAFE_MODE переключалка */
function SafeSwitch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex items-center h-8 px-2 rounded-full border transition-all duration-150 shadow-[0_0_0_1px_rgba(15,23,42,0.9)] ${
        checked
          ? "border-[var(--accent)] bg-[rgba(248,113,37,0.18)]"
          : "border-[var(--border-soft)] bg-[rgba(15,23,42,0.8)]"
      }`}
      title="SAFE_MODE"
      aria-pressed={checked}
    >
      <span className="text-[10px] mr-2 text-muted uppercase tracking-wide">
        Safe Mode
      </span>
      <span
        className={`w-10 h-5 rounded-full flex items-center px-[2px] transition ${
          checked
            ? "bg-[var(--accent)]/70"
            : "bg-[rgba(30,41,59,0.9)] border border-[rgba(148,163,184,0.6)]"
        }`}
      >
        <span
          className={`block w-4 h-4 bg-white rounded-full transform transition-transform duration-150 shadow-md ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </span>
      <span
        className={`ml-2 text-[10px] font-medium ${
          checked ? "text-[var(--accent)]" : "text-muted"
        }`}
      >
        {checked ? "Вкл" : "Выкл"}
      </span>
    </button>
  );
}

/* Переключатель темы */
function ThemeSwitch({
  theme,
  onToggle,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <button
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[rgba(15,23,42,0.85)] px-3 py-1.5 hover:bg-[rgba(15,23,42,0.95)] transition-colors"
      onClick={onToggle}
      title="Переключить тему"
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(15,23,42,1)]">
        {isDark ? (
          <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
        )}
      </span>
      <span className="text-[11px] text-muted">
        {isDark ? "Тёмная" : "Светлая"}
      </span>
    </button>
  );
}
