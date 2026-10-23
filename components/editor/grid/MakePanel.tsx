"use client";

// Left panel "글자·이미지로 만들기": text / image / blank grid → chart.
import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, cx, useToast } from "@/components/app/ui";
import type { GridMode } from "@/lib/types";
import { FONTS, distinctColors, ensureFont, imageRows, imageToCells, loadImage, textToCells, type Converted, type LoadedImage, type TextOpts } from "./convert";
import { Checkbox, Labeled, ScrubField, Seg, ab, abBase, el } from "./fields";
import { LBold, LChevronDown, LImagePlus, LItalic, LUnderline, LWandSparkles, LX } from "./icons";
import { MAX_COLORS, MAX_DIM } from "./model";
import { drawPreview } from "./render";

export type MakeKind = "text" | "image" | "blank";

type Props = {
  kind: MakeKind;
  setKind: (k: MakeKind) => void;
  mode: GridMode;
  aspect: number;
  yarns: string[];
  fg: number;
  hasContent: boolean;
  size: { cols: number; rows: number };
  /** pulse the image drop zone (just chosen from the start dialog) */
  attention?: boolean;
  onApply: (kind: MakeKind, r: Converted) => void;
};

const inputCls =
  "w-full min-w-0 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default text-fg-neutral transition-[border-color,box-shadow] outline-none placeholder:text-fg-placeholder focus-visible:border-stroke-neutral-contrast focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-stroke-neutral-contrast px-x3_5 text-base md:text-size-t4 md:leading-t4 h-8";

