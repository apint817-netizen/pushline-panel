import React, { useState } from "react";

type Props = {
  safeMode: boolean;
  onToggleSafeMode: () => void;

  theme: "dark" | "light";
  onToggleTheme: () => void;

  adminPin: string;
  onChangePin: (next: string) => void;
};

export default function SettingsSection({
  safeMode,
  onToggleSafeMode,
  theme,
  onToggleTheme,
  adminPin,
  onChangePin,
}: Props) {
  const [pinDraft, setPinDraft] = useState(adminPin);

  return (
    <div className="grid gap-6 max-w-3xl">
      {/* ==== Интерфейс ==== */}
      <div className="card">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Интерфейс
        </h3>

        <div className="grid gap-4 text-sm">
          {/* SAFE MODE */}
          <div className="flex items-center justify-between flex-wrap gap-2 border border-[var(--border-soft)] rounded-xl p-3 bg-[rgba(255,255,255,0.02)]">
            <div className="flex flex-col">
              <span className="text-light font-medium text-[13px]">
                SAFE_MODE
              </span>
              <span className="text-[11px] text-muted leading-snug">
                Ограничивает рассылку тестовыми лимитами, чтобы случайно не
                бахнуть по всей базе.
              </span>
            </div>

            <button
              className={`relative inline-flex items-center h-8 px-2 rounded-full border transition text-[11px] ${
                safeMode
                  ? "border-[var(--accent)] bg-[rgba(255,122,26,0.15)] text-[var(--accent)]"
                  : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-muted"
              }`}
              onClick={onToggleSafeMode}
            >
              <span className="mr-2">SAFE_MODE</span>
              <span
                className={`w-10 h-5 rounded-full transition ${
                  safeMode
                    ? "bg-[var(--accent)]/60"
                    : "bg-[var(--border-soft)]"
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full transform transition ${
                    safeMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <span
                className={`ml-2 ${
                  safeMode ? "text-[var(--accent)]" : "text-muted"
                }`}
              >
                {safeMode ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* THEME */}
          <div className="flex items-center justify-between flex-wrap gap-2 border border-[var(--border-soft)] rounded-xl p-3 bg-[rgba(255,255,255,0.02)]">
            <div className="flex flex-col">
              <span className="text-light font-medium text-[13px]">
                Тема
              </span>
              <span className="text-[11px] text-muted leading-snug">
                Тёмная экономит глаза (и чуть-чуть батарейку).
              </span>
            </div>

            <button
              className="chip-btn text-[12px] px-3 py-2"
              onClick={onToggleTheme}
            >
              {theme === "dark" ? "Тёмная" : "Светлая"}
            </button>
          </div>
        </div>
      </div>

      {/* ==== Подключение к боту ==== */}
      <div className="card">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Доступ / PIN
        </h3>

        <div className="grid gap-4 text-sm">
          <div className="border border-[var(--border-soft)] rounded-xl p-3 bg-[rgba(255,255,255,0.02)]">
            <label className="text-[11px] text-muted block mb-1">
              Админ-PIN (используется при старте рассылки)
            </label>
            <input
              type="text"
              className="input-shell w-full"
              value={pinDraft}
              placeholder="••••••"
              onChange={(e) => setPinDraft(e.target.value)}
            />

            <div className="text-[10px] text-muted leading-snug mt-2">
              Хранится локально в браузере.
            </div>

            <div className="flex gap-2 mt-3">
              <button
                className="chip-btn flex-1 text-[12px] py-2"
                onClick={() => setPinDraft(adminPin)}
                disabled={pinDraft === adminPin}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary flex-1 text-[12px]"
                onClick={() => {
                  onChangePin(pinDraft || "");
                }}
                disabled={pinDraft === adminPin}
              >
                Сохранить PIN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==== О панели ==== */}
      <div className="card">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          О панели
        </h3>

        <div className="grid gap-4 text-sm text-light/90">
          <div className="border border-[var(--border-soft)] rounded-xl p-3 bg-[rgba(255,255,255,0.02)] grid grid-cols-2 text-[12px] gap-y-2">
            <div className="text-muted">Версия интерфейса</div>
            <div className="font-semibold text-light">0.1.0-alpha</div>

            <div className="text-muted">Режим PWA</div>
            <div className="font-semibold text-light">включён</div>

            <div className="text-muted">Backend</div>
            <div className="font-semibold text-light">
              http://localhost:3001
            </div>

            <div className="text-muted">Авто-распределение чатов</div>
            <div className="font-semibold text-light">
              по загрузке оператора (&lt;80%)
            </div>
          </div>

          <div className="text-[11px] text-muted leading-snug">
            Контакты поддержки можно будет вывести сюда позже.
          </div>
        </div>
      </div>
    </div>
  );
}
