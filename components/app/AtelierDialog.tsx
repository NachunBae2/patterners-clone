"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Chip, Field, LocalNote, inputCls, textareaCls } from "./form";
import { Button, Dialog, useToast } from "./ui";
import { TAXONOMY, atelier, type AtelierMeta, type Category, type Difficulty, type License, type Technique, type YarnWeight } from "@/lib/atelier";
import { notifications } from "@/lib/notifications";
import { profile } from "@/lib/profile";
import { CRAFT_LABEL, type Craft, type WorkData } from "@/lib/types";
import { workThumb } from "@/lib/workSvg";

const entries = <K extends string>(o: Record<K, string>) => Object.entries(o) as [K, string][];

/** 아뜰리에에 올리기: publishes a snapshot of the work to the local atelier (this browser only). */
export function AtelierDialog({
  open,
  onClose,
  work,
}: {
  open: boolean;
  onClose: () => void;
  work: { id?: string; title: string; craft: Craft; data: WorkData };
}) {
  const toast = useToast();
  const router = useRouter();
  const [title, setTitle] = useState(work.title);
  const [description, setDescription] = useState("");
  const [meta, setMeta] = useState<AtelierMeta>({ license: "personal", techniques: [] });
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(work.title);
      setError("");
    }
  }
  // the thumbnail follows the work as it is when the dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thumb = useMemo(() => (open ? workThumb(work.craft, work.data) : ""), [open]);

  const pick = <K extends "category" | "difficulty" | "yarnWeight">(k: K, v: AtelierMeta[K]) => setMeta((m) => ({ ...m, [k]: m[k] === v ? undefined : v }));
  const toggleTech = (t: Technique) =>
    setMeta((m) => ({ ...m, techniques: m.techniques.includes(t) ? m.techniques.filter((x) => x !== t) : [...m.techniques, t] }));

  const publish = () => {
    const name = title.trim().slice(0, 60);
    if (!name) return setError("제목을 입력해 주세요.");
    const e = atelier.publish({
      title: name,
      description: description.trim(),
      craft: work.craft,
      meta,
      thumbnail: thumb,
      data: work.data,
      author: profile.get().nickname || "나",
      sourceId: work.id,
    });
    if (!e) return setError("브라우저 저장 공간이 가득 차서 올리지 못했어요. 쓰지 않는 도안을 지운 뒤 다시 해 주세요.");
    notifications.add({ kind: "atelier_publish", title: `‘${name}’ 도안을 아뜰리에에 올렸어요`, body: "이 브라우저의 아뜰리에에서 볼 수 있어요.", href: `/atelier?id=${e.id}` });
    toast("아뜰리에에 올렸어요", { label: "보기", run: () => router.push(`/atelier?id=${e.id}`) });
    setDescription("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="아뜰리에에 올리기"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={publish}>
            올리기
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-x4">
        <LocalNote>이 사본의 아뜰리에는 이 브라우저에만 저장되는 내 갤러리예요. 서버에 올리지 않아서 다른 사람에게는 보이지 않아요.</LocalNote>
        <div className="flex gap-x3">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="썸네일 미리보기" className="aspect-[4/3] w-36 shrink-0 rounded-r3 border border-stroke-neutral-muted bg-bg-layer-fill object-contain p-x2" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-x3">
            <Field label="제목" required>
              <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="예: 데일리 크롭 가디건" className={inputCls} />
            </Field>
            <p className="t2-regular text-fg-neutral-subtle">{CRAFT_LABEL[work.craft]} 도안 · 올리는 순간의 도안이 그대로 저장돼요.</p>
          </div>
        </div>
        <Field label="도안 소개">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="완성 사이즈, 난이도, 포함된 내용 등을 자유롭게 적어 주세요"
            className={textareaCls}
            rows={3}
          />
        </Field>
        <ChipGroup label="카테고리">
          {entries<Category>(TAXONOMY.category).map(([k, v]) => (
            <Chip key={k} on={meta.category === k} onClick={() => pick("category", k)}>
              {v}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="난이도">
          {entries<Difficulty>(TAXONOMY.difficulty).map(([k, v]) => (
            <Chip key={k} on={meta.difficulty === k} onClick={() => pick("difficulty", k)}>
              {v}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="실 굵기">
          {entries<YarnWeight>(TAXONOMY.yarnWeight).map(([k, v]) => (
            <Chip key={k} on={meta.yarnWeight === k} onClick={() => pick("yarnWeight", k)}>
              {v}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="기법 (여러 개)">
          {entries<Technique>(TAXONOMY.technique).map(([k, v]) => (
            <Chip key={k} on={meta.techniques.includes(k)} onClick={() => toggleTech(k)}>
              {v}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="라이선스" hint={TAXONOMY.licenseDesc[meta.license]}>
          {entries<License>(TAXONOMY.license).map(([k, v]) => (
            <Chip key={k} on={meta.license === k} onClick={() => setMeta((m) => ({ ...m, license: k }))}>
              {v}
            </Chip>
          ))}
        </ChipGroup>
        {error && <p className="t3-medium text-fg-critical">{error}</p>}
      </div>
    </Dialog>
  );
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-x1_5" role="group" aria-label={label}>
      <span className="t3-bold text-fg-neutral">{label}</span>
      <div className="flex flex-wrap gap-x1_5">{children}</div>
      {hint && <span className="t2-regular text-fg-neutral-subtle">{hint}</span>}
    </div>
  );
}
