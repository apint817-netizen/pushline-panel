import { useEffect, useState } from "react";

type BroadcastRecord = {
  timestamp: string;
  phone: string;
  name: string;
  status: string;
  details: string;
};

type LastWaveResponse = {
  ok: boolean;
  total: number;
  phones: string[];
  records: BroadcastRecord[];
};

type LastTailResponse = {
  ok: boolean;
  count: number;
  data: BroadcastRecord[];
};

// базовый URL backend-а (как в api.ts / ReportsSection)
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:3001";

// ==== utils ====

function normalizeStatus(status: string) {
  return (status || "").toUpperCase();
}

// тип статуса для цвета
function statusKind(status: string): "ok" | "error" | "warn" | "neutral" {
  const s = normalizeStatus(status);
  if (s.startsWith("SENT")) return "ok";
  if (s.includes("SKIP") || s.includes("ALREADY")) return "warn";
  if (
    s.includes("ERROR") ||
    s.includes("FAIL") ||
    s.includes("NOT_REGISTERED")
  ) {
    return "error";
  }
  return "neutral";
}

// текст в бэйдже
function statusDisplayLabel(status: string) {
  const s = normalizeStatus(status);
  if (!s) return "—";
  if (s.startsWith("SENT")) return "Успешно";
  if (s.includes("SKIP") || s.includes("ALREADY")) return "Пропуск";
  return "Ошибка";
}

// текст в колонке «Детали»
function detailsDisplay(details?: string) {
  if (!details) return "—";
  const d = details.toUpperCase().trim();
  if (d === "SCRIPT") return "Скрипт";
  return details;
}

