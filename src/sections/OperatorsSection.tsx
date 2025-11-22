import { useMemo, useState } from "react";
import type { Operator as ApiOperator } from "../api";

export default function OperatorsSection({
  operators,
  onAssign,
  onToggleOnline,
  onOpenDetails,
  canAssign,
}: {
  operators: ApiOperator[];
  onAssign: (opId: string) => void;
  onToggleOnline: (opId: string) => void;
  onOpenDetails: (op: ApiOperator) => void;
  canAssign: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [sort, setSort] = useState<"load" | "name" | "active">("load");

  const filtered = useMemo(() => {
    let list = operators.filter((o) =>
      `${o.name} ${o.role}`.toLowerCase().includes(q.toLowerCase())
    );
    if (onlyOnline) list = list.filter((o) => o.online);
    switch (sort) {
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "active":
        list = [...list].sort((a, b) => b.activeChats - a.activeChats);
        break;
      default:
        list = [...list].sort((a, b) => b.load - a.load);
    }
    return list;
  }, [operators, q, onlyOnline, sort]);

  return (
    <div className="grid gap-4">
      {/* Фильтры */}
      <div className="card flex flex-wrap items-center gap-3">
        <input
          className="input-shell"
          placeholder="Поиск по имени/роли…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={onlyOnline}
            onChange={(e) => setOnlyOnline(e.target.checked)}
          />
          <span className="text-muted">Только online</span>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted text-[12px]">Сортировка:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="select-shell text-[12px]"
          >
            <option value="load">По загрузке</option>
            <option value="active">По активным чатам</option>
            <option value="name">По имени</option>
          </select>
        </div>
      </div>

      {/* Карточки операторов */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((op) => (
          <div key={op.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-light">
                  {op.name}
                </div>
                <div className="text-[11px] text-muted">
                  {op.role === "admin" ? "Администратор" : "Оператор"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`tag ${
                    op.online ? "tag-green" : "tag-gray"
                  }`}
                >
                  {op.online ? "online" : "offline"}
                </span>
                <button
                  className="chip-btn text-[11px] px-2 py-1"
                  onClick={() => onToggleOnline(op.id)}
                >
                  {op.online ? "Выключить" : "Включить"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border border-[var(--border-soft)] rounded-lg p-2">
                <div className="text-[11px] text-muted mb-1">
                  Активных чатов
                </div>
                <div className="text-xl font-semibold text-light">
                  {op.activeChats}
                </div>
              </div>
              <div className="border border-[var(--border-soft)] rounded-lg p-2">
                <div className="text-[11px] text-muted mb-1">
                  Загрузка
                </div>
                <div className="text-xl font-semibold text-light">
                  {op.load}%
                </div>
              </div>
            </div>

            <div>
              <div className="w-full h-2 rounded-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-soft)] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    background:
                      "radial-gradient(circle at 0% 0%, var(--accent) 0%, var(--accent-dark) 80%)",
                    width: `${op.load}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                className={`btn btn-primary flex-1 text-[12px] disabled:opacity-50`}
                disabled={!canAssign || !op.online}
                onClick={() => onAssign(op.id)}
                title={
                  canAssign
                    ? ""
                    : "Выберите чат во Входящих, чтобы назначить"
                }
              >
                Назначить активный чат
              </button>

              <button
                className="chip-btn text-[11px] px-2 py-1"
                onClick={() => onOpenDetails(op)}
              >
                Детали
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
