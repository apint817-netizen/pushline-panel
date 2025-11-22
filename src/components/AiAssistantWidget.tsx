import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:3001";

export default function AiAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
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
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Произошла ошибка при обращении к AI. Попробуйте ещё раз.",
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
          content: "Не удалось связаться с сервером AI.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Большая кнопка AI в правом нижнем углу */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-8 right-8 z-50 rounded-full shadow-xl px-5 py-3 text-base font-semibold bg-[var(--accent)] text-white flex items-center gap-2"
      >
        <span className="text-lg">🤖</span>
        <span>AI-помощник</span>
      </button>

      {/* Окно чата */}
      {isOpen && (
        <div className="fixed bottom-24 right-8 z-50 w-80 max-h-[70vh] bg-[rgba(15,15,20,0.98)] border border-[var(--border-soft)] rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-soft)] flex items-center justify-between">
            <div className="text-xs font-semibold text-light">
              Pushline AI-помощник
            </div>
            <button
              className="text-xs text-muted"
              onClick={() => setMessages([])}
            >
              Очистить
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 text-[12px] space-y-2">
            {messages.length === 0 && (
              <div className="text-muted text-[11px]">
                Задайте вопрос: например, “Сделай текст для рассылки про акцию
                на роллы” или “Подскажи, как исправить ошибку в send_pushline.js”.
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-xl px-2 py-1 max-w-[85%] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[rgba(255,255,255,0.03)] text-light"
                  } text-[11px]`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="text-muted text-[11px]">AI думает…</div>
            )}
          </div>

          <div className="border-t border-[var(--border-soft)] p-2">
            <textarea
              className="w-full resize-none text-[11px] bg-transparent text-light border border-[var(--border-soft)] rounded-lg px-2 py-1 outline-none"
              rows={2}
              value={input}
              placeholder="Напишите вопрос и нажмите Enter…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="mt-1 w-full text-xs py-1 rounded-lg bg-[var(--accent)] text-white disabled:opacity-60"
              disabled={isLoading || !input.trim()}
              onClick={sendMessage}
            >
              Отправить
            </button>
          </div>
        </div>
      )}
    </>
  );
}
