import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:3001";

const QUICK_PROMPTS = [
  "Сделай текст для рассылки про акцию на роллы с промокодом «забота»",
  "Перепиши автоответ в более дружелюбном стиле: «Ваш заказ принят, ждите»",
  "Подскажи, как улучшить сценарий рассылки из 3 шагов: текст + картинка + видео",
  "Разбери этот фрагмент кода send_pushline.js и подскажи, что может быть не так:",
];

/* ========= Хелпер для рендера текста + кодовых блоков ========= */

function renderMessageContent(content: string) {
  // Примитивный парсер ```code``` блоков
  const segments: JSX.Element[] = [];
  const codeRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      segments.push(
        <p
          key={`t-${key++}`}
          className="mb-2 whitespace-pre-wrap text-[12px] leading-relaxed"
        >
          {before.trim()}
        </p>
      );
    }

    const codeBlock = match[1].trim();
    segments.push(
      <pre
        key={`c-${key++}`}
        className="mb-2 rounded-xl bg-[rgba(0,0,0,0.8)] border border-[rgba(255,255,255,0.08)] px-3 py-2 overflow-x-auto text-[11px] leading-relaxed font-mono"
      >
        <code>{codeBlock}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  const after = content.slice(lastIndex);
  if (after.trim()) {
    segments.push(
      <p
        key={`t-${key++}`}
        className="whitespace-pre-wrap text-[12px] leading-relaxed"
      >
        {after.trim()}
      </p>
    );
  }

  return <div>{segments}</div>;
}

/* ========= Подкомпоненты ========= */

function AiAssistantHeader() {
  return (
    <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(255,122,26,0.18)] text-lg shadow-[0_0_18px_rgba(255,122,26,0.45)]">
            🤖
          </span>
          <span>AI-помощник Pushline</span>
        </h1>
        <p className="mt-1 text-sm text-muted max-w-xl">
          Помогает с текстами рассылок, автоответами, сценариями и кодом
          Pushline Bot / Pult. Можешь кидать сюда черновики сообщений
          или фрагменты кода — он подскажет, как улучшить.
        </p>
      </div>

      <div className="hidden md:flex flex-col items-end text-[11px] text-muted">
        <span>Enter — отправка</span>
        <span>Shift+Enter — новая строка</span>
      </div>
    </header>
  );
}

function AiQuickActions({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {QUICK_PROMPTS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="text-[11px] px-3 py-1.5 rounded-full border border-[var(--border-soft)] text-muted hover:text-light hover:border-[var(--accent)] hover:bg-[rgba(255,122,26,0.08)] transition-colors"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function AiTipsPanel({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 ml-6">
      <div className="border border-[var(--border-soft)] rounded-2xl bg-[rgba(8,8,12,0.98)] px-3 py-3 text-[11px] text-muted space-y-2">
        <div className="font-semibold text-[12px] text-light mb-1">
          Подсказки для запросов
        </div>
        <p>
          • Попроси сделать черновик рассылки или автоответа, а потом скинь свой
          вариант — AI подскажет, как улучшить.
        </p>
        <p>
          • Если есть ошибка в коде, вставь небольшой фрагмент в запрос. Лучше
          коротко описать, что именно не работает.
        </p>
        <p className="text-[11px] text-muted/80">Быстрые варианты:</p>
        <div className="flex flex-col gap-1">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSelect(q)}
              className="text-left text-[11px] px-2 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[var(--accent)] hover:bg-[rgba(255,122,26,0.06)] hover:text-light transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function AiChatMessages({
  messages,
  isLoading,
  listRef,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  listRef: React.RefObject<HTMLDivElement>;
}) {
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 min-w-0">
      <div className="relative border border-[var(--border-soft)] rounded-3xl bg-[rgba(6,6,10,0.96)] shadow-[0_18px_45px_rgba(0,0,0,0.65)] overflow-hidden h-[60vh] md:h-[65vh] flex flex-col">
        {/* лёгкий фон/градиент сверху */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_0%_0%,rgba(255,122,26,0.28),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.08),transparent_55%)] opacity-70" />

        {/* Лента сообщений */}
        <div
          ref={listRef}
          className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3 text-[13px]"
        >
          {!hasMessages && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center text-[13px] text-muted px-6">
              <div className="mb-3 text-4xl">💬</div>
              <p className="mb-2">
                Начни диалог с AI-помощником Pushline.
              </p>
              <p className="text-[12px] text-muted">
                Спроси про текст рассылки, сценарий из нескольких шагов
                или попроси помочь с фрагментом кода. Можно начать с кнопок
                быстрого запроса выше.
              </p>
            </div>
          )}

          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div
                key={idx}
                className={`flex ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[80%] ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Аватар */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-soft)] text-[11px] shadow-md ${
                      isUser
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[rgba(15,15,22,0.95)] text-muted"
                    }`}
                  >
                    {isUser ? "Вы" : "AI"}
                  </div>

                  {/* Пузырь */}
                  <div className="flex flex-col gap-1">
                    <div
                      className={`rounded-2xl px-3 py-2 text-[12px] leading-snug shadow-md animate-fade-in ${
                        isUser
                          ? "bg-[var(--accent)] text-white rounded-br-sm shadow-[0_10px_25px_rgba(255,122,26,0.45)]"
                          : "bg-[rgba(255,255,255,0.04)] text-light rounded-bl-sm border border-[rgba(255,255,255,0.05)] shadow-[0_10px_30px_rgba(0,0,0,0.65)]"
                      }`}
                    >
                      {renderMessageContent(m.content)}
                    </div>
                    <span className="text-[10px] text-muted">
                      {isUser ? "Вы" : "AI Pushline"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-2 text-[11px] text-muted animate-fade-in">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>AI думает…</span>
              </div>
            </div>
          )}
        </div>

        {/* Нижняя часть (панель ввода рендерится снаружи) */}
      </div>
    </div>
  );
}

