import React from "react";

export type Toast = { id: string; text: string };

export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] space-y-2 max-w-sm w-full">
      {toasts.map((t, idx) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-2xl border border-[rgba(148,163,184,0.4)] bg-[rgba(15,23,42,0.96)]/90 shadow-[0_20px_45px_rgba(0,0,0,0.6)] px-3.5 py-2.5 flex items-start gap-2 animate-scale-in"
          style={{
            backdropFilter: "blur(14px)",
            animationDelay: `${idx * 40}ms`,
          }}
        >
          <div className="mt-[2px] flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(34,197,94,0.18)] border border-[rgba(34,197,94,0.6)] flex items-center justify-center text-[11px] text-emerald-300">
            ✓
          </div>
          <div className="text-[13px] text-[rgba(226,232,240,0.95)] leading-snug">
            {t.text}
          </div>
        </div>
      ))}
    </div>
  );
}