export function MakePanel(p: Props) {
  const toast = useToast();
  const fg = p.fg >= 1 ? p.fg : 1;
  const previewYarns = p.yarns.length >= 2 ? p.yarns : [p.yarns[0] ?? "#ffffff", "#24365c"];

  // ---- text ----
  const [t, setT] = useState<TextOpts>(() => ({
    text: "",
    font: "sansBold",
    bold: false,
    italic: false,
    underline: false,
    cols: p.size.cols,
    rows: p.size.rows,
    lockHeight: true,
    margin: 1,
    border: 0,
    threshold: 128,
    invert: false,
  }));
  const [textRes, setTextRes] = useState<Converted | null>(null);
  const hasText = t.text.trim().length > 0;
  useEffect(() => {
    if (p.kind !== "text" || !hasText) return setTextRes(null);
    let alive = true;
    ensureFont(t).then(() => alive && setTextRes(textToCells(t, p.aspect, fg)));
    return () => {
      alive = false;
    };
  }, [t, hasText, p.kind, p.aspect, fg]);

  // ---- image ----
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [io, setIo] = useState({ cols: 40, colors: 5, dither: false, cleanup: true });
  const [imgRes, setImgRes] = useState<Converted | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const enough = useMemo(() => (img ? distinctColors(img) : null), [img]);
  useEffect(() => {
    if (p.kind !== "image" || !img) return;
    const id = setTimeout(() => setImgRes(imageToCells(img, io, p.aspect)), 90);
    return () => clearTimeout(id);
  }, [img, io, p.kind, p.aspect]);
  useEffect(() => () => void (imgUrl && URL.revokeObjectURL(imgUrl)), [imgUrl]);

  const pickFile = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      const li = await loadImage(f, f.name);
      setImg(li);
      setImgUrl(URL.createObjectURL(f));
      const k = distinctColors(li);
      setIo((s) => ({ ...s, colors: Math.min(MAX_COLORS, Math.max(2, Math.min(s.colors, k))) }));
    } catch {
      toast("이미지를 읽을 수 없어요. PNG, JPG, WebP, HEIC 사진 파일을 골라 주세요.");
    }
  };

  // ---- blank ----
  const [blank, setBlank] = useState(p.size);
  const blankRes = useMemo<Converted>(() => ({ cols: blank.cols, rows: blank.rows, cells: Array(blank.cols * blank.rows).fill(-1) }), [blank]);

  const result = p.kind === "text" ? textRes : p.kind === "image" ? (img ? imgRes : null) : blankRes;
  const resultYarns = result?.yarns ?? previewYarns;

  // ---- preview ----
  const cvRef = useRef<HTMLCanvasElement>(null);
  const showPreview = !!result && p.kind !== "blank";
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !result || !showPreview) return;
    drawPreview(cv, result.cells, result.cols, result.rows, resultYarns, p.mode, p.aspect);
  }, [result, resultYarns, p.mode, p.aspect, showPreview]);

  const colorsUsed = result ? new Set(result.cells.map((v) => (v < 0 ? 0 : v))).size : 0;
  const fontLabel = FONTS.find((f) => f.value === t.font)?.label ?? FONTS[0].label;

  return (
    <>
      <div className="flex h-10 shrink-0 items-center border-b border-stroke-neutral-muted px-x3">
        <span className="t3-bold text-fg-neutral">글자·이미지로 만들기</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-x3 pt-x2" data-grid-make="true">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="shrink-0">
            <Seg
              label="글자·이미지로 만들기"
              value={p.kind}
              onChange={p.setKind}
              options={[
                { value: "text", label: "글자" },
                { value: "image", label: "이미지" },
                { value: "blank", label: "빈 격자" },
              ]}
            />
          </div>
          <div className="-mx-0.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pb-2">
            {p.kind === "text" && (
              <>
                <input className={inputCls} placeholder="Patterners" aria-label="글자" value={t.text} maxLength={40} onChange={(e) => setT({ ...t, text: e.target.value })} />
                <Labeled label="글꼴">
                  <Menu
                    items={FONTS.map((f) => ({ label: f.label, onSelect: () => setT({ ...t, font: f.value }) }))}
                    trigger={({ toggle, open }) => (
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={open}
                        aria-label="글꼴"
                        onClick={toggle}
                        className="seed-select-trigger__root seed-select-trigger__root--size_medium flex items-center justify-between gap-x2 whitespace-nowrap select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 text-size-t3 leading-t3 h-7 w-full px-x2"
                      >
                        <span style={{ pointerEvents: "none" }}>{fontLabel}</span>
                        <LChevronDown className="pointer-events-none size-4 text-fg-neutral-muted" />
                      </button>
                    )}
                  />
                </Labeled>
                <div className="grid grid-cols-2 gap-x2">
                  <Labeled label="가로 칸 수">
                    <ScrubField label="가로 칸 수" value={t.cols} min={4} max={MAX_DIM} onChange={(v) => setT({ ...t, cols: v })} className="w-full" />
                  </Labeled>
                  <Labeled label="세로 단 수">
                    <ScrubField label="세로 단 수" value={t.rows} min={2} max={MAX_DIM} onChange={(v) => setT({ ...t, rows: v, lockHeight: true })} className="w-full" />
                  </Labeled>
                  <Labeled label="글자 모양">
                    <div className="flex h-7 items-center gap-0.5 rounded-r2 bg-bg-layer-fill p-0.5" role="group" aria-label="글자 모양">
                      {(
                        [
                          ["bold", "굵게", LBold],
                          ["italic", "기울임", LItalic],
                          ["underline", "밑줄", LUnderline],
                        ] as const
                      ).map(([k, label, Icon]) => (
                        <button
                          key={k}
                          type="button"
                          aria-label={label}
                          title={label}
                          aria-pressed={t[k]}
                          onClick={() => setT({ ...t, [k]: !t[k] })}
                          className={cx(
                            "inline-flex h-full min-w-0 flex-1 items-center justify-center rounded-r1 transition-colors",
                            t[k] ? "bg-bg-layer-default text-fg-neutral shadow-s1" : "text-fg-neutral-muted hover:text-fg-neutral",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </button>
                      ))}
                    </div>
                  </Labeled>
                </div>
                {hasText && (
                  <>
                    <div className="grid grid-cols-2 gap-x2">
                      <Labeled label="여백">
                        <ScrubField label="여백" value={t.margin} min={0} max={30} suffix="칸" onChange={(v) => setT({ ...t, margin: v })} className="w-full" />
                      </Labeled>
                      <Labeled label="테두리 두께(칸)">
                        <ScrubField label="테두리 두께(칸)" value={t.border} min={0} max={10} onChange={(v) => setT({ ...t, border: v })} className="w-full" />
                      </Labeled>
                    </div>
                    <Labeled label="밝기 기준">
                      <ScrubField label="밝기 기준" value={t.threshold} min={20} max={235} step={2} onChange={(v) => setT({ ...t, threshold: v })} className="w-full" />
                    </Labeled>
                    <Checkbox checked={t.invert} onChange={(v) => setT({ ...t, invert: v })}>
                      채운칸·빈칸 뒤집기
                    </Checkbox>
                  </>
                )}
              </>
            )}

            {p.kind === "image" && (
              <>
                <input
                  ref={fileRef}
                  accept="image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif"
                  className="sr-only"
                  tabIndex={-1}
                  type="file"
                  aria-label="이미지 고르기"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {!img ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={cx(
                      "flex min-h-36 w-full flex-col items-center justify-center gap-x2 overflow-hidden rounded-r2 border border-dashed p-x3 text-center transition-colors",
                      p.attention && "ring-2 ring-stroke-brand-solid ring-offset-2 ring-offset-bg-layer-default animate-pulse",
                      dragOver ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-stroke-neutral-muted hover:bg-bg-layer-default-pressed",
                    )}
                  >
                    <LImagePlus className="size-6 text-fg-neutral-muted" />
                    <span className="t2-regular text-fg-neutral-muted">이미지를 끌어다 놓거나 눌러서 고르세요</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-x2 rounded-r2 border border-stroke-neutral-muted p-x2">
                    {imgUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt="" className="size-12 rounded-r1 bg-bg-layer-fill object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="t2-medium truncate text-fg-neutral">{img.name}</p>
                      <p className="t1-regular text-fg-neutral-muted">
                        {img.width} × {img.height}px
                      </p>
                    </div>
                    <button type="button" onClick={() => fileRef.current?.click()} className="t1-medium shrink-0 rounded-r1 px-x1_5 py-x1 text-fg-neutral hover:bg-bg-layer-default-pressed">
                      이미지 바꾸기
                    </button>
                    <button
                      type="button"
                      aria-label="이미지 빼기"
                      title="이미지 빼기"
                      onClick={() => {
                        setImg(null);
                        setImgRes(null);
                        setImgUrl(null);
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-r1 text-fg-neutral-muted hover:bg-bg-layer-default-pressed"
                    >
                      <LX className="size-4" />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x2">
                  <Labeled label="가로 칸 수">
                    <ScrubField label="가로 칸 수" value={io.cols} min={4} max={MAX_DIM} onChange={(v) => setIo({ ...io, cols: v })} className="w-full" />
                  </Labeled>
                  <Labeled label="색 수">
                    <ScrubField label="색 수" value={io.colors} min={2} max={MAX_COLORS} onChange={(v) => setIo({ ...io, colors: v })} className="w-full" />
                  </Labeled>
                </div>
                <Checkbox checked={io.dither} onChange={(v) => setIo({ ...io, dither: v })}>
                  점을 섞어 중간색 표현
                </Checkbox>
                <Checkbox checked={io.cleanup} onChange={(v) => setIo({ ...io, cleanup: v })}>
                  한 칸짜리 점 없애기
                </Checkbox>
                {img && <p className="t1-regular text-fg-neutral-muted">세로 단 수는 이미지 비율에 맞춰 {imageRows(img, io.cols, p.aspect)}단이 돼요.</p>}
                {img && enough !== null && enough < io.colors && (
                  <Advice text={`이 이미지는 ${Math.max(2, enough)}색이면 충분해요.`} action={`${Math.max(2, enough)}색으로`} onAction={() => setIo({ ...io, colors: Math.max(2, enough) })} />
                )}
                {img && io.cols < 30 && <Advice text="선이 또렷하려면 가로 40칸 이상을 권해요." action="40칸으로" onAction={() => setIo({ ...io, cols: 40 })} />}
              </>
            )}

            {p.kind === "blank" && (
              <>
                <div className="grid grid-cols-2 gap-x2">
                  <Labeled label="가로">
                    <ScrubField label="가로" value={blank.cols} min={1} max={MAX_DIM} suffix="코" onChange={(v) => setBlank({ ...blank, cols: v })} className="w-full" />
                  </Labeled>
                  <Labeled label="세로">
                    <ScrubField label="세로" value={blank.rows} min={1} max={MAX_DIM} suffix="단" onChange={(v) => setBlank({ ...blank, rows: v })} className="w-full" />
                  </Labeled>
                </div>
                <p className="t2-regular text-fg-neutral-muted">지금 도안을 지우고 빈 격자로 시작해요. 실행 취소로 되돌릴 수 있어요.</p>
              </>
            )}

            {showPreview && result && (
              <div className="flex flex-col gap-x1">
                <div className="relative h-40 overflow-hidden rounded-r2 bg-bg-layer-fill">
                  <canvas ref={cvRef} className="size-full" aria-label="미리보기" />
                </div>
                <p className="t1-regular tabular-nums text-fg-neutral-muted">
                  {result.cols} × {result.rows}칸 · {colorsUsed}색
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0 space-y-1.5 border-t border-stroke-neutral-muted pt-2 pb-2">
            {p.hasContent && result && <p className="t1-regular text-fg-neutral-muted">적용하면 지금 도안은 초기화돼요.</p>}
            <button
              type="button"
              className={cx(ab("brandSolid", "small"), abBase, "h-8 w-full")}
              data-disabled={!result ? "" : undefined}
              disabled={!result}
              onClick={() => result && p.onApply(p.kind, result)}
              style={el(271, 32)}
            >
              <LWandSparkles className="size-4" />
              {p.kind === "blank" ? "빈 격자로 바꾸기" : "도안에 적용"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Advice({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="t2-regular flex items-center gap-x2 rounded-r2 bg-bg-brand-weak px-x3 py-x2 text-fg-neutral">
      <span className="flex-1">{text}</span>
      <button type="button" onClick={onAction} className="shrink-0 font-semibold text-fg-brand hover:underline">
        {action}
      </button>
    </div>
  );
}
