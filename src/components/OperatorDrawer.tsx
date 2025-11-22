import { useEffect, useState } from "react";
import type { Operator as ApiOperator } from "./api";

export default function OperatorDrawer({
  operator,
  onClose,
  onSave,
}: {
  operator: ApiOperator | null;
  onClose: () => void;
  onSave: (patch: Partial<ApiOperator>) => void;
}) {
  const [form, setForm] = useState<Partial<ApiOperator>>({});

  useEffect(() => {
    if (operator) {
      setForm({
        online: operator.online,
        activeChats: operator.activeChats,
        load: operator.load,
      });
    }
  }, [operator]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!operator) return null;

  const loadValue = Number(form.load ?? 0);

  return (
    <>
      {/* затемнение фона */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* панель */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-[rgba(8,12,20,0.98)] border-l border-[rgba(30,64,175,0.5)] shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_24px_60px_rgba(0,0,0,0.85)] flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[rgba(30,64,175,0.45)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-[radial-gradient(circle_at_0_0,var(--accent)_0%,var(--accent-soft)_45%,rgba(15,23,42,1)_100%)] flex items-center justify-center text-[14px] font-semibold text-white">
              {operator.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <div className="text-[16px] font-semibold text-light leading-tight">
                {operator.name}
              </div>
              <div className="text-[11px] text-muted mt-[2px]">
                {operator.role === "admin"
                  ? "Администратор"
                  : "Оператор"}
              </div>
            </div>
          </div>
          <button
            className="chip-btn text-[11px] px-2 py-1"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-auto">
          {/* Статус */}
          <div className="border border-[var(--border-soft)] rounded-2xl p-3.5 bg-[rgba(15,23,42,0.95)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm text-light">Статус</div>
                <div className="text-[11px] text-muted mt-[2px]">
                  Отображается в панели и влияет на автодистрибуцию.
                </div>
              </div>
              <span
                className={`tag ${
                  form.online ? "tag-green" : "tag-gray"
                }`}
              >
                {form.online ? "online" : "offline"}
              </span>
            </div>
            <div className="mt-3">
              <button
                className="chip-btn text-[11px] px-3 py-1.5"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    online: !f.online,
                  }))
                }
              >
                {form.online ? "Выключить" : "Включить"}
              </button>
            </div>
          </div>

          {/* Активных чатов */}
          <div className="border border-[var(--border-soft)] rounded-2xl p-3.5 bg-[rgba(15,23,42,0.95)] grid gap-2.5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-light">Активных чатов</div>
              <span className="text-[11px] text-muted">
                Контролируй нагрузку на оператора
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={999}
              value={form.activeChats ?? 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  activeChats: Math.max(0, Number(e.target.value)),
                }))
              }
              className="input-shell w-28"
            />
          </div>

          {/* Загрузка */}
          <div className="border border-[var(--border-soft)] rounded-2xl p-3.5 bg-[rgba(15,23,42,0.95)] grid gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-light">Загрузка оператора</div>
              <span className="text-[12px] text-light font-medium">
                {loadValue}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={loadValue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  load: Number(e.target.value),
                }))
              }
              className="w-full accent-[var(--accent)]"
            />
            <div className="w-full h-2.5 rounded-full bg-[rgba(15,23,42,1)] border border-[var(--border-soft)] overflow-hidden">
              <div
                className="h-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(248,113,37,0.95))",
                  width: `${Math.min(100, Math.max(0, loadValue))}%`,
                  transition: "width 150ms ease-out",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-soft)] flex gap-2 bg-[rgba(8,12,20,0.98)]">
          <button
            className="chip-btn flex-1 text-[12px] py-2"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary flex-1 text-[12px]"
            onClick={() =>
              onSave({
                online: !!form.online,
                activeChats: Math.max(
                  0,
                  Number(form.activeChats ?? 0)
                ),
                load: Math.max(
                  0,
                  Math.min(100, Number(form.load ?? 0))
                ),
              })
            }
          >
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}