function downloadCsv(filename: string, rows: BroadcastRecord[]) {
  if (!rows.length) return;
  const header = ["timestamp", "phone", "name", "status", "details"];

  const csvLines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.timestamp,
        r.phone,
        (r.name || "").replace(/"/g, '""'),
        r.status,
        (r.details || "").replace(/"/g, '""'),
      ]
        .map((v) => `"${v}"`)
        .join(",")
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ==== маленькие компоненты ====

function StatusBadge({ status }: { status: string }) {
  const kind = statusKind(status);
  const label = statusDisplayLabel(status);

  // Жёстко задаём цвета, чтобы не зависеть от Tailwind
  let backgroundColor = "rgba(148, 163, 184, 0.18)"; // neutral
  let borderColor = "rgba(148, 163, 184, 0.7)";
  let textColor = "rgba(226, 232, 240, 0.95)";

  if (kind === "ok") {
    backgroundColor = "rgba(34, 197, 94, 0.18)"; // зелёный
    borderColor = "rgba(34, 197, 94, 0.9)";
    textColor = "rgba(187, 247, 208, 1)";
  } else if (kind === "error") {
    backgroundColor = "rgba(248, 113, 113, 0.20)"; // красный
    borderColor = "rgba(248, 113, 113, 0.95)";
    textColor = "rgba(254, 226, 226, 1)";
  } else if (kind === "warn") {
    backgroundColor = "rgba(251, 191, 36, 0.22)"; // жёлтый
    borderColor = "rgba(245, 158, 11, 0.95)";
    textColor = "rgba(255, 251, 235, 1)";
  }

  return (
    <span
      style={{
        backgroundColor,
        borderColor,
        color: textColor,
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: 9999,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function KpiTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex-1 min-w-[150px] border border-[var(--border-soft)] rounded-xl px-3.5 py-2.5 bg-[rgba(8,12,20,0.9)] shadow-[0_0_0_1px_rgba(15,23,42,0.7)]">
      <div className="text-[11px] uppercase tracking-wide text-muted mb-1">
        {label}
      </div>
      <div className="text-xl font-semibold text-light leading-none">
        {value}
      </div>
    </div>
  );
}

export function HistoryTab() {
  const [lastWave, setLastWave] = useState<BroadcastRecord[]>([]);
  const [tail, setTail] = useState<BroadcastRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTail, setShowTail] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // последняя волна
      const r1 = await fetch(API_BASE + "/api/broadcast/last-wave");
      const text1 = await r1.text();

      let j1: LastWaveResponse = {
        ok: false,
        total: 0,
        phones: [],
        records: [],
      };

      try {
        j1 = JSON.parse(text1);
      } catch {
        throw new Error("last-wave вернул не JSON: " + text1.slice(0, 80));
      }

      // хвост истории (например, последние 1000 строк)
      const r2 = await fetch(
        API_BASE + "/api/broadcast/last?limit=1000"
      );
      const text2 = await r2.text();

      let j2: LastTailResponse = { ok: false, count: 0, data: [] };

      try {
        j2 = JSON.parse(text2);
      } catch {
        throw new Error("last вернул не JSON: " + text2.slice(0, 80));
      }

      if (!j1.ok && !j2.ok) {
        throw new Error("backend returned error");
      }

      setLastWave(j1.records || []);
      setTail(j2.data || []);
    } catch (e: any) {
      console.error(e);
      setError(
        "Не удалось загрузить историю (проверь backend и /api/broadcast/*).\n" +
          (e?.message || e)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalWave = lastWave.length;
  const totalTail = tail.length;
  const uniqueWavePhones = new Set(lastWave.map((r) => r.phone)).size;

  const rowsToShow = showTail ? tail : lastWave;

  return (
    <section className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-light tracking-tight">
            История рассылок
          </h2>
          <p className="text-[13px] text-muted mt-1 max-w-2xl">
            Последняя волна и хвост отправок из{" "}
            <code>results.csv</code>. Экран для быстрой проверки, кому
            реально ушли сообщения.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-2 py-[3px] rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[11px] text-muted">
            Источник данных:{" "}
            <code className="text-[10px]">results.csv</code>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadData}
              className="chip-btn text-[12px] px-3 py-1.5"
            >
              Обновить
            </button>
            <button
              onClick={() => downloadCsv("last_wave.csv", lastWave)}
              disabled={!totalWave}
              className="chip-btn text-[12px] px-3 py-1.5 disabled:opacity-40"
            >
              CSV последней волны
            </button>
            <button
              onClick={() => downloadCsv("history_tail.csv", tail)}
              disabled={!totalTail}
              className="chip-btn text-[12px] px-3 py-1.5 disabled:opacity-40"
            >
              CSV хвоста
            </button>
          </div>
        </div>
      </div>

      {/* Ошибка / загрузка */}
      {loading && (
        <div className="text-sm text-muted">Загружаем историю…</div>
      )}
      {error && (
        <div className="text-sm text-red-400 whitespace-pre-line">
          {error}
        </div>
      )}

      {/* KPI блок */}
      <div className="flex flex-wrap gap-3">
        <KpiTile label="Записей в последней волне" value={totalWave} />
        <KpiTile
          label="Уникальных телефонов в волне"
          value={uniqueWavePhones}
        />
        <KpiTile label="Записей в хвосте" value={totalTail} />
        <div className="flex-1 min-w-[170px] border border-dashed border-[var(--border-soft)] rounded-xl px-3.5 py-2.5 bg-[rgba(8,12,20,0.6)]">
          <div className="text-[11px] text-muted mb-1 uppercase tracking-wide">
            Уже получили (по кэшу)
          </div>
          <div className="text-[12px] text-muted">
            Считается во вкладке <span className="font-medium">Отчёты</span>{" "}
            по файлу <code>sent_cache.json</code>.
          </div>
        </div>
      </div>

      {/* Легенда статусов */}
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        <span className="text-muted">Статусы:</span>
        <div className="inline-flex items-center gap-1.5 text-emerald-200">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "9999px",
              backgroundColor: "rgba(34,197,94,1)",
            }}
          />
          <span>Успешно (SENT_*)</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-red-200">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "9999px",
              backgroundColor: "rgba(248,113,113,1)",
            }}
          />
          <span>Ошибка (остальные статусы)</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-amber-100">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "9999px",
              backgroundColor: "rgba(251,191,36,1)",
            }}
          />
          <span>Пропуск (SKIPPED / ALREADY)</span>
        </div>
        <span className="text-muted">
          Цвет бэйджа показывает тип, подпись — «Успешно», «Ошибка» или
          «Пропуск».
        </span>
      </div>

      {/* Переключатель волна/хвост */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-[rgba(15,23,42,0.9)] border border-[var(--border-soft)] p-1">
          <button
            className={
              "text-[12px] px-3 py-1 rounded-full transition-colors " +
              (!showTail
                ? "bg-[rgba(255,255,255,0.08)] text-light"
                : "text-muted")
            }
            onClick={() => setShowTail(false)}
          >
            Последняя волна ({totalWave})
          </button>
          <button
            className={
              "text-[12px] px-3 py-1 rounded-full transition-colors " +
              (showTail
                ? "bg-[rgba(255,255,255,0.08)] text-light"
                : "text-muted")
            }
            onClick={() => setShowTail(true)}
          >
            Хвост ({totalTail})
          </button>
        </div>
        <div className="text-[11px] text-muted">
          Показаны максимум{" "}
          <span className="font-semibold">200</span> последних строк
          выбранного источника.
        </div>
      </div>

      {/* Таблица */}
      <div className="border border-[var(--border-soft)] rounded-2xl overflow-hidden bg-[rgba(8,12,20,0.95)] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        <div className="px-3 py-2 border-b border-[rgba(148,163,184,0.25)] flex items-center justify-between bg-[rgba(15,23,42,0.98)]">
          <div className="text-[13px] font-medium text-light">
            {showTail ? "Хвост истории" : "Последняя волна"}
          </div>
          <div className="text-[11px] text-muted">
            Всего записей:{" "}
            <span className="font-semibold text-light">
              {rowsToShow.length}
            </span>
          </div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full text-[12px]">
            <thead className="text-left text-muted border-b border-[var(--border-soft)] sticky top-0 bg-[rgba(7,11,20,0.98)] backdrop-blur">
              <tr>
                <th className="px-3 py-2 w-[150px]">Время</th>
                <th className="px-3 py-2 w-[130px]">Телефон</th>
                <th className="px-3 py-2 w-[160px]">Имя</th>
                <th className="px-3 py-2 w-[140px]">Статус</th>
                <th className="px-3 py-2">Детали</th>
              </tr>
            </thead>
            <tbody>
              {rowsToShow
                .slice()
                .reverse()
                .slice(0, 200)
                .map((r, idx) => {
                  const [datePart, timePart] = (r.timestamp || "")
                    .trim()
                    .split(" ");
                  return (
                    <tr
                      key={idx}
                      className="border-b border-[rgba(148,163,184,0.12)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                    >
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <div className="text-[11px] text-muted">
                          {datePart || "—"}
                        </div>
                        <div className="text-[12px] font-mono text-light">
                          {timePart || ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span className="font-mono text-[12px]">
                          {r.phone}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {r.name ? (
                          <span className="truncate block max-w-[180px]">
                            {r.name}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="block text-[11px] text-muted max-w-xl truncate">
                          {detailsDisplay(r.details)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {!rowsToShow.length && !loading && (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-muted text-sm"
                    colSpan={5}
                  >
                    Пока нет данных в <code>results.csv</code>. Запусти
                    первую рассылку — и здесь появятся записи.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