function AiChatInput({
  input,
  setInput,
  isLoading,
  onSend,
  onClear,
}: {
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSend: () => void;
  onClear: () => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="mt-3 border border-[var(--border-soft)] rounded-2xl bg-[rgba(5,5,10,0.96)] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.7)]">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(10,10,16,0.96)] px-3 py-2 focus-within:border-[var(--accent)] transition-colors">
            <textarea
              className="w-full resize-none bg-transparent text-[12px] text-light outline-none placeholder:text-[11px] placeholder:text-muted"
              rows={2}
              value={input}
              placeholder="Напишите запрос к AI (например: «Сделай цепочку из трёх сообщений для первой волны рассылки»). Enter — отправить, Shift+Enter — новая строка."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[12px] font-semibold bg-[var(--accent)] text-white shadow-[0_10px_25px_rgba(255,122,26,0.5)] disabled:opacity-60 disabled:shadow-none transition-transform transform hover:-translate-y-[1px] active:translate-y-0"
          disabled={isLoading || !input.trim()}
          onClick={onSend}
        >
          <span className="mr-1.5">
            {isLoading ? "Отправка..." : "Отправить"}
          </span>
          <span className="text-[13px]">📨</span>
        </button>
      </div>

      <div className="mt-1.5 flex justify-between items-center">
        <button
          type="button"
          className="text-[10px] text-muted hover:text-light transition-colors"
          onClick={onClear}
        >
          Очистить диалог
        </button>
        <span className="text-[10px] text-muted">
          Модель: DeepSeek
        </span>
      </div>
    </div>
  );
}

/* ========= Главный компонент ========= */

export default function AiAssistantSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // автоскролл к последнему сообщению
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function sendMessage(text?: string) {
    const finalText = (text ?? input).trim();
    if (!finalText || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: finalText },
    ];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("AI error:", data);
        const errorText =
          (data && (data.error || data.message)) ||
          "Произошла ошибка при обращении к AI. Попробуйте ещё раз.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: String(errorText),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || "Пустой ответ от модели.",
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Не удалось связаться с сервером AI. Проверьте backend 3001 и соединение.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-4">
      <AiAssistantHeader />

      {/* Быстрые подсказки сверху для мобильных/десктопа */}
      <AiQuickActions onSelect={(text) => sendMessage(text)} />

      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-0">
        {/* Чат слева */}
        <div className="flex-1 min-w-0">
          <AiChatMessages
            messages={messages}
            isLoading={isLoading}
            listRef={listRef}
          />
          <AiChatInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            onSend={() => sendMessage()}
            onClear={() => setMessages([])}
          />
        </div>

        {/* Боковая панель справа */}
        <AiTipsPanel onSelect={(text) => sendMessage(text)} />
      </div>
    </div>
  );
}
