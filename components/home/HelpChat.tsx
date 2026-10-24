"use client";

import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/app/ui";
import { Tag } from "@/components/app/form";
import { HELP, searchHelp, type HelpAction, type HelpEntry } from "@/lib/helpIndex";

type Msg = { id: number; role: "user" | "bot"; text: string; hit?: HelpEntry; related?: HelpEntry[] };

const SUGGEST = ["새 도안은 어디서 만들어요?", "지운 작품을 되살리고 싶어요", "Free와 Pro는 뭐가 달라요?", "휴대폰에서도 만들 수 있어요?"];

/**
 * 기능 물어보기: a chat-style panel answered by a rule-based local search over lib/helpIndex.
 * No AI, no network: the same question always gets the same answer.
 */
export function HelpChat({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (to: HelpAction) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const seq = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    // Esc closes the panel, unless a modal dialog above it takes the key
    const k = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]") && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs]);

  if (!open) return null;

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    const hits = searchHelp(query, 3);
    const user: Msg = { id: ++seq.current, role: "user", text: query };
    const bot: Msg = hits.length
      ? { id: ++seq.current, role: "bot", text: hits[0].entry.a, hit: hits[0].entry, related: hits.slice(1).map((h) => h.entry) }
      : {
          id: ++seq.current,
          role: "bot",
          text: "도움말 목록에서 딱 맞는 항목을 찾지 못했어요. ‘공유’, ‘백업’, ‘단축키’처럼 기능 이름으로 짧게 물어보거나, 문의하기로 보내 주세요.",
          related: HELP.filter((e) => ["create", "share", "backup"].includes(e.id)),
        };
    setMsgs((m) => [...m, user, bot]);
    setText("");
  };

  return (
    <section
      role="dialog"
      aria-label="기능 물어보기"
      className="fixed right-[16px] bottom-[16px] z-[55] flex h-[min(600px,calc(100dvh-32px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-r4 border border-stroke-neutral-muted bg-bg-layer-floating text-fg-neutral shadow-s3"
    >
      <header className="flex items-center gap-x2 border-b border-stroke-neutral-muted px-x4 py-x3">
        <h2 className="t5-bold">기능 물어보기</h2>
        <Tag>규칙 기반 검색</Tag>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setMsgs([])} disabled={!msgs.length}>
          새 대화
        </Button>
        <IconButton label="닫기" size="sm" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </IconButton>
      </header>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-x3 overflow-y-auto px-x4 py-x4" aria-live="polite">
        <div className="max-w-[90%] rounded-r3 bg-bg-layer-fill px-x3 py-x2_5 t3-regular">
          패터너스 사용 방법을 물어보세요. 어디서 무엇을 누르면 되는지 알려 드려요.
          <p className="mt-x2 t2-regular text-fg-neutral-muted">
            이 버전은 AI가 아니에요. 서버 없이 브라우저 안의 도움말 목록에서 낱말이 겹치는 항목을 규칙으로 찾아 보여 줘요. 질문은 어디에도 보내지 않아요.
          </p>
        </div>
        {!msgs.length && (
          <div className="flex flex-col items-start gap-x1_5">
            {SUGGEST.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-stroke-neutral-weak px-x3 py-x1_5 text-left t3-regular hover:bg-bg-layer-fill">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-r3 bg-bg-neutral-inverted px-x3 py-x2_5 t3-regular text-fg-neutral-inverted">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[92%] flex-col gap-x2 rounded-r3 bg-bg-layer-fill px-x3 py-x2_5">
              {m.hit && <p className="t3-bold">{m.hit.q}</p>}
              <p className="t3-regular whitespace-pre-wrap">{m.text}</p>
              {(m.hit?.action || !m.hit) && (
                <div className="flex flex-wrap gap-x1_5">
                  {m.hit?.action && (
                    <Button size="sm" onClick={() => onAction(m.hit!.action!.to)}>
                      {m.hit.action.label}
                    </Button>
                  )}
                  {!m.hit && (
                    <Button size="sm" onClick={() => onAction("contact")}>
                      문의하기로 보내기
                    </Button>
                  )}
                </div>
              )}
              {!!m.related?.length && (
                <div className="flex flex-col gap-x1 border-t border-stroke-neutral-muted pt-x2">
                  <span className="t2-bold text-fg-neutral-muted">함께 보면 좋아요</span>
                  {m.related.map((r) => (
                    <button key={r.id} type="button" onClick={() => ask(r.q)} className="text-left t3-regular text-fg-brand hover:underline">
                      {r.q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <form
        className="flex items-center gap-x2 border-t border-stroke-neutral-muted px-x3 py-x2_5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="궁금한 기능을 물어보세요"
          aria-label="궁금한 기능을 물어보세요"
          className="h-10 min-w-0 flex-1 rounded-full border border-stroke-neutral-weak bg-bg-layer-default px-x4 text-[1rem] outline-none focus:border-stroke-neutral-contrast"
        />
        <Button type="submit" variant="primary" size="sm" className="h-10 rounded-full" disabled={!text.trim()}>
          보내기
        </Button>
      </form>
      <p className="px-x4 pb-x2 t1-regular text-fg-neutral-subtle">규칙 기반 로컬 검색이라 질문과 다른 답이 나올 수 있어요.</p>
    </section>
  );
}
