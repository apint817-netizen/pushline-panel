// panel/src/components/BroadcastScriptEditor.tsx
import React, { useEffect, useState } from "react";
import {
  fetchTemplatesActive,
  uploadTemplatesFile,
  getBroadcastScript,
  saveBroadcastScript,
  ScriptStepApi,
} from "../api";

type MediaItem = {
  filename: string;
  webUrl: string;
  path?: string;
};

type MediaInfo = {
  image: null | MediaItem;
  images: MediaItem[];
  video: null | MediaItem;
};

type ScriptStepKind = "text" | "image" | "video";

type ScriptStepLocal = {
  id: string;
  kind: ScriptStepKind;
  text: string;    // текст шага или подпись
  path: string;    // полный путь к файлу (для медиа)
  variants: string[]; // варианты текста/подписи для этого шага
};

function makeId() {
  return `step_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

export default function BroadcastScriptEditor({
  mediaInfo,
  pushToast,
}: {
  mediaInfo: MediaInfo;
  pushToast: (text: string) => void;
}) {
  const [steps, setSteps] = useState<ScriptStepLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // глобальные шаблоны (общие для всей рассылки)
  const [templates, setTemplates] = useState<string[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [uploadingTemplates, setUploadingTemplates] = useState(false);

  const imageOptions = React.useMemo(() => {
    const base =
      mediaInfo.images && mediaInfo.images.length > 0
        ? mediaInfo.images
        : mediaInfo.image
        ? [mediaInfo.image]
        : [];
    return base;
  }, [mediaInfo]);

  const videoOptions = React.useMemo(() => {
    return mediaInfo.video ? [mediaInfo.video] : [];
  }, [mediaInfo]);

  // ==== загрузка сценария при монтировании ====
  useEffect(() => {
    let cancelled = false;
    async function loadScript() {
      try {
        setLoading(true);
        const data = await getBroadcastScript();
        if (!data.ok || !Array.isArray(data.script) || cancelled) return;

        const loaded: ScriptStepLocal[] = (data.script as ScriptStepApi[])
          .map((s, idx) => {
            if (s.type === "text") {
              const vars: string[] = Array.isArray(s.variants)
                ? s.variants
                    .filter((x) => typeof x === "string")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : [];

              return {
                id: makeId() + "_" + idx,
                kind: "text",
                text: s.text,
                path: "",
                variants: vars,
              };
            }

            if (s.type === "media") {
              const vars: string[] = Array.isArray(s.captionVariants)
                ? s.captionVariants
                    .filter((x) => typeof x === "string")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : [];

              return {
                id: makeId() + "_" + idx,
                kind: s.mediaType,
                text: s.caption || "",
                path: s.path,
                variants: vars,
              };
            }

            return null;
          })
          .filter(Boolean) as ScriptStepLocal[];

        if (!cancelled) setSteps(loaded);
      } catch {
        // молча
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadScript();
    return () => {
      cancelled = true;
    };
  }, []);

  // ==== загрузка глобальных шаблонов ====
  async function reloadTemplates() {
    try {
      setTemplatesLoading(true);
      const data = await fetchTemplatesActive();
      if (data.ok && Array.isArray(data.templates)) {
        setTemplates(data.templates as string[]);
      }
    } catch {
      // тихо
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    reloadTemplates();
  }, []);

  // ==== загрузка файла с ГЛОБАЛЬНЫМИ шаблонами ====
  async function handleUploadTemplates(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingTemplates(true);

      const data = await uploadTemplatesFile(file);

      if (data.ok) {
        pushToast(
          `Шаблоны загружены (${data.templates ?? 0}), всего: ${
            data.totalTemplates ?? "?"
          }`
        );
        await reloadTemplates();
      } else {
        pushToast(`Ошибка загрузки шаблонов`);
      }
    } catch {
      pushToast("Не удалось загрузить шаблоны");
    } finally {
      setUploadingTemplates(false);
      e.target.value = "";
    }
  }

  function insertTemplateIntoStep(stepId: string, tpl: string) {
    if (!tpl) return;
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, text: tpl } : s))
    );
  }

  // ==== загрузка файла вариантов для КОНКРЕТНОГО шага ====

  async function parseVariantsFromFile(file: File): Promise<string[]> {
    const buf = await file.text();
    const filename = file.name.toLowerCase();

    let variants: string[] = [];

    try {
      if (filename.endsWith(".json")) {
        const parsed = JSON.parse(buf);
        if (Array.isArray(parsed)) {
          variants = parsed
            .filter((x: any) => typeof x === "string")
            .map((x: string) => x.trim())
            .filter(Boolean);
        } else if (parsed && Array.isArray((parsed as any).templates)) {
          variants = (parsed as any).templates
            .filter((x: any) => typeof x === "string")
            .map((x: string) => x.trim())
            .filter(Boolean);
        }
      } else {
        variants = buf
          .split(/\n\s*\n|---+|===+/g)
          .map((c) => c.trim())
          .filter(Boolean);
      }
    } catch {
      variants = [];
    }

    return variants;
  }

  async function handleVariantsFileForStep(
    stepId: string,
    file: File
  ): Promise<void> {
    const variants = await parseVariantsFromFile(file);
    if (!variants.length) {
      pushToast("Не удалось извлечь варианты из файла");
      return;
    }

    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const nextText =
          s.text && s.text.trim().length > 0 ? s.text : variants[0];
        return { ...s, variants, text: nextText };
      })
    );

    pushToast(`Для шага добавлено вариантов: ${variants.length}`);
  }

  // ==== базовые операции со шагами ====

  function addStep(kind: ScriptStepKind) {
    if (kind === "image" && imageOptions.length === 0) {
      pushToast("Сначала загрузите картинку в блоке «Медиа»");
      return;
    }
    if (kind === "video" && videoOptions.length === 0) {
      pushToast("Сначала загрузите видео в блоке «Медиа»");
      return;
    }

    let initialPath = "";
    if (kind === "image") {
      initialPath = imageOptions[0]?.path || "";
    } else if (kind === "video") {
      initialPath = videoOptions[0]?.path || "";
    }

    const next: ScriptStepLocal = {
      id: makeId(),
      kind,
      text: "",
      path: initialPath,
      variants: [],
    };
    setSteps((prev) => [...prev, next]);
  }

  function updateStep(id: string, patch: Partial<ScriptStepLocal>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function moveStep(id: string, dir: "up" | "down") {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const targetIdx = dir === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = tmp;
      return next;
    });
  }

  // ==== сохранение сценария ====

  async function handleSave() {
    try {
      setSaving(true);

      const payloadScript: ScriptStepApi[] = steps
        .map((s) => {
          if (s.kind === "text") {
            const text = (s.text || "").trim();
            const variants = (s.variants || [])
              .map((v) => v.trim())
              .filter(Boolean);

            if (!text && !variants.length) return null;

            const obj: ScriptStepApi = { type: "text", text };
            if (variants.length) obj.variants = variants;
            return obj;
          }

          if (!s.path) return null;

          const caption = (s.text || "").trim() || "";
          const captionVariants = (s.variants || [])
            .map((v) => v.trim())
            .filter(Boolean);

          const obj: ScriptStepApi = {
            type: "media",
            mediaType: s.kind,
            path: s.path,
          };
          if (caption) obj.caption = caption;
          if (captionVariants.length) obj.captionVariants = captionVariants;

          return obj;
        })
        .filter(Boolean) as ScriptStepApi[];

      const data = await saveBroadcastScript(payloadScript);

      if (data.ok) {
        pushToast(`Сценарий сохранён (${payloadScript.length} шагов)`);
      } else {
        pushToast(`Ошибка сохранения сценария: ${data as any}`);
      }
    } catch {
      pushToast("Не удалось сохранить сценарий");
    } finally {
      setSaving(false);
    }
  }

  // ==== рендер медиаселектора ====

  function renderMediaSelector(step: ScriptStepLocal) {
    const options = step.kind === "image" ? imageOptions : videoOptions;
    if (!options.length) {
      return (
        <div className="text-[11px] text-muted">
          Нет загруженных медиа этого типа.
        </div>
      );
    }

    const selected = options.find((m) => m.path === step.path) ?? options[0];

    return (
      <div className="flex flex-col gap-1">
        <select
          className="w-full text-[12px] bg-transparent border border-[var(--border-soft)] rounded-md px-2 py-1"
          value={step.path}
          onChange={(e) => updateStep(step.id, { path: e.target.value })}
        >
          {options.map((m) => (
            <option key={m.path} value={m.path}>
              {m.filename}
            </option>
          ))}
        </select>

        {selected?.webUrl && step.kind === "image" && (
          <div className="mt-1 flex justify-start">
            <div className="rounded border border-[var(--border-soft)] overflow-hidden bg-[rgba(0,0,0,0.4)]">
              <img src={selected.webUrl} alt="preview" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==== панель управления шаблонами (глобальные) ====

  function renderTemplatesToolbar() {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px] border border-[var(--border-soft)] rounded-lg px-2 py-2 bg-[rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-0.5">
          <div className="text-light font-medium">Глобальные шаблоны</div>
          <div className="text-[10px] text-muted">
            Эти шаблоны можно вставлять в текстовые шаги и подписи к медиа.
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="btn btn-outline text-[11px]">
              {uploadingTemplates ? "Загружаем…" : "Загрузить файл"}
            </span>
            <input
              type="file"
              accept=".txt,.json"
              className="hidden"
              onChange={handleUploadTemplates}
              disabled={uploadingTemplates}
            />
          </label>

          <button
            type="button"
            className="chip-btn text-[11px]"
            onClick={reloadTemplates}
            disabled={templatesLoading}
          >
            {templatesLoading ? "Обновляем…" : "Обновить"}
          </button>

          <span className="text-[10px] text-muted">
            {templates.length
              ? `Шаблонов: ${templates.length}`
              : "Шаблоны ещё не загружены"}
          </span>
        </div>
      </div>
    );
  }

  // ==== контролы шага (глобальные шаблоны + файл вариантов) ====

  function renderStepVariantsControls(step: ScriptStepLocal) {
    const hasTemplates = templates.length > 0;
    const previewVariant =
      step.variants && step.variants.length ? step.variants[0] : "";

    return (
      <div className="mb-1 flex flex-col gap-1">
        {hasTemplates && (
          <div className="flex items-center gap-2">
            <select
              className="text-[11px] bg-transparent border border-[var(--border-soft)] rounded-md px-1 py-[2px] max-w-xs"
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                insertTemplateIntoStep(step.id, value);
              }}
            >
              <option value="">Вставить глобальный шаблон…</option>
              {templates.map((tpl, idx) => {
                const label =
                  tpl.length > 60 ? tpl.slice(0, 60).trimEnd() + "…" : tpl;
                return (
                  <option key={idx} value={tpl}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span>
            Варианты этого шага:{" "}
            <b>{step.variants ? step.variants.length : 0}</b>
          </span>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <span className="chip-btn text-[10px] px-2 py-1">
              Загрузить файл вариантов
            </span>
            <input
              type="file"
              accept=".txt,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await handleVariantsFileForStep(step.id, file);
                e.target.value = "";
              }}
            />
          </label>
          {previewVariant && (
            <span className="opacity-70">
              Пример:{" "}
              {previewVariant.length > 40
                ? previewVariant.slice(0, 40).trimEnd() + "…"
                : previewVariant}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-[12px] broadcast-script-editor">
      {/* панель добавления шагов */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="chip-btn text-[11px]"
          onClick={() => addStep("text")}
        >
          ➕ Текст
        </button>
        <button
          type="button"
          className="chip-btn text-[11px]"
          onClick={() => addStep("image")}
        >
          🖼 Картинка
        </button>
        <button
          type="button"
          className="chip-btn text-[11px]"
          onClick={() => addStep("video")}
        >
          🎬 Видео
        </button>

        <div className="ml-auto flex items-center gap-2">
          {loading && (
            <span className="text-[11px] text-muted">
              Загрузка сценария…
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary text-[12px]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Сохраняем..." : "Сохранить сценарий"}
          </button>
        </div>
      </div>

      {/* глобальные шаблоны */}
      {renderTemplatesToolbar()}

      {steps.length === 0 ? (
        <div className="text-[11px] text-muted">
          Пока шагов нет. Добавьте текст или медиа сверху.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="border border-[var(--border-soft)] rounded-lg p-2 bg-[rgba(255,255,255,0.02)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-light font-medium">
                  Шаг {idx + 1} ·{" "}
                  {step.kind === "text"
                    ? "Текст"
                    : step.kind === "image"
                    ? "Картинка"
                    : "Видео"}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="chip-btn text-[10px] px-2 py-1"
                    onClick={() => moveStep(step.id, "up")}
                    disabled={idx === 0}
                    title="Вверх"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="chip-btn text-[10px] px-2 py-1"
                    onClick={() => moveStep(step.id, "down")}
                    disabled={idx === steps.length - 1}
                    title="Вниз"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="chip-btn text-[10px] px-2 py-1"
                    onClick={() => removeStep(step.id)}
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {step.kind === "text" ? (
                <>
                  {renderStepVariantsControls(step)}
                  <textarea
                    className="w-full text-[12px] bg-transparent border border-[var(--border-soft)] rounded-md p-2 resize-y"
                    rows={3}
                    placeholder="Текст сообщения (можно использовать {name})"
                    value={step.text}
                    onChange={(e) =>
                      updateStep(step.id, { text: e.target.value })
                    }
                  />
                </>
              ) : (
                <div className="space-y-2">
                  {renderMediaSelector(step)}
                  {renderStepVariantsControls(step)}
                  <textarea
                    className="w-full text-[12px] bg-transparent border border-[var(--border-soft)] rounded-md p-2 resize-y"
                    rows={2}
                    placeholder="Подпись к медиа (опционально, тоже можно {name})"
                    value={step.text}
                    onChange={(e) =>
                      updateStep(step.id, { text: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-muted">
        Если сценарий не пустой, рассылка идёт только по сценарию.  
        Для каждого шага (и текста, и медиа) можно задать свои варианты, и при
        рассылке для каждого получателя выбирается случайный вариант.
      </div>
    </div>
  );
}
