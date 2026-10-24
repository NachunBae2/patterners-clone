"use client";

import { useState } from "react";
import { Button, Dialog, Segmented, useToast } from "@/components/app/ui";
import { Chip, Field, LocalNote, Tag, inputCls, textareaCls } from "@/components/app/form";
import { uid } from "@/lib/id";
import { createLocalList } from "@/lib/localList";
import { notifications } from "@/lib/notifications";
import { site } from "@/lib/site";

const CATEGORIES = [
  ["general", "일반"],
  ["feature", "기능"],
  ["feedback", "사용 의견"],
  ["partnership", "제휴"],
  ["enterprise", "기업"],
  ["billing", "결제"],
  ["other", "기타"],
] as const;
type Category = (typeof CATEGORIES)[number][0];
const CAT_LABEL = Object.fromEntries(CATEGORIES) as Record<Category, string>;

export type Inquiry = { id: string; at: number; name: string; email: string; category: Category; message: string };
const sent = createLocalList<Inquiry>("pt:inquiries", 100);

function mailtoOf(q: Inquiry) {
  const subject = `[패터너스 문의 · ${CAT_LABEL[q.category]}] ${q.message.split("\n")[0].slice(0, 40)}`;
  const body = `이름: ${q.name || "-"}\n이메일: ${q.email}\n문의 유형: ${CAT_LABEL[q.category]}\n\n${q.message}`;
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Opens the user's mail app. A real link click, so browsers treat it like any mailto: link. */
function openMail(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const fmt = (ts: number) => new Date(ts).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });

/** 문의하기: the form opens the user's mail app (mailto:) and keeps a local copy under "보낸 문의". */
export function ContactDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const list = sent.useList();
  const [tab, setTab] = useState<"new" | "sent">("new");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<Inquiry | null>(null);

  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !message.trim()) {
      setError("필수 항목을 입력해 주세요");
      return;
    }
    const q: Inquiry = { id: uid(), at: Date.now(), name: name.trim(), email: email.trim(), category, message: message.trim() };
    sent.write([q, ...sent.read()]);
    notifications.add({ kind: "inquiry", title: "문의 사본을 ‘보낸 문의’에 남겼어요", body: CAT_LABEL[category] });
    openMail(mailtoOf(q));
    setMessage("");
    setError("");
    setTab("sent");
    setViewing(q);
    toast("메일 앱을 열었어요. 메일 앱에서 보내기를 눌러야 전달돼요.");
  };

  const close = () => {
    setViewing(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={viewing ? "문의 상세" : "문의하기"}
      width={520}
      footer={
        viewing ? (
          <>
            <Button onClick={() => setViewing(null)}>목록으로</Button>
            <Button variant="primary" onClick={() => openMail(mailtoOf(viewing))}>
              메일 앱으로 다시 열기
            </Button>
          </>
        ) : tab === "new" ? (
          <>
            <Button onClick={close}>취소</Button>
            <Button variant="primary" onClick={submit}>
              보내기
            </Button>
          </>
        ) : undefined
      }
    >
      {viewing ? (
        <div className="flex flex-col gap-x3">
          <div className="flex items-center gap-x1_5">
            <Tag>{CAT_LABEL[viewing.category]}</Tag>
            <span className="t2-regular text-fg-neutral-subtle">{fmt(viewing.at)} · 메일 앱으로 보냄</span>
          </div>
          <p className="t3-regular text-fg-neutral-muted">
            {viewing.name || "이름 없음"} · {viewing.email}
          </p>
          <p className="t4-regular whitespace-pre-wrap text-fg-neutral">{viewing.message}</p>
          <LocalNote>이 사본은 이 브라우저에만 있어요. 답변은 메일로 받게 돼요.</LocalNote>
        </div>
      ) : (
        <div className="flex flex-col gap-x4" onInput={() => error && setError("")}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "new", label: "새 문의하기" },
              { value: "sent", label: `보낸 문의${list.length ? ` ${list.length}` : ""}` },
            ]}
          />
          {tab === "new" ? (
            <>
              <p className="t3-regular text-fg-neutral-muted">일반 문의, 제휴·기업 상담을 남겨 주세요. 확인 후 이메일로 답변드려요.</p>
              <LocalNote>
                보내기를 누르면 메일 앱이 열리고, 내용이 {site.email} 앞으로 채워져요. 이 사본은 서버로 아무것도 보내지 않아요. 메일 앱에서 보내기를 눌러야 전달돼요.
              </LocalNote>
              <div className="grid gap-x3 sm:grid-cols-2">
                <Field label="이름">
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="name" />
                </Field>
                <Field label="이메일" required>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
                </Field>
              </div>
              <div className="flex flex-col gap-x1_5">
                <span className="t3-bold text-fg-neutral">문의 유형</span>
                <div className="flex flex-wrap gap-x1_5">
                  {CATEGORIES.map(([id, label]) => (
                    <Chip key={id} on={category === id} onClick={() => setCategory(id)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label="내용" required>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="내용을 상세하게 적어 주세요" className={textareaCls} rows={5} />
              </Field>
              {error && <p className="t3-medium text-fg-critical">{error}</p>}
              <p className="t2-regular text-fg-neutral-subtle">문의 내용은 답변 목적에만 사용돼요.</p>
            </>
          ) : list.length === 0 ? (
            <p className="py-x8 text-center t4-regular text-fg-neutral-muted">아직 문의 내역이 없어요.</p>
          ) : (
            <ul className="-mx-x2 flex flex-col">
              {list.map((q) => (
                <li key={q.id}>
                  <button type="button" onClick={() => setViewing(q)} className="flex w-full flex-col gap-x1 rounded-r2 px-x2 py-x3 text-left hover:bg-bg-layer-fill">
                    <span className="flex items-center gap-x1_5">
                      <Tag>{CAT_LABEL[q.category]}</Tag>
                      <span className="t2-regular text-fg-neutral-subtle">{fmt(q.at)}</span>
                    </span>
                    <span className="truncate t4-regular text-fg-neutral">{q.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
