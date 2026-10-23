"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Grid as GridIcon, ImageIcon, TypeIcon, X } from "@/components/app/icons";
import { Button, Dialog, IconButton, NumberField, Segmented, cx, useToast } from "@/components/app/ui";
import type { GridMode } from "@/lib/types";
import { FONTS, distinctColors, ensureFont, imageRows, imageToCells, loadImage, textToCells, type Converted, type FontKey, type LoadedImage, type TextOpts } from "./convert";
import { Bold, Italic, Underline, Upload } from "./icons";
import { MAX_COLORS, MAX_DIM } from "./model";
import { drawPreview } from "./render";

export type StartKind = "text" | "image" | "blank";
export type StartStep = "choose" | StartKind;

type Props = {
  open: boolean;
  step: StartStep;
  onStep: (s: StartStep) => void;
  onClose: () => void;
  mode: GridMode;
  aspect: number;
  yarns: string[];
  fg: number;
  hasContent: boolean;
  defaultSize: { cols: number; rows: number };
  onApply: (kind: StartKind, r: Converted) => void;
};

const CARDS: { kind: StartKind; title: string; desc: string; icon: ReactNode }[] = [
  { kind: "text", title: "글자", desc: "이름·문구를 격자로", icon: <TypeIcon className="size-6" /> },
  { kind: "image", title: "이미지", desc: "사진·그림을 실 색으로", icon: <ImageIcon className="size-6" /> },
  { kind: "blank", title: "빈 격자", desc: "연필로 한 칸씩 칠하기", icon: <GridIcon className="size-6" /> },
];

export function Toggle({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-x2 text-[0.8125rem] text-fg-neutral", disabled && "pointer-events-none opacity-40")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer accent-[var(--seed-color-bg-brand-solid)]"
      />
      {children}
    </label>
  );
}

export const Field = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={cx("flex flex-col gap-x1_5", className)}>
    <span className="text-[0.75rem] font-semibold text-fg-neutral-muted">{label}</span>
    {children}
  </div>
);

