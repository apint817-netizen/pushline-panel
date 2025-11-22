// panel/src/sections/BroadcastSection.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import BroadcastScriptEditor from "../components/BroadcastScriptEditor";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border-soft)] rounded-lg p-3 text-light bg-[rgba(255,255,255,0.02)]">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      <div className="text-xl font-semibold leading-none">{value}</div>
    </div>
  );
}

type BroadcastStatus = "idle" | "running" | "paused" | "done";
type MediaMode = "image" | "video" | "both" | "text";

type SendOrder = "media_then_text" | "text_then_media";
type TextPlacement = "caption_only" | "separate_only" | "both";

export default function BroadcastSection({
  safeMode,
  totalInitStateKey,
  pushToast,
}: {
  safeMode: boolean;
  totalInitStateKey: string;
  pushToast: (text: string) => void;
}) {
  // ===== STATE =====
  const [totalPlanned, setTotalPlanned] = useState<number>(() => {
    const v = localStorage.getItem(totalInitStateKey);
    return v ? Math.max(0, Number(v)) : 200;
  });

  const [status, setStatus] = useState<BroadcastStatus>("idle");
  const [sent, setSent] = useState(0);
  const [errors, setErrors] = useState(0);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // waves (фактические во время прогона)
  const [wavesTotal, setWavesTotal] = useState<number>(0);
  const [waveIndex, setWaveIndex] = useState<number>(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownCountdown, setCooldownCountdown] = useState<string>("—");

  // план по волнам (доступен даже до старта)
  const [plannedWaves, setPlannedWaves] = useState<number>(0);
  const [plannedLimit, setPlannedLimit] = useState<number>(0);

  const [templates, setTemplates] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  // тестовая отправка
  const [testPhone, setTestPhone] = useState<string>("");
  const [testName, setTestName] = useState<string>("");

  // PIN администратора
  const [adminPinCache, setAdminPinCache] = useState<string>("");

  // режим медиа (только одно! / комбинация по типу)
  const [mediaMode, setMediaMode] = useState<MediaMode>("image");

  // тумблер авто-волн
  const [autoWaves, setAutoWaves] = useState<boolean>(true);

  // порядок и режим текста относительно медиа
  const [sendOrder, setSendOrder] = useState<SendOrder>("media_then_text");
  const [textPlacement, setTextPlacement] =
    useState<TextPlacement>("caption_only");

  // инфо о медиа (сервер говорит что реально лежит на диске)
  const [mediaInfo, setMediaInfo] = useState<{
    image: null | { filename: string; webUrl: string; path?: string };
    images: { filename: string; webUrl: string; path?: string }[];
    video: null | { filename: string; webUrl: string; path?: string };
  }>({
    image: null,
    images: [],
    video: null,
  });

  const [arCounts, setArCounts] = useState<{ thanks: number; negative: number }>(
    {
      thanks: 0,
      negative: 0,
    }
  );
  const [arPreview, setArPreview] = useState<{ thanks: string[]; negative: string[] }>(
    {
      thanks: [],
      negative: [],
    }
  );

  // ===== refs для «умного» лога переходов =====
  const prevStatus = useRef<BroadcastStatus>("idle");
  const prevWave = useRef<number>(0);
  const prevCooldown = useRef<number | null>(null);
  const prevPlanSig = useRef<string>("");

  async function reloadAutoReplies() {
    try {
      const resp = await fetch("http://localhost:3001/autoreplies");
      const data = await resp.json();
      if (data.ok) {
        setArCounts(data.counts || { thanks: 0, negative: 0 });
        setArPreview(data.preview || { thanks: [], negative: [] });
      }
    } catch {}
  }

  function pushLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} • ${line}`, ...prev].slice(0, 80));
  }

  async function handleClearMedia() {
    try {
      const resp = await fetch("http://localhost:3001/broadcast/media/clear", {
        method: "POST",
      });
      const data = await resp.json().catch(() => ({}));

      if (data.ok) {
        pushToast("Медиа для рассылки очищено");
        pushLog("Очищены файлы медиа для рассылки (image/video)");
        setMediaInfo({ image: null, images: [], video: null });
      } else {
        pushToast("Не удалось очистить медиа");
        pushLog(
          `broadcast/media/clear: ошибка очистки (${(data as any).error || "?"})`
        );
      }
    } catch {
      pushToast("Сервер 3001 недоступен (media clear)");
      pushLog("broadcast/media/clear: нет соединения");
    }
  }

  async function handleUploadAutoReplies(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (!input?.files?.length) {
      alert("Выберите .json или .txt");
      return;
    }
    const form = new FormData();
    form.append("file", input.files[0]);

    try {
      const resp = await fetch("http://localhost:3001/upload-autoreplies", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (data.ok) {
        pushToast(
          `Авто-ответы: спасибо=${data.counts?.thanks ?? 0}, негатив=${data.counts?.negative ?? 0}`
        );
        pushLog(
          `Загружены авто-ответы: T=${data.counts?.thanks ?? 0}, N=${
            data.counts?.negative ?? 0
          }`
        );
        reloadAutoReplies();
      } else {
        pushToast(`Ошибка авто-ответов: ${data.error || "?"}`);
        pushLog(`Ошибка upload-autoreplies: ${data.error || "?"}`);
      }
    } catch {
      pushToast("Сервер недоступен (auto-replies)");
      pushLog("upload-autoreplies: нет соединения");
    }
  }

  async function reloadTemplates() {
    try {
      const resp = await fetch("http://localhost:3001/templates");
      const data = await resp.json();
      if (data.ok && Array.isArray(data.templates)) {
        setTemplates(data.templates);
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    }
  }

  async function reloadMedia() {
    try {
      const resp = await fetch("http://localhost:3001/broadcast/media");
      const data = await resp.json();

      if (data.ok) {
        const img = data.image
          ? {
              filename: data.image.filename,
              webUrl: data.image.webUrl ? `http://localhost:3001${data.image.webUrl}` : "",
              path: data.image.path || "",
            }
          : null;

        const imagesArr: { filename: string; webUrl: string; path?: string }[] = Array.isArray(
          data.images
        )
          ? data.images.map((it: any) => ({
              filename: it.filename,
              webUrl: it.webUrl ? `http://localhost:3001${it.webUrl}` : "",
              path: it.path || "",
            }))
          : img
          ? [img]
          : [];

        const vid = data.video
          ? {
              filename: data.video.filename,
              webUrl: data.video.webUrl ? `http://localhost:3001${data.video.webUrl}` : "",
              path: data.video.path || "",
            }
          : null;

        setMediaInfo({
          image: img,
          images: imagesArr,
          video: vid,
        });
      }
    } catch {}
  }

  const effectiveTotal = useMemo(() => totalPlanned, [totalPlanned]);
  const totalForProgress = serverTotal || effectiveTotal || 0;
  const progressPct =
    totalForProgress === 0 ? 0 : Math.min(100, Math.round((sent / totalForProgress) * 100));
  const successRate =
    sent + errors === 0 ? 100 : Math.round(((sent - errors) / Math.max(sent, 1)) * 100);

  const eta = useMemo(() => {
    if (!startedAt || status !== "running" || sent === 0) return "—";
    const elapsedMs = Date.now() - startedAt;
    const perMsgMs = elapsedMs / sent;
    const left = Math.max(totalForProgress - sent, 0);
    const etaMs = perMsgMs * left;
    const etaMin = Math.ceil(etaMs / 60000);
    return `${etaMin} мин`;
  }, [startedAt, status, sent, totalForProgress]);

  async function handleUploadContacts(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null;
    if (!input?.files?.length) {
      alert("Выберите CSV-файл");
      return;
    }
    const formData = new FormData();
    formData.append("file", input.files[0]);

    try {
      const resp = await fetch("http://localhost:3001/upload-contacts", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (data.ok) {
        pushToast(`Контактов загружено: ${data.rows}`);
        pushLog(`Импортировано ${data.rows} контактов`);
      } else {
        pushToast(`Ошибка импорта: ${data.error || "?"}`);
        pushLog(`Ошибка импорта контактов: ${data.error || "?"}`);
      }
    } catch {
      pushToast("Сервер недоступен (contacts)");
      pushLog("upload-contacts: нет соединения");
    }
  }

  async function handleUploadTemplates(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null;
    if (!input?.files?.length) {
      alert("Выберите файл шаблонов (.txt или .json)");
      return;
    }
    const formData = new FormData();
    formData.append("file", input.files[0]);

    try {
      const resp = await fetch("http://localhost:3001/upload-templates", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (data.ok) {
        pushToast(`Шаблонов добавлено: ${data.templates}`);
        pushLog(`Импортировано ${data.templates} шаблонов`);
        await reloadTemplates();
      } else {
        pushToast(`Ошибка шаблонов: ${data.error || "?"}`);
        pushLog(`Ошибка шаблонов: ${data.error || "?"}`);
      }
    } catch {
      pushToast("Сервер недоступен (templates)");
      pushLog("upload-templates: нет соединения");
    }
  }

  async function handleUploadImage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      'input[name="imgFile"]'
    ) as HTMLInputElement | null;
    if (!input?.files || input.files.length === 0) {
      alert("Выберите изображение (jpg/png)");
      return;
    }

    const files = Array.from(input.files);
    let successCount = 0;

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);

      try {
        const resp = await fetch("http://localhost:3001/upload-media/image", {
          method: "POST",
          body: fd,
        });
        const data = await resp.json();
        if (data.ok) {
          successCount += 1;
          pushLog(`Картинка загружена: ${data.filename || file.name}`);
        } else {
          pushLog(
            `Ошибка upload-media/image для ${file.name}: ${data.error || "нет подробностей"}`
          );
        }
      } catch {
        pushLog(`upload-media/image: нет соединения при загрузке ${file.name}`);
      }
    }

    if (successCount > 0) {
      pushToast(
        successCount === 1 ? "Картинка загружена" : `Картинок загружено: ${successCount}`
      );
      setMediaMode(mediaInfo.video ? "both" : "image");
      reloadMedia();
    } else {
      pushToast("Не удалось загрузить картинки");
    }

    (input as HTMLInputElement).value = "";
  }

  async function handleUploadVideo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector(
      'input[name="vidFile"]'
    ) as HTMLInputElement | null;
    if (!input?.files || input.files.length === 0) {
      alert("Выберите видео (mp4)");
      return;
    }

    const files = Array.from(input.files);
    let successCount = 0;

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);

      try {
        const resp = await fetch("http://localhost:3001/upload-media/video", {
          method: "POST",
          body: fd,
        });
        const data = await resp.json();
        if (data.ok) {
          successCount += 1;
          pushLog(`Видео загружено: ${data.filename || file.name}`);
        } else {
          pushLog(
            `Ошибка upload-media/video для ${file.name}: ${data.error || "нет подробностей"}`
          );
        }
      } catch {
        pushLog(`upload-media/video: нет соединения при загрузке ${file.name}`);
      }
    }

    if (successCount > 0) {
      pushToast(
        successCount === 1 ? "Видео загружено" : `Видео загружено: ${successCount} шт.`
      );
      setMediaMode(mediaInfo.image ? "both" : "video");
      reloadMedia();
    } else {
      pushToast("Не удалось загрузить видео");
    }

    (input as HTMLInputElement).value = "";
  }

  async function handleStart() {
    if (status === "running") return;
    const pin = adminPinCache || window.prompt("PIN администратора:") || "";
    if (!pin) {
      pushLog("Старт отменён: PIN не введён");
      return;
    }
    setAdminPinCache(pin);

    if (autoWaves) {
      pushLog(`Старт авто-волн (режим: ${mediaMode})...`);
      pushToast("Старт авто-волн…");
      try {
        const resp = await fetch("http://localhost:3001/broadcast/fire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminPin: pin,
            mode: mediaMode,
            order: sendOrder,
            textPlacement,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 403 || (data as any).error === "forbidden") {
          pushLog("Запуск отклонён: неверный PIN");
          pushToast("PIN не подошёл");
          return;
        }
        if ((data as any).ok) {
          pushLog("Авто-волны запущены");
        } else {
          pushLog(`Ошибка запуска авто-волн: ${(data as any).error || "?"}`);
          pushToast("Ошибка запуска");
        }
      } catch {
        pushLog("broadcast/fire: нет соединения");
        pushToast("Сервер 3001 недоступен");
      }
    } else {
      pushLog(`Старт одной волны (режим: ${mediaMode})...`);
      pushToast("Старт волны…");
      try {
        const resp = await fetch("http://localhost:3001/broadcast/wave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminPin: pin,
            mode: mediaMode,
            order: sendOrder,
            textPlacement,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 403 || (data as any).error === "forbidden") {
          pushLog("Волна отклонена: неверный PIN");
          pushToast("PIN не подошёл");
          return;
        }
        if ((data as any).ok) {
          pushLog("Волна выполнена");
        } else {
          pushLog(`Ошибка волны: ${(data as any).error || "?"}`);
          pushToast("Ошибка волны");
        }
      } catch {
        pushLog("broadcast/wave: нет соединения");
        pushToast("Сервер 3001 недоступен");
      }
    }
  }

  async function handlePause() {
    try {
      const resp = await fetch("http://localhost:3001/broadcast/pause", {
        method: "POST",
      });
      const data = await resp.json().catch(() => ({}));
      pushLog("Пауза отправлена");
      setStatus((data as any && (data as any).status) || "paused");
      pushToast("Поставлено на паузу");
    } catch {
      pushLog("broadcast/pause: нет соединения");
      pushToast("Ошибка паузы");
    }
  }

  async function handleStop() {
    try {
      const resp = await fetch("http://localhost:3001/broadcast/stop", {
        method: "POST",
      });
      const data = await resp.json().catch(() => ({}));
      if ((data as any).ok || (data as any).status) {
        pushLog("Рассылка остановлена (STOP)");
        pushToast("Остановлено");
        setStatus("done");
      } else {
        pushLog("broadcast/stop: не удалось остановить");
        pushToast("Не удалось остановить");
      }
    } catch {
      pushLog("broadcast/stop: нет соединения");
      pushToast("Ошибка стопа");
    }
  }

  function handleResetLocal() {
    setStatus("idle");
    setSent(0);
    setErrors(0);
    setServerTotal(0);
    setStartedAt(null);
    setWavesTotal(0);
    setWaveIndex(0);
    setCooldownUntil(null);
    setCooldownCountdown("—");
    setLog([]);
    pushLog("Локальный сброс панели. На бэке история не очищена.");
  }

  async function handleTestSend() {
    const pin = adminPinCache || window.prompt("PIN администратора:") || "";
    if (!pin) {
      pushLog("Тест отменён: PIN не введён");
      return;
    }
    setAdminPinCache(pin);

    if (!testPhone.trim()) {
      pushToast("Укажи номер для теста");
      return;
    }

    const text = templates[0] || "Тест рассылки";
    try {
      const resp = await fetch("http://localhost:3001/broadcast/test-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testPhone.trim(),
          text,
          mode: mediaMode,
          order: sendOrder,
          textPlacement,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if ((data as any).ok) {
        pushToast(
          mediaMode === "text" ? "Тест (текст) ушёл ✅" : `Тест (${mediaMode}) ушёл ✅`
        );
        pushLog(`Тест (${mediaMode}) отправлен на ${testPhone}`);
      } else {
        pushToast("Ошибка тестовой отправки ❌");
        pushLog(`Ошибка test-direct: ${(data as any).error || "?"}`);
      }
    } catch {
      pushToast("Сервер 3001 недоступен (test-direct)");
      pushLog("broadcast/test-direct: нет соединения");
    }
  }

  useEffect(() => {
    localStorage.setItem(totalInitStateKey, String(totalPlanned));
  }, [totalPlanned, totalInitStateKey]);

  useEffect(() => {
    reloadTemplates();
    reloadMedia();
    reloadAutoReplies();
  }, []);

  useEffect(() => {
    let stop = false;

    async function poll() {
      try {
        const r = await fetch("http://localhost:3001/broadcast/status");
        const data = (await r.json()) as {
          ok: boolean;
          status: BroadcastStatus;
          sent: number;
          errors: number;
          total: number;
          startedAt: number | null;
          wavesTotal?: number;
          waveIndex?: number;
          cooldownUntil?: number | null;
          plan?: { waves: number; limit: number };
        };

        if (stop || !data?.ok) return;

        setStatus(data.status || "idle");
        setSent(data.sent ?? 0);
        setErrors(data.errors ?? 0);
        setServerTotal(data.total ?? 0);
        setStartedAt(data.startedAt ?? null);

        setWavesTotal(data.wavesTotal ?? 0);
        setWaveIndex(data.waveIndex ?? 0);
        setCooldownUntil(data.cooldownUntil ?? null);

        const planW = data.plan?.waves ?? 0;
        const planL = data.plan?.limit ?? 0;
        setPlannedWaves(planW);
        setPlannedLimit(planL);

        const prevS = prevStatus.current;
        const prevW = prevWave.current;
        const prevCd = prevCooldown.current;

        const curPlanSig = `${planW}|${planL}`;
        if (curPlanSig !== prevPlanSig.current && planW > 0) {
          pushLog(`План обновлён • волн: ${planW}, лимит: ${planL}/волну`);
          prevPlanSig.current = curPlanSig;
        }

        if (prevS !== data.status) {
          if (prevS === "idle" && data.status === "running") {
            const wi = data.waveIndex ?? 1;
            const wt = data.wavesTotal || planW || "—";
            pushLog(`Старт рассылки • Волна ${wi}/${wt}`);
          } else if (data.status === "paused") {
            pushLog("Пауза");
          } else if (data.status === "done") {
            pushLog(
              `Завершено • Отправлено: ${data.sent} • Ошибок: ${data.errors}`
            );
          } else {
            pushLog(`Статус: ${String(data.status).toUpperCase()}`);
          }
        }

        if (
          (data.waveIndex ?? 0) > 0 &&
          (data.waveIndex ?? 0) !== prevW &&
          (data.cooldownUntil ?? 0) > Date.now()
        ) {
          const wt = data.wavesTotal || planW || "—";
          pushLog(
            `Волна ${prevW}/${wt} завершена • Пауза до ${new Date(
              data.cooldownUntil!
            ).toLocaleTimeString()}`
          );
        }

        const cdWasActive = !!prevCd && prevCd > Date.now();
        const cdNowInactive =
          !data.cooldownUntil || (data.cooldownUntil as number) <= Date.now();
        if (cdWasActive && cdNowInactive && (data.waveIndex ?? 0) > (prevW ?? 0)) {
          const wt = data.wavesTotal || planW || "—";
          pushLog(`Старт волны ${data.waveIndex}/${wt}`);
        }

        prevStatus.current = data.status;
        prevWave.current = data.waveIndex ?? 0;
        prevCooldown.current = data.cooldownUntil ?? null;
      } catch {}
    }

    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let timer: any;
    function tick() {
      if (!cooldownUntil) {
        setCooldownCountdown("—");
        return;
      }
      const leftMs = Math.max(0, cooldownUntil - Date.now());
      const m = Math.floor(leftMs / 60000);
      const s = Math.floor((leftMs % 60000) / 1000);
      setCooldownCountdown(`${m}:${String(s).padStart(2, "0")}`);
    }
    tick();
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const displayWavesTotal = wavesTotal || plannedWaves || 0;
  const displayWaveIndex = Math.max(waveIndex, 0);

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {/* 1. Контакты */}
      <div className="card md:col-span-1">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Контакты (CSV)
        </h3>
        <form onSubmit={handleUploadContacts}>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-xs text-muted mb-3"
          />
          <button type="submit" className="btn btn-primary w-full">
            Загрузить контакты
          </button>
        </form>
        <p className="text-[11px] text-muted mt-2 leading-snug">
          Формат:
          <br />
          +79001234567,Иван
          <br />
          Иван,+79001234567
        </p>
      </div>

      {/* 2. Шаблоны */}
      <div className="card md:col-span-1">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Шаблоны (txt/json)
        </h3>

        <form onSubmit={handleUploadTemplates}>
          <input
            type="file"
            accept=".json,.txt"
            className="block w-full text-xs text-muted mb-3"
          />
          <button type="submit" className="btn btn-primary w-full">
            Загрузить шаблоны
          </button>
        </form>

        <p className="text-[11px] text-muted mt-2 leading-snug">
          В тексте можно использовать{" "}
          <code className="text-[var(--accent)] font-mono text-[11px] bg-[rgba(255,122,26,0.08)] px-1 py-[1px] rounded">
            {`{name}`}
          </code>{" "}
          для подстановки имени.
        </p>
      </div>

      {/* 2.1 Авто-ответы */}
      <div className="card md:col-span-1">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Авто-ответы (json/txt)
        </h3>

        <form onSubmit={handleUploadAutoReplies}>
          <input
            type="file"
            accept=".json,.txt"
            className="block w-full text-xs text-muted mb-3"
          />
          <button type="submit" className="btn btn-primary w-full">
            Загрузить авто-ответы
          </button>
        </form>

        <div className="text-[11px] text-muted mt-2 leading-snug">
          Форматы:
          <br />• JSON: {"{ thanks:[...], negative:[...] }"}
          <br />• TXT: строки = спасибо. Разделитель:{" "}
          <code>===NEGATIVE===</code>
        </div>

        <div className="mt-3 border border-[var(--border-soft)] rounded-lg p-2 bg-[rgba(255,255,255,0.02)]">
          <div className="text-[12px] text-light font-medium mb-1">
            Загружено
          </div>
          <div className="text-[11px] text-muted">
            Спасибо: <b>{arCounts.thanks}</b>, Негатив:{" "}
            <b>{arCounts.negative}</b>
          </div>

          {arPreview.thanks?.length || arPreview.negative?.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] text-muted mb-1">
                  Примеры «спасибо»
                </div>
                <ul className="space-y-1 text-[12px]">
                  {arPreview.thanks.slice(0, 2).map((t, i) => (
                    <li
                      key={i}
                      className="border border-[var(--border-soft)] rounded p-2"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] text-muted mb-1">
                  Примеры «негатив»
                </div>
                <ul className="space-y-1 text-[12px]">
                  {arPreview.negative.slice(0, 2).map((t, i) => (
                    <li
                      key={i}
                      className="border border-[var(--border-soft)] rounded p-2"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Медиа и режим */}
      <div className="card md:col-span-1">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Медиа и режим
        </h3>

        {/* режимы */}
        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">Режим отправки</div>
          <div className="flex flex-wrap gap-2">
            <label className="chip-btn cursor-pointer text-[11px]">
              <input
                type="radio"
                name="mediaMode"
                className="mr-1"
                checked={mediaMode === "image"}
                onChange={() => setMediaMode("image")}
              />
              Картинка
            </label>
            <label className="chip-btn cursor-pointer text-[11px]">
              <input
                type="radio"
                name="mediaMode"
                className="mr-1"
                checked={mediaMode === "video"}
                onChange={() => setMediaMode("video")}
              />
              Видео
            </label>
            <label className="chip-btn cursor-pointer text-[11px]">
              <input
                type="radio"
                name="mediaMode"
                className="mr-1"
                checked={mediaMode === "both"}
                onChange={() => setMediaMode("both")}
              />
              Картинка + видео
            </label>
            <label className="chip-btn cursor-pointer text-[11px]">
              <input
                type="radio"
                name="mediaMode"
                className="mr-1"
                checked={mediaMode === "text"}
                onChange={() => setMediaMode("text")}
              />
              Только текст
            </label>
          </div>
          <div className="text-[10px] text-muted mt-1">
            Отправим выбранный режим: только картинку, только видео, оба файла
            или чистый текст.
          </div>
        </div>

        {/* порядок медиа/текста */}
        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">Порядок отправки</div>
          <div className="flex flex-col gap-1 text-[11px]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendOrder"
                checked={sendOrder === "media_then_text"}
                onChange={() => setSendOrder("media_then_text")}
              />
              <span>Сначала медиа, потом текст</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendOrder"
                checked={sendOrder === "text_then_media"}
                onChange={() => setSendOrder("text_then_media")}
              />
              <span>Сначала текст, потом медиа</span>
            </label>
          </div>
          <div className="text-[10px] text-muted mt-1">
            Работает только если выбран режим с медиа (картинка/видео/оба).
          </div>
        </div>

        {/* текст относительно медиа */}
        <div className="mb-4">
          <div className="text-[11px] text-muted mb-1">Текст и медиа</div>
          <div className="flex flex-col gap-1 text-[11px]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="textPlacement"
                checked={textPlacement === "caption_only"}
                onChange={() => setTextPlacement("caption_only")}
              />
              <span>Только как подпись к медиа</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="textPlacement"
                checked={textPlacement === "separate_only"}
                onChange={() => setTextPlacement("separate_only")}
              />
              <span>Только отдельным текстовым сообщением</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="textPlacement"
                checked={textPlacement === "both"}
                onChange={() => setTextPlacement("both")}
              />
              <span>И подпись, и отдельное сообщение</span>
            </label>
          </div>
          <div className="text-[10px] text-muted mt-1">
            Например, чтобы «привязать» конкретный текст к картинке — выбери
            «только как подпись к медиа».
          </div>
        </div>

        {/* загрузка медиа + превью */}
        <div className="space-y-4 text-sm">
          <form onSubmit={handleUploadImage}>
            <label className="block text-[11px] text-muted mb-1">
              Картинки (jpg/png, можно несколько)
            </label>
            <input
              type="file"
              name="imgFile"
              accept="image/*"
              multiple
              className="block w-full text-xs text-muted mb-2"
            />
            <button type="submit" className="chip-btn w-full text-[11px]">
              Загрузить картинку(и)
            </button>
          </form>

          <form onSubmit={handleUploadVideo}>
            <label className="block text-[11px] text-muted mb-1">
              Видео (mp4, можно несколько)
            </label>
            <input
              type="file"
              name="vidFile"
              accept="video/mp4,video/*"
              multiple
              className="block w-full text-xs text-muted mb-2"
            />
            <button type="submit" className="chip-btn w-full text-[11px]">
              Загрузить видео
            </button>
          </form>

          <button
            type="button"
            className="chip-btn w-full text-[11px]"
            onClick={handleClearMedia}
          >
            Очистить медиа (картинки/видео)
          </button>

          <div className="text-[11px] text-muted leading-snug border border-[var(--border-soft)] rounded-lg p-2 bg-[rgba(255,255,255,0.02)] space-y-3">
            {/* КАРТИНКИ */}
            {mediaInfo.images && mediaInfo.images.length > 0 ? (
              <div
                className={
                  mediaMode === "image" || mediaMode === "both"
                    ? "ring-1 ring-[var(--accent)] rounded-lg p-1 -m-1"
                    : ""
                }
              >
                <div className="text-light text-[12px] font-medium mb-1">
                  Картинки (все загруженные):
                </div>

                {/* компактная сетка превью */}
                <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1">
                  {mediaInfo.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="border border-[var(--border-soft)] rounded p-1 bg-[rgba(0,0,0,0.15)]"
                    >
                      <div className="text-[8px] text-muted mb-1">
                        #{idx + 1}
                      </div>
                      {img.webUrl ? (
                        <div className="flex justify-center">
                          <div className="media-preview-thumb rounded border border-[var(--border-soft)] overflow-hidden bg-[rgba(0,0,0,0.4)]">
                            <img
                              src={img.webUrl}
                              alt={`preview-${idx}`}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted text-center">
                          (нет превью)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-2">Картинки не загружены</div>
            )}

            {/* ВИДЕО */}
            {mediaInfo.video ? (
              <div
                className={`${
                  mediaMode === "video" || mediaMode === "both"
                    ? "ring-1 ring-[var(--accent)] rounded-lg p-1 -m-1"
                    : ""
                }`}
              >
                <div className="text-light text-[12px] font-medium">
                  Видео (последнее загруженное):
                </div>
                <div className="break-all text-[11px] mb-1">
                  {mediaInfo.video.filename}
                </div>
                {mediaInfo.video.webUrl ? (
                  <div className="mt-2">
                    <video
                      src={mediaInfo.video.webUrl}
                      className="max-h-16 max-w-full rounded border border-[var(--border-soft)]"
                      controls
                    />
                  </div>
                ) : (
                  <div className="text-[10px] text-muted">(нет превью)</div>
                )}
              </div>
            ) : (
              <div>Видео не загружено</div>
            )}
          </div>
        </div>
      </div>

      {/* 3.5 Сценарий */}
      <div className="card md:col-span-2">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Сценарий рассылки (последовательность)
        </h3>
        <p className="text-[11px] text-muted mb-3 leading-snug">
          Здесь можно задать порядок сообщений: текст, картинки, видео. Если сценарий
          сохранён, рассылка будет идти строго по этим шагам. Настройки режима медиа
          выше используются только когда сценария нет.
        </p>
        <BroadcastScriptEditor mediaInfo={mediaInfo} pushToast={pushToast} />
      </div>

      {/* 4. Активные тексты */}
      <div className="card md:col-span-1">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-[var(--accent)] font-semibold text-sm uppercase tracking-wide">
            Активные тексты
          </h3>
          <button
            className="chip-btn text-[11px] px-2 py-1"
            onClick={reloadTemplates}
            title="Обновить список"
          >
            Обновить
          </button>
        </div>
        {templates.length === 0 ? (
          <div className="text-[11px] text-muted leading-snug">
            Шаблоны не загружены.
            <br />
            Добавь .txt / .json слева ↑
          </div>
        ) : (
          <>
            <ul className="text-[12px] space-y-2 max-h-32 overflow-auto pr-1">
              {templates.slice(0, 4).map((tpl, i) => (
                <li
                  key={i}
                  className="border border-[var(--border-soft)] rounded-lg p-2 bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="text-[10px] text-muted mb-1 font-mono">
                    Вариант #{i + 1}
                  </div>
                  <div className="whitespace-pre-wrap leading-snug text-light text-[13px]">
                    {tpl}
                  </div>
                </li>
              ))}
            </ul>
            {templates.length > 4 && (
              <div className="text-[10px] text-muted mt-2">
                + ещё {templates.length - 4} вариантов…
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. Тестовая отправка */}
      <div className="card md:col-span-1">
        <h3 className="text-[var(--accent)] font-semibold mb-3 text-sm uppercase tracking-wide">
          Тест перед стартом
        </h3>
        <label className="block text-[11px] text-muted mb-1">
          Номер для теста
        </label>
        <input
          className="input-shell w-full mb-2 text-[13px]"
          placeholder="+79001234567"
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
        />
        <label className="block text-[11px] text-muted mb-1">
          Имя (опционально)
        </label>
        <input
          className="input-shell w-full mb-3 text-[13px]"
          placeholder="Иван"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
        />
        <button
          className="btn btn-outline w-full text-[13px]"
          onClick={handleTestSend}
        >
          Отправить тест
        </button>
        <p className="text-[10px] text-muted mt-2 leading-snug">
          Отправим один шаблон прямо сейчас через WhatsApp-бота на указанный
          номер.
        </p>
      </div>

      {/* 6. Управление рассылкой */}
      <div className="card md:col-span-4">
        <h3 className="text-[var(--accent)] font-semibold mb-4 text-sm uppercase tracking-wide">
          Управление рассылкой
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Левая колонка */}
          <div className="md:col-span-1 space-y-4">
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted text-[12px]">
                  Получателей (план)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={totalPlanned}
                  onChange={(e) =>
                    setTotalPlanned(Math.max(0, Number(e.target.value)))
                  }
                  className="input-shell w-24 text-right py-1 px-2 text-[13px]"
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted">Авто-волны</span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoWaves}
                    onChange={(e) => setAutoWaves(e.target.checked)}
                  />
                  <span className="text-[12px] text-light">
                    {autoWaves ? "включены" : "выключены"}
                  </span>
                </label>
              </div>

              <div className="text-[11px] text-muted leading-snug">
                Сервер сейчас считает <b>{serverTotal || "0"}</b> контактов
                готовыми к отправке.
                <br />
                SAFE MODE: {safeMode ? "вкл" : "выкл"}
                <br />
                Режим: <b>{mediaMode}</b>
                <br />
                <span className="opacity-80">
                  План: <b>{plannedWaves || 0}</b> волн, лимит{" "}
                  <b>{plannedLimit || 0}</b>/волну
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {status !== "running" && (
                <button className="btn btn-primary flex-1" onClick={handleStart}>
                  Старт
                  {autoWaves ? " (авто-волны)" : " (1 волна)"}
                </button>
              )}
              {status === "running" && (
                <button
                  className="chip-btn flex-1 text-[12px]"
                  onClick={handlePause}
                >
                  Пауза
                </button>
              )}
              <button
                className="chip-btn flex-1 text-[12px]"
                onClick={handleStop}
              >
                Стоп
              </button>
              <button
                className="chip-btn flex-none text-[12px]"
                onClick={handleResetLocal}
              >
                Сброс
              </button>
            </div>

            <div className="text-[11px] text-muted leading-snug">
              • <b>Старт</b> —{" "}
              {autoWaves
                ? "автоматически все волны (с паузами)"
                : "одна волна на лимит SAFE_MODE_LIMIT"}
              .
              <br />
              • <b>Пауза</b> — метка "paused".
              <br />
              • <b>Стоп</b> — принудительно завершить как "done".
              <br />
              • <b>Сброс</b> — очистить локальные метрики UI.
            </div>
          </div>

          {/* Прогресс и лог */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="w-full h-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--border-soft)] overflow-hidden">
                <div
                  className="h-full transition-[width] duration-300 ease-out"
                  style={{
                    background:
                      "radial-gradient(circle at 0% 0%, var(--accent) 0%, var(--accent-dark) 80%)",
                    width: `${progressPct}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-3 text-center mt-4">
                <Kpi
                  label="Отправлено"
                  value={`${Math.min(sent, totalForProgress)} / ${totalForProgress}`}
                />
                <Kpi label="Ошибки" value={`${errors}`} />
                <Kpi label="Успешно" value={`${successRate}%`} />
                <Kpi label="ETA" value={eta} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center mt-3">
                <Kpi
                  label="Волна"
                  value={`${displayWaveIndex}/${displayWavesTotal || "—"}`}
                />
                <Kpi
                  label="Пауза до след. волны"
                  value={cooldownCountdown}
                />
                <Kpi label="Статус" value={status.toUpperCase()} />
              </div>
            </div>

            <div>
              <h4 className="text-[12px] text-muted mb-2">
                Лог (последние события)
              </h4>
              <div className="max-h-[28vh] overflow-auto border border-[var(--border-soft)] rounded-xl p-2 text-[12px] bg-[rgba(255,255,255,0.02)]">
                {log.length === 0 ? (
                  <div className="text-muted text-[11px]">
                    Лог появится после действий (старт, тест, стоп…)
                  </div>
                ) : (
                  <ul className="space-y-1 text-[12px] leading-snug">
                    {log.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
