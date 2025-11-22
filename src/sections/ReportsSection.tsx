// panel/src/sections/ReportsSection.tsx
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3001";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border-soft)] rounded-xl px-4 py-3 bg-[rgba(8,12,20,0.9)] shadow-[0_0_0_1px_rgba(15,23,42,0.7)]">
      <div className="text-[11px] uppercase tracking-wide text-muted mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold leading-none text-light">
        {value}
      </div>
    </div>
  );
}

function exportCSV(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== Типы данных с backend =====

type LastEntry = {
  ts?: string;
  timestamp?: string;
  phone: string;
  name?: string | null;
  status: string;
  details?: string | null;
};

type LastWaveInfo = {
  from?: string;
  to?: string;
  sent?: number;
  errors?: number;
};

// ===== Типы для графиков =====

type WeekDataPoint = {
  date: string;
  sent: number;
  errors: number;
};

type StatusSlice = {
  name: string;
  value: number;
};

const STATUS_COLORS = [
  "#4ade80",
  "#f97373",
  "#fbbf24",
  "#38bdf8",
  "#a855f7",
  "#f97316",
];

function normalizeStatus(status: string) {
  return (status || "").toUpperCase();
}

// группируем в «Успешно» / «Ошибка»
function statusGroupLabel(status: string) {
  const s = normalizeStatus(status);
  if (!s) return "Неизвестно";
  if (s.startsWith("SENT")) return "Успешно";
  return "Ошибка";
}

export default function ReportsSection({
  safeMode,
  totalInitStateKey = "reports-default",
  pushToast,
}: {
  safeMode?: boolean;
  totalInitStateKey?: string;
  pushToast?: (text: string) => void;
} = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastRows, setLastRows] = useState<LastEntry[]>([]);
  const [sentCachePhones, setSentCachePhones] = useState<string[]>([]);
  const [lastWave, setLastWave] = useState<LastWaveInfo | null>(null);

  const [weekData, setWeekData] = useState<WeekDataPoint[]>([]);
  const [statusMix, setStatusMix] = useState<StatusSlice[]>([]);

  const [totalSent, setTotalSent] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [uniquePhones, setUniquePhones] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [lastRes, lastWaveRes, cacheRes] = await Promise.all([
          fetch(API_BASE + "/api/broadcast/last"),
          fetch(API_BASE + "/api/broadcast/last-wave"),
          fetch(API_BASE + "/api/broadcast/sent-cache"),
        ]);

        const lastText = await lastRes.text();
        const lastWaveText = await lastWaveRes.text();
        const cacheText = await cacheRes.text();

        if (!lastRes.ok) {
          throw new Error(
            "Не удалось загрузить /api/broadcast/last: " + lastText
          );
        }
        if (!lastWaveRes.ok) {
          throw new Error(
            "Не удалось загрузить /api/broadcast/last-wave: " +
              lastWaveText
          );
        }
        if (!cacheRes.ok) {
          throw new Error(
            "Не удалось загрузить /api/broadcast/sent-cache: " +
              cacheText
          );
        }

        let lastJson: any = {};
        let lastWaveJson: any = {};
        let cacheJson: any = {};

        try {
          lastJson = JSON.parse(lastText);
        } catch {
          throw new Error("last вернул не JSON: " + lastText.slice(0, 80));
        }

        try {
          lastWaveJson = JSON.parse(lastWaveText);
        } catch {
          throw new Error(
            "last-wave вернул не JSON: " + lastWaveText.slice(0, 80)
          );
        }

        try {
          cacheJson = JSON.parse(cacheText);
        } catch {
          throw new Error(
            "sent-cache вернул не JSON: " + cacheText.slice(0, 80)
          );
        }

        if (cancelled) return;

        const rowsRaw: any[] = Array.isArray(lastJson?.data)
          ? lastJson.data
          : Array.isArray(lastJson?.rows)
          ? lastJson.rows
          : Array.isArray(lastJson)
          ? lastJson
          : [];

        const parsedRows: LastEntry[] = rowsRaw
          .map((r) => ({
            ts: r.ts ?? r.timestamp ?? r.at ?? null,
            timestamp: r.timestamp ?? r.ts ?? r.at ?? null,
            phone: r.phone ?? r.to ?? "",
            name: r.name ?? r.contactName ?? null,
            status: r.status ?? r.result ?? "",
            details: r.details ?? r.error ?? null,
          }))
          .filter((r) => !!r.phone);

        const phonesArr: string[] = Array.isArray(cacheJson?.phones)
          ? cacheJson.phones.filter((p: any) => typeof p === "string")
          : [];

        const parsedLastWave: LastWaveInfo | null =
          lastWaveJson && typeof lastWaveJson === "object"
            ? {
                from: lastWaveJson.from ?? lastWaveJson.rangeFrom ?? undefined,
                to: lastWaveJson.to ?? lastWaveJson.rangeTo ?? undefined,
                sent: lastWaveJson.sent ?? lastWaveJson.ok ?? undefined,
                errors:
                  lastWaveJson.errors ?? lastWaveJson.fail ?? undefined,
              }
            : null;

        setLastRows(parsedRows);
        setSentCachePhones(phonesArr);
        setLastWave(parsedLastWave);

        const total = parsedRows.length;
        // считаем ошибки: всё, что НЕ SENT*
        const errorsCount = parsedRows.filter(
          (r) => !normalizeStatus(r.status).startsWith("SENT")
        ).length;
        const uniqPhones = new Set(parsedRows.map((r) => r.phone)).size;

        setTotalSent(total);
        setTotalErrors(errorsCount);
        setUniquePhones(uniqPhones);

        const byDate = new Map<string, { sent: number; errors: number }>();

        for (const r of parsedRows) {
          const ts = r.ts ?? r.timestamp;
          if (!ts) continue;

          const d = new Date(ts);
          if (Number.isNaN(d.getTime())) continue;

          const key = d.toISOString().slice(0, 10);
          const bucket = byDate.get(key) ?? { sent: 0, errors: 0 };

          if (normalizeStatus(r.status).startsWith("SENT")) {
            bucket.sent += 1;
          } else {
            bucket.errors += 1;
          }

          byDate.set(key, bucket);
        }

        const weekArr: WeekDataPoint[] = Array.from(byDate.entries())
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([date, v]) => ({ date, sent: v.sent, errors: v.errors }));

        setWeekData(weekArr);

        // разрез по статусам: «Успешно» / «Ошибка»
        const byStatus = new Map<string, number>();
        for (const r of parsedRows) {
          const key = statusGroupLabel(r.status);
          byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
        }

        const statusArr: StatusSlice[] = Array.from(byStatus.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        setStatusMix(statusArr);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message || "Ошибка загрузки истории");
          if (pushToast) {
            pushToast("Не удалось загрузить отчёты по рассылкам");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [totalInitStateKey]);

  const handleExportCsv = () => {
    if (!lastRows.length) {
      if (pushToast) pushToast("Нет данных для экспорта");
      return;
    }

    const header = ["timestamp", "phone", "name", "status", "details"];

    const rows = lastRows.map((r) => [
      r.ts ?? r.timestamp ?? "",
      r.phone,
      r.name ?? "",
      r.status ?? "",
      r.details ?? "",
    ]);

    exportCSV("broadcast_history.csv", [header, ...rows]);
    if (pushToast) pushToast("Экспортирован broadcast_history.csv");
  };

  return (
    <section className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-light tracking-tight">
            Отчёты по рассылкам
          </h2>
          <p className="text-[13px] text-muted mt-1 max-w-2xl">
            Сводная статистика по всем записям в{" "}
            <code>results.csv</code> и уникальным телефонам из{" "}
            <code>sent_cache.json</code>: динамика отправок, ошибки и
            разрез «Успешно / Ошибка».
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {safeMode && (
            <span className="px-2 py-[3px] rounded-full border border-yellow-500/60 text-[11px] text-yellow-300 bg-[rgba(120,53,15,0.3)]">
              SAFE MODE: рассылки ограничены
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="text-[12px] px-3 py-1.5 rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-white/5 transition-colors"
          >
            Выгрузить историю в CSV
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Всего записей в истории" value={String(totalSent)} />
        <Kpi label="Ошибок отправки" value={String(totalErrors)} />
        <Kpi
          label="Уникальных телефонов (по истории)"
          value={String(uniquePhones)}
        />
        <Kpi
          label="Телефонов в sent-cache"
          value={String(sentCachePhones.length)}
        />
      </div>

      {loading && (
        <div className="text-sm text-muted py-4">Загрузка отчётов…</div>
      )}
      {error && !loading && (
        <div className="text-sm text-red-400 whitespace-pre-line py-2">
          Ошибка: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 auto-rows-min">
          {/* График по дням */}
          <div className="xl:col-span-2 border border-[var(--border-soft)] rounded-2xl p-4 bg-[rgba(8,12,20,0.95)] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-light">
                  Динамика по дням
                </div>
                <div className="text-[11px] text-muted">
                  Отправлено / ошибки по дате события.
                </div>
              </div>
            </div>
            <div className="w-full h-64">
              {weekData.length === 0 ? (
                <div className="text-xs text-muted flex items-center justify-center h-full">
                  Данных пока нет — отправь первую рассылку.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border:
                          "1px solid rgba(148,163,184,0.35)",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      name="Отправлено (успешно)"
                      stroke="#4ade80"
                      fill="#4ade80"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="errors"
                      name="Ошибки"
                      stroke="#f97373"
                      fill="#f97373"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Круговая по статусам + инфо по последней волне */}
          <div className="border border-[var(--border-soft)] rounded-2xl p-4 bg-[rgba(8,12,20,0.95)] shadow-[0_18px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-light">
                  Разрез по статусам
                </div>
                <div className="text-[11px] text-muted">
                  Доля «Успешно» и «Ошибка» по всем записям.
                </div>
              </div>
            </div>

            <div className="w-full h-48">
              {statusMix.length === 0 ? (
                <div className="text-xs text-muted flex items-center justify-center h-full">
                  Ещё нет статусов для отображения.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusMix}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={35}
                      paddingAngle={4}
                    >
                      {statusMix.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            STATUS_COLORS[idx % STATUS_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border:
                          "1px solid rgba(148,163,184,0.35)",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{
                        fontSize: 11,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="border-t border-[rgba(148,163,184,0.25)] pt-3 text-[11px] text-muted space-y-1">
              <div className="flex justify-between">
                <span>Последняя волна (успешно / ошибки):</span>
                <span className="text-light">
                  {(lastWave?.sent ?? 0) +
                    " / " +
                    (lastWave?.errors ?? 0)}
                </span>
              </div>
              {lastWave?.from && lastWave?.to && (
                <div className="flex justify-between">
                  <span>Диапазон по времени:</span>
                  <span className="text-light">
                    {lastWave.from} — {lastWave.to}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