export function StartDialog(p: Props) {
  const toast = useToast();
  const step = p.step;
  const kind: StartKind | null = step === "choose" ? null : step;
  const fg = p.fg >= 1 ? p.fg : 1;
  const previewYarns = p.yarns.length >= 2 ? p.yarns : [p.yarns[0] ?? "#ffffff", "#24365c"];

  // ---- text ----
  const [t, setT] = useState<TextOpts>({
    text: "",
    font: "sans",
    bold: true,
    italic: false,
    underline: false,
    cols: 60,
    rows: 16,
    lockHeight: false,
    margin: 1,
    border: 0,
    threshold: 128,
    invert: false,
  });
  const [textRes, setTextRes] = useState<Converted | null>(null);
  useEffect(() => {
    if (!p.open || kind !== "text") return;
    let alive = true;
    const o = { ...t, text: t.text || "Patterners" };
    ensureFont(o).then(() => alive && setTextRes(textToCells(o, p.aspect, fg)));
    return () => {
      alive = false;
    };
  }, [t, p.open, kind, p.aspect, fg]);

  // ---- image ----
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [io, setIo] = useState({ cols: 60, colors: 4, dither: false, cleanup: true });
  const [imgRes, setImgRes] = useState<Converted | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const enough = useMemo(() => (img ? distinctColors(img) : null), [img]);
  useEffect(() => {
    if (!p.open || kind !== "image" || !img) return;
    const id = setTimeout(() => setImgRes(imageToCells(img, io, p.aspect)), 90);
    return () => clearTimeout(id);
  }, [img, io, p.open, kind, p.aspect]);
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
  const [blank, setBlank] = useState(p.defaultSize);
  useEffect(() => {
    if (p.open) setBlank(p.defaultSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);
  const blankRes = useMemo<Converted>(() => ({ cols: blank.cols, rows: blank.rows, cells: Array(blank.cols * blank.rows).fill(-1) }), [blank]);

  const result = kind === "text" ? textRes : kind === "image" ? imgRes : kind === "blank" ? blankRes : null;
  const resultYarns = result?.yarns ?? previewYarns;

  // ---- preview ----
  const cvRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !result) return;
    drawPreview(cv, result.cells, result.cols, result.rows, resultYarns, p.mode, p.aspect);
  }, [result, resultYarns, p.mode, p.aspect]);

  const apply = () => {
    if (!kind || !result) return;
    p.onApply(kind, result);
  };

  const colorsUsed = result ? new Set(result.cells.map((v) => (v < 0 ? 0 : v))).size : 0;

  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      title={kind ? "글자·이미지로 만들기" : "무엇으로 시작할까요?"}
      width={kind ? 900 : 640}
      footer={
        kind ? (
          <>
            {p.hasContent && <span className="mr-auto self-center text-[0.8125rem] text-fg-neutral-muted">적용하면 지금 도안은 초기화돼요.</span>}
            <Button onClick={() => p.onStep("choose")}>뒤로</Button>
            <Button variant="primary" disabled={!result} onClick={apply}>
              {kind === "blank" ? "빈 격자로 바꾸기" : "도안에 적용"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!kind ? (
        <>
          <p className="mb-x4 text-[0.875rem] text-fg-neutral-muted">글자나 그림을 격자로 바꾸거나, 빈 격자에 바로 칠해요.</p>
          <div className="grid gap-x3 sm:grid-cols-3">
            {CARDS.map((c) => (
              <button
                key={c.kind}
                type="button"
                onClick={() => p.onStep(c.kind)}
                className="group flex flex-col items-start gap-x3 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-default p-x4 text-left transition-colors hover:border-stroke-brand-weak hover:bg-bg-brand-weak"
              >
                <span className="flex size-11 items-center justify-center rounded-r2 bg-bg-layer-fill text-fg-neutral group-hover:bg-bg-layer-default group-hover:text-fg-brand">
                  {c.icon}
                </span>
                <span>
                  <span className="block t5-bold">{c.title}</span>
                  <span className="mt-x1 block text-[0.8125rem] text-fg-neutral-muted">{c.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-x4">
          <Segmented
            value={kind}
            onChange={(v) => p.onStep(v)}
            options={[
              { value: "text", label: "글자" },
              { value: "image", label: "이미지" },
              { value: "blank", label: "빈 격자" },
            ]}
            className="max-w-[360px]"
          />
          <div className="grid gap-x5 md:grid-cols-[300px_1fr]">
            <div className="flex flex-col gap-x4">
              {kind === "text" && (
                <>
                  <Field label="글자">
                    <input
                      autoFocus
                      aria-label="글자"
                      value={t.text}
                      placeholder="Patterners"
                      maxLength={40}
                      onChange={(e) => setT({ ...t, text: e.target.value })}
                      className="h-10 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[1rem] outline-none focus:border-stroke-neutral-contrast"
                    />
                  </Field>
                  <div className="flex flex-col gap-x4">
                    <Field label="글자 모양">
                      <div className="flex gap-x1">
                        <IconButton label="굵게" size="sm" active={t.bold} onClick={() => setT({ ...t, bold: !t.bold })} className="border border-stroke-neutral-weak">
                          <Bold />
                        </IconButton>
                        <IconButton label="기울임" size="sm" active={t.italic} onClick={() => setT({ ...t, italic: !t.italic })} className="border border-stroke-neutral-weak">
                          <Italic />
                        </IconButton>
                        <IconButton label="밑줄" size="sm" active={t.underline} onClick={() => setT({ ...t, underline: !t.underline })} className="border border-stroke-neutral-weak">
                          <Underline />
                        </IconButton>
                      </div>
                    </Field>
                    <Field label="글꼴">
                      <Segmented value={t.font} onChange={(v: FontKey) => setT({ ...t, font: v })} options={FONTS.map((f) => ({ value: f.value, label: f.label }))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x3">
                    <NumberField label="가로 칸 수" value={t.cols} min={4} max={MAX_DIM} onChange={(v) => setT({ ...t, cols: v })} />
                    <NumberField
                      label="세로 단 수"
                      value={t.lockHeight ? t.rows : textRes?.rows ?? t.rows}
                      min={2}
                      max={MAX_DIM}
                      onChange={(v) => setT({ ...t, rows: v, lockHeight: true })}
                    />
                  </div>
                  <Toggle checked={t.lockHeight} onChange={(v) => setT({ ...t, lockHeight: v, rows: textRes?.rows ?? t.rows })}>
                    세로 고정
                  </Toggle>
                  <div className="grid grid-cols-2 gap-x3">
                    <NumberField label="여백" value={t.margin} min={0} max={30} onChange={(v) => setT({ ...t, margin: v })} suffix="칸" />
                    <NumberField label="테두리 두께(칸)" value={t.border} min={0} max={10} onChange={(v) => setT({ ...t, border: v })} />
                  </div>
                  <Field label="밝기 기준">
                    <input
                      type="range"
                      aria-label="밝기 기준"
                      min={20}
                      max={235}
                      value={t.threshold}
                      onChange={(e) => setT({ ...t, threshold: Number(e.target.value) })}
                      className="w-full accent-[var(--seed-color-bg-brand-solid)]"
                    />
                  </Field>
                  <Toggle checked={t.invert} onChange={(v) => setT({ ...t, invert: v })}>
                    채운칸·빈칸 뒤집기
                  </Toggle>
                </>
              )}

              {kind === "image" && (
                <>
                  {!img ? (
                    <label
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
                        "flex h-44 cursor-pointer flex-col items-center justify-center gap-x2 rounded-r3 border-2 border-dashed px-x4 text-center text-[0.875rem] text-fg-neutral-muted transition-colors",
                        dragOver ? "border-stroke-brand-solid bg-bg-brand-weak" : "border-stroke-neutral-weak hover:bg-bg-layer-fill",
                      )}
                    >
                      <Upload className="size-6" />
                      이미지를 끌어다 놓거나 눌러서 고르세요
                      <input type="file" accept="image/*" aria-label="이미지 고르기" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-x3 rounded-r3 border border-stroke-neutral-muted p-x2">
                      {imgUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt="" className="size-14 rounded-r2 bg-bg-layer-fill object-contain" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-semibold">{img.name}</p>
                        <p className="text-[0.75rem] text-fg-neutral-muted">
                          {img.width} × {img.height}px
                        </p>
                      </div>
                      <label className="cursor-pointer rounded-r2 px-x2 py-x1 text-[0.8125rem] font-semibold text-fg-neutral hover:bg-bg-layer-fill">
                        이미지 바꾸기
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                      </label>
                      <IconButton
                        label="이미지 빼기"
                        size="sm"
                        onClick={() => {
                          setImg(null);
                          setImgRes(null);
                          setImgUrl(null);
                        }}
                      >
                        <X />
                      </IconButton>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x3">
                    <NumberField label="가로 칸 수" value={io.cols} min={4} max={MAX_DIM} onChange={(v) => setIo({ ...io, cols: v })} />
                    <NumberField label="색 수" value={io.colors} min={2} max={MAX_COLORS} onChange={(v) => setIo({ ...io, colors: v })} />
                  </div>
                  {img && <p className="text-[0.75rem] text-fg-neutral-subtle">세로 단 수는 이미지 비율에 맞춰 {imageRows(img, io.cols, p.aspect)}단이 돼요.</p>}
                  <Toggle checked={io.dither} onChange={(v) => setIo({ ...io, dither: v })}>
                    점을 섞어 중간색 표현
                  </Toggle>
                  <Toggle checked={io.cleanup} onChange={(v) => setIo({ ...io, cleanup: v })}>
                    한 칸짜리 점 없애기
                  </Toggle>
                  {img && enough !== null && enough < io.colors && (
                    <Advice text={`이 이미지는 ${Math.max(2, enough)}색이면 충분해요.`} action={`${Math.max(2, enough)}색으로`} onAction={() => setIo({ ...io, colors: Math.max(2, enough) })} />
                  )}
                  {img && io.cols < 30 && <Advice text="선이 또렷하려면 가로 40칸 이상을 권해요." action="40칸으로" onAction={() => setIo({ ...io, cols: 40 })} />}
                </>
              )}

              {kind === "blank" && (
                <>
                  <div className="grid grid-cols-2 gap-x3">
                    <NumberField label="가로" value={blank.cols} min={1} max={MAX_DIM} suffix="코" onChange={(v) => setBlank({ ...blank, cols: v })} />
                    <NumberField label="세로" value={blank.rows} min={1} max={MAX_DIM} suffix="단" onChange={(v) => setBlank({ ...blank, rows: v })} />
                  </div>
                  <p className="text-[0.8125rem] leading-[1.6] text-fg-neutral-muted">지금 도안을 지우고 빈 격자로 시작해요. 실행 취소로 되돌릴 수 있어요.</p>
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-x2">
              <div className="relative h-[340px] overflow-hidden rounded-r3 bg-bg-layer-fill">
                {result ? (
                  <canvas ref={cvRef} className="size-full" aria-label="미리보기" />
                ) : (
                  <div className="flex size-full items-center justify-center text-[0.875rem] text-fg-neutral-subtle">{kind === "image" ? "고른 이미지가 없어요" : "준비 중"}</div>
                )}
              </div>
              {result && (
                <p className="text-[0.8125rem] text-fg-neutral-muted tabular-nums">
                  {result.cols} × {result.rows}칸 · {kind === "blank" ? 1 : colorsUsed}색
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Advice({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center gap-x2 rounded-r2 bg-bg-brand-weak px-x3 py-x2 text-[0.8125rem] text-fg-neutral">
      <span className="flex-1">{text}</span>
      <button type="button" onClick={onAction} className="shrink-0 font-semibold text-fg-brand hover:underline">
        {action}
      </button>
    </div>
  );
}
