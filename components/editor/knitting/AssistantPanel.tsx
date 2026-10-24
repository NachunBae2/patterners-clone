"use client";

// Left panel: the rule-based "AI 도안 어시스턴트" chat.
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/app/ui";
import { AB_TAIL, ab, seedSize } from "./ab";
import { ASSISTANT_EXAMPLES } from "./assistant";
import { PanelLeft, Send, Sparkle } from "./icons";

/* layout-audit-ignore: tiny-text — the panel follows the palette's 11–12px captions */

export type ChatMsg = { id: string; from: "me" | "bot"; text: string; undoable?: boolean };

export function AssistantPanel({
  width,
  messages,
  onSend,
  onClear,
  onClose,
  onUndo,
  selection,
  onClearSelection,
  target,
}: {
  width: number;
  messages: ChatMsg[];
  onSend: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
  onUndo: () => void;
  /** banner text for the active selection, if any */
  selection: string | null;
  onClearSelection: () => void;
  /** name of the grid commands apply to */
  target: string | null;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);
  useEffect(() => inputRef.current?.focus(), []);

  const send = (t = draft) => {
    const v = t.trim();
    if (!v) return;
    onSend(v);
    setDraft("");
  };
  const lastBot = [...messages].reverse().find((m) => m.from === "bot");

  return (
    <div className="relative z-[90] h-full shrink-0" style={{ width }}>
      <aside aria-label="AI 도안 어시스턴트" data-assistant-panel="" className="flex h-full min-h-0 flex-col overflow-hidden border-r border-stroke-neutral-muted bg-bg-layer-default" style={{ width }}>
        <div className="flex h-11 shrink-0 items-center gap-x1 border-b border-stroke-neutral-muted px-x2">
          <Sparkle className="ml-x1 size-4 shrink-0 text-fg-brand" />
          <span className="t4-medium min-w-0 flex-1 truncate px-x1 text-fg-neutral">AI 도안 어시스턴트</span>
          <span className="shrink-0 rounded-r1 bg-bg-layer-fill px-x1_5 py-0.5 text-[11px] font-semibold text-fg-neutral-muted" title="서버나 AI 모델 없이 이 브라우저에서 규칙으로 해석해요">
            규칙 기반 · 로컬
          </span>
          <button className={cx(ab("ghost"), AB_TAIL, "w-x8 px-0")} aria-label="닫기" title="닫기" style={seedSize(32, 32)} onClick={onClose}>
            <PanelLeft className="size-4" />
          </button>
        </div>
        <div className="flex h-10 shrink-0 items-center border-b border-stroke-neutral-muted px-x2">
          <span className="t3-bold min-w-0 flex-1 truncate px-x1 text-fg-neutral">{target ? `${target}에 반영해요` : "격자를 골라 주세요"}</span>
          <button type="button" disabled={!messages.length} onClick={onClear} className="h-7 shrink-0 rounded-r2 px-x2 text-[12px] text-fg-neutral-muted hover:bg-bg-layer-default-pressed disabled:opacity-40">
            대화 지우기
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-x3 py-x3 [scrollbar-width:thin]">
          <div className="mb-x3 rounded-r2 bg-bg-layer-fill px-x3 py-x2_5">
            <p className="text-[12px] leading-[1.55] text-fg-neutral">선택한 격자를 말로 고쳐요. 단·코 번호는 도안에 보이는 숫자 그대로 말해 주세요.</p>
            <p className="mt-x1 text-[11px] leading-[1.5] text-fg-neutral-muted">이 버전은 서버 없이 브라우저에서 규칙으로 해석해요. 정해진 말만 알아들어요. 모르는 말을 하면 할 수 있는 일을 알려 드려요.</p>
          </div>
          <div className="mb-x3 flex flex-wrap gap-x1_5">
            {ASSISTANT_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => send(ex)} className="rounded-full border border-stroke-neutral-muted bg-bg-layer-default px-x2_5 py-x1 text-[12px] text-fg-neutral hover:bg-bg-layer-default-pressed">
                {ex}
              </button>
            ))}
          </div>
          <ul className="flex flex-col gap-x2" aria-live="polite">
            {messages.map((m) => (
              <li key={m.id} className={cx("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div
                  className={cx(
                    "max-w-[88%] rounded-r3 px-x3 py-x2 text-[12px] leading-[1.55] whitespace-pre-line",
                    m.from === "me" ? "bg-bg-brand-weak text-fg-neutral" : "bg-bg-layer-fill text-fg-neutral",
                  )}
                >
                  {m.text}
                  {m.from === "bot" && m.undoable && m.id === lastBot?.id && (
                    <button type="button" onClick={onUndo} className="mt-x1_5 block text-[12px] font-semibold text-fg-brand hover:underline">
                      되돌리기
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-stroke-neutral-muted p-x2">
          {selection && (
            <div className="mb-x2 flex items-center justify-between gap-x2 rounded-r2 bg-sky-500/10 px-x2 py-x1_5 text-[11px] text-fg-neutral">
              <span className="min-w-0 truncate">{selection}</span>
              <button type="button" onClick={onClearSelection} className="shrink-0 font-semibold text-fg-neutral-muted hover:text-fg-neutral">
                해제하기
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-x1_5"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={selection ? "선택 영역에서만 작업해요." : "예) 3~10단까지 메리야스 뜨기"}
              aria-label="어시스턴트에게 보낼 말"
              className="min-h-10 flex-1 resize-none rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2_5 py-x2 text-[16px] leading-[1.4] text-fg-neutral outline-none placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast md:text-[13px]"
            />
            <button type="submit" disabled={!draft.trim()} aria-label="보내기" title="보내기" className={cx(ab("brandSolid"), AB_TAIL, "w-x9 px-0")} style={seedSize(36, 36)}>
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
