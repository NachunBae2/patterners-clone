"use client";

// 원문·파일로 만들기: paste (or open a .txt of) written rows and turn them into a chart grid.
import { useMemo, useRef, useState } from "react";
import { Button, Dialog, cx, useToast } from "@/components/app/ui";
import { knitSymbol } from "@/lib/symbols/knitting";
import { DEFAULT_NUMBERING, type Block, type Geo, type KGrid, type RowSides } from "./model";
import { gridBody, numberMarkup } from "./render";
import { DEFAULT_PARSE, MAP_CHOICES, WRITTEN_EXAMPLE, parseWritten, type ParseOptions } from "./written";
import { Upload } from "./icons";

/* layout-audit-ignore: tiny-text — dialog captions follow the editor's 11–12px helper text */

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-x2">
      <span className="text-[12px] text-fg-neutral-muted">{label}</span>
      <div className="flex gap-0.5 rounded-r1_5 bg-bg-layer-fill p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cx("h-7 rounded-r1 px-x2 text-[12px] font-medium", value === v ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ImportDialog({
  open,
  onClose,
  geo,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  geo: Geo;
  onCreate: (block: Block, sides: RowSides, name: string) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [opt, setOpt] = useState<ParseOptions>(DEFAULT_PARSE);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => (text.trim() ? parseWritten(text, opt) : null), [text, opt]);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.txt$/i.test(f.name) && f.type !== "text/plain") {
      toast("텍스트(.txt) 파일만 올릴 수 있어요");
      return;
    }
    if (f.size > 512 * 1024) {
      toast("파일이 너무 커요. 512KB 이하 텍스트로 나눠 올려 주세요");
      return;
    }
    try {
      setText(await f.text());
      setFileName(f.name);
    } catch {
      toast("파일을 열지 못했어요. 다른 파일로 다시 해 보세요.");
    }
  };

  const preview = useMemo(() => {
    if (!result?.block) return null;
    const b = result.block;
    const g: KGrid = { id: "import-preview", name: "", x: 0, y: 0, cols: b.cols, rows: b.rows, cells: b.cells, visible: true, numbering: DEFAULT_NUMBERING };
    const W = b.cols * geo.cw;
    const H = b.rows * geo.ch;
    const pad = geo.ch * 0.8;
    return { svg: gridBody(g, geo) + numberMarkup(g, geo), W, H, pad };
  }, [result, geo]);

  const rowsByLine = useMemo(() => {
    const m = new Map<number, { from: number; to: number; before: number; after: number; side: string }[]>();
    for (const r of result?.rowReports ?? []) {
      if (r.line === null) continue;
      const list = m.get(r.line) ?? [];
      list.push({ from: r.row, to: r.row, before: r.before, after: r.after, side: r.side === "RS" ? "겉면" : "안면" });
      m.set(r.line, list);
    }
    return m;
  }, [result]);

  const create = () => {
    if (!result?.block) return;
    onCreate(result.block, { worked: result.worked, firstRowSide: result.firstRowSide }, fileName ? fileName.replace(/\.txt$/i, "").slice(0, 40) : "가져온 도안");
    toast(`${result.rows}단 × ${result.cols}코 격자를 만들었어요${result.clamped ? ` · 최대 400까지만 변환했어요` : ""}`);
    onClose();
  };

  const errors = result?.lines.filter((l) => l.kind === "error").length ?? 0;
  const warnings = result?.lines.filter((l) => l.kind !== "error" && l.issues.length).length ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="서술 도안 가져오기"
      width={980}
      footer={
        <>
          <span className="mr-auto self-center text-[12px] text-fg-neutral-muted tabular-nums">
            {result?.block ? `${result.rows}단 × ${result.cols}코` : "변환할 내용이 없어요."}
            {!!errors && ` · 읽지 못한 줄 ${errors}개`}
            {!!warnings && ` · 확인할 줄 ${warnings}개`}
          </span>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!result?.block} onClick={create}>
            격자 만들기
          </Button>
        </>
      }
    >
      <div className="grid gap-x5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-x3">
          <p className="rounded-r2 bg-bg-layer-fill px-x3 py-x2 text-[12px] leading-[1.55] text-fg-neutral-muted">
            이 버전은 서버 없이 브라우저에서 규칙으로 변환해요. 입력한 글은 저장하지 않고 변환에만 사용해요. 한 단에 한 줄씩, 「1단: 겉뜨기 3, 안뜨기 2 반복」이나 「Row 1 (RS): k2, p2; rep to end」처럼 적어 주세요.
          </p>
          <label className="flex flex-col gap-x1_5">
            <span className="flex items-center justify-between text-[13px] font-semibold text-fg-neutral">
              서술형 텍스트
              {fileName && <span className="truncate text-[12px] font-normal text-fg-neutral-muted">{fileName}</span>}
            </span>
            <textarea
              value={text}
              autoFocus
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  e.preventDefault();
                  readFile(f);
                }
              }}
              placeholder={"도안 글을 그대로 붙여넣어요.\n\n·  한 단에 한 줄씩 (1단: 겉2, 안2 반복)\n·  반복은 (겉2, 안2)×3 또는 *k2, p2; rep from * to end\n·  .txt 파일은 아래 버튼으로 올리거나 여기에 끌어다 놓아요"}
              aria-label="서술형 텍스트"
              className="h-64 w-full resize-y rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 py-x2 font-mono text-[16px] leading-[1.6] md:text-[13px] text-fg-neutral outline-none placeholder:font-sans placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast"
            />
          </label>
          <div className="flex flex-wrap items-center gap-x2">
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              .txt 파일 올리기
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              aria-label=".txt 파일 올리기"
              onChange={(e) => {
                readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => setText(WRITTEN_EXAMPLE)}>
              예시 넣기
            </Button>
            {text && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText("");
                  setFileName(null);
                }}
              >
                지우기
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-x2 border-t border-stroke-neutral-muted pt-x3">
            <Seg
              label="뜨는 방식"
              value={opt.worked}
              options={[
                ["auto", `자동${result ? ` (${result.worked === "round" ? "원통" : "평면"})` : ""}`],
                ["flat", "평면"],
                ["round", "원통"],
              ]}
              onChange={(worked) => setOpt((o) => ({ ...o, worked }))}
            />
            <Seg
              label="1단"
              value={opt.firstRowSide}
              options={[
                ["RS", "겉면"],
                ["WS", "안면"],
              ]}
              onChange={(firstRowSide) => setOpt((o) => ({ ...o, firstRowSide }))}
            />
            <Seg
              label="겉면 단 읽는 방향"
              value={opt.readOrder}
              options={[
                ["rtl", "오른쪽→왼쪽"],
                ["ltr", "왼쪽→오른쪽"],
              ]}
              onChange={(readOrder) => setOpt((o) => ({ ...o, readOrder }))}
            />
            <div className="flex items-center justify-between gap-x2">
              <span className="text-[12px] text-fg-neutral-muted">시작 코 수</span>
              <div className="flex items-center gap-x2">
                <label className="flex items-center gap-x1 text-[12px] text-fg-neutral-muted">
                  <input type="checkbox" checked={opt.width === null} onChange={(e) => setOpt((o) => ({ ...o, width: e.target.checked ? null : (result?.rowReports[0]?.before ?? 20) }))} />
                  글에서 읽기
                </label>
                <input
                  type="number"
                  min={1}
                  max={400}
                  disabled={opt.width === null}
                  aria-label="시작 코 수"
                  value={opt.width ?? result?.rowReports[0]?.before ?? ""}
                  onChange={(e) => setOpt((o) => ({ ...o, width: Math.max(1, Math.min(400, Number(e.target.value) || 1)) }))}
                  className="h-8 w-16 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x2 text-[16px] tabular-nums outline-none disabled:opacity-50 md:text-[13px]"
                />
              </div>
            </div>
          </div>
          {!!result?.unknown.length && (
            <div className="flex flex-col gap-x1_5 rounded-r2 border border-stroke-neutral-muted p-x3">
              <span className="text-[12px] font-semibold text-fg-neutral">인식하지 못한 용어 {result.unknown.length}개</span>
              {result.unknown.map((term) => (
                <label key={term} className="flex items-center justify-between gap-x2 text-[12px] text-fg-neutral-muted">
                  <span className="min-w-0 truncate font-mono text-fg-neutral">{term}</span>
                  <select
                    aria-label={`${term} 기호 지정`}
                    value={opt.mapping[term.split(/\s+/)[0]] ?? ""}
                    onChange={(e) =>
                      setOpt((o) => {
                        const mapping = { ...o.mapping };
                        const key = term.split(/\s+/)[0];
                        if (e.target.value) mapping[key] = e.target.value;
                        else delete mapping[key];
                        return { ...o, mapping };
                      })
                    }
                    className="h-8 max-w-[11rem] rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x1 text-[12px] text-fg-neutral"
                  >
                    <option value="">지정 안 함</option>
                    {MAP_CHOICES.map((id) => (
                      <option key={id} value={id}>
                        {knitSymbol(id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-x3">
          <span className="text-[13px] font-semibold text-fg-neutral">미리보기</span>
          <div className="flex max-h-72 min-h-40 items-center justify-center overflow-auto rounded-r2 border border-stroke-neutral-muted bg-white p-x3">
            {preview ? (
              <svg
                viewBox={`${-preview.pad} ${-preview.pad * 0.4} ${preview.W + preview.pad * 2} ${preview.H + preview.pad * 1.6}`}
                width={preview.W + preview.pad * 2}
                height={preview.H + preview.pad * 1.6}
                className="h-auto max-h-64 w-auto max-w-full"
                role="img"
                aria-label="변환된 차트 미리보기"
              >
                <g dangerouslySetInnerHTML={{ __html: preview.svg }} />
              </svg>
            ) : (
              <p className="text-[12px] text-fg-neutral-subtle">글을 적으면 차트가 여기에 그려져요.</p>
            )}
          </div>
          {result && (
            <ol className="flex max-h-72 flex-col overflow-y-auto rounded-r2 border border-stroke-neutral-muted" aria-label="줄별 변환 결과">
              {result.lines.map((l) => {
                const rows = rowsByLine.get(l.line) ?? [];
                const first = rows[0];
                const last = rows[rows.length - 1];
                return (
                  <li key={l.line} className="flex flex-col gap-0.5 border-b border-stroke-neutral-muted px-x3 py-x1_5 last:border-b-0">
                    <div className="flex items-center gap-x2 text-[12px]">
                      <span className="w-6 shrink-0 text-right text-fg-neutral-subtle tabular-nums">{l.line}</span>
                      <span
                        className={cx(
                          "shrink-0 rounded-r1 px-x1_5 py-px text-[11px] font-semibold",
                          l.kind === "error" ? "bg-bg-critical-weak text-fg-critical" : l.kind === "note" ? "bg-bg-layer-fill text-fg-neutral-muted" : "bg-bg-brand-weak text-fg-brand",
                        )}
                      >
                        {l.kind === "error" ? "읽지 못함" : l.kind === "note" ? "메모" : l.label}
                        {first && rows.length === 1 && ` · ${first.side}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg-neutral" title={l.text}>
                        {l.text}
                      </span>
                      {first && (
                        <span className="shrink-0 text-fg-neutral-muted tabular-nums">
                          {first.before === last.after ? `${first.before}코` : `${first.before}→${last.after}코`}
                        </span>
                      )}
                    </div>
                    {l.issues.map((x, i) => (
                      <p key={i} className={cx("pl-x8 text-[11px] leading-[1.45]", l.kind === "error" ? "text-fg-critical" : "text-[var(--seed-color-palette-yellow-700,#a16207)]")}>
                        {x}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Dialog>
  );
}
