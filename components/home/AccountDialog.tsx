"use client";

import { useRef, useState } from "react";
import { Button, Dialog, cx, useToast } from "@/components/app/ui";
import { Field, LocalNote, inputCls } from "@/components/app/form";
import { BackupError, clearAllLocalData, downloadBackup, restoreBackup } from "@/lib/backup";
import { notifications } from "@/lib/notifications";
import { AVATAR_COLORS, profile, validNickname, useProfile } from "@/lib/profile";
import { useWorkList } from "@/lib/store";

export function Avatar({ nickname, color, size = 48 }: { nickname: string; color: string; size?: number }) {
  const ch = [...(nickname.trim() || "P")][0].toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-palette-static-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
    >
      {ch}
    </span>
  );
}

/** 계정 설정: local profile (nickname, avatar colour) + data (backup, restore, delete all). */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const saved = useProfile();
  const list = useWorkList();
  const [nickname, setNickname] = useState(saved.nickname);
  const [color, setColor] = useState(saved.color);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNickname(saved.nickname);
      setColor(saved.color);
      setError("");
    }
  }

  const save = () => {
    if (!nickname.trim()) return setError("닉네임을 입력해 주세요");
    if (!validNickname(nickname)) return setError("2–24자, 영문·한글·숫자와 !,.,?-_()'~· 만 사용해 주세요.");
    profile.save({ nickname, color });
    setError("");
    toast("프로필이 저장됐어요");
  };

  const backup = () => {
    const n = downloadBackup();
    toast(n ? `도안 ${n}개를 백업 파일로 저장했어요.` : "백업할 도안이 없어요. 빈 백업 파일을 저장했어요.");
  };

  const restore = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await restoreBackup(f);
      const msg = `새로 ${r.added}개, 갱신 ${r.updated}개${r.kept ? `, 그대로 ${r.kept}개` : ""}${r.failed ? `, 실패 ${r.failed}개` : ""}`;
      notifications.add({ kind: "restore", title: "백업 파일에서 도안을 복원했어요", body: msg, href: "/home" });
      toast(`복원했어요 · ${msg}`);
    } catch (e) {
      toast(e instanceof BackupError ? e.message : "파일을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  const wipe = () => {
    if (!confirm("이 브라우저에 저장된 모든 도안, 버전 기록, 아뜰리에, 프로필, 알림, 보낸 문의를 지울까요? 되돌릴 수 없어요. 먼저 백업 파일을 받아 두는 것을 권해요.")) return;
    clearAllLocalData();
    // reload so every in-memory store starts empty
    window.location.assign("/home");
  };

  const live = list.filter((w) => !w.deletedAt).length;
  const trashed = list.length - live;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="계정 설정"
      width={520}
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-x5">
        <LocalNote>이 사본에는 계정이 없어요. 프로필과 도안은 이 브라우저에만 저장되고, 로그아웃해도 도안은 그대로 남아요.</LocalNote>

        <section className="flex flex-col gap-x3" aria-label="프로필">
          <h3 className="t4-bold text-fg-neutral">프로필 설정</h3>
          <div className="flex items-center gap-x3">
            <Avatar nickname={nickname} color={color} size={56} />
            <div className="flex flex-col gap-x1_5">
              <span className="t3-bold text-fg-neutral">프로필 색</span>
              <div className="flex flex-wrap gap-x1_5" role="radiogroup" aria-label="프로필 색">
                {AVATAR_COLORS.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={c === color}
                    aria-label={`색 ${i + 1}`}
                    onClick={() => setColor(c)}
                    className={cx("size-7 rounded-full", c === color && "ring-2 ring-stroke-neutral-contrast ring-offset-2")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <Field label="닉네임" hint={error ? <span className="text-fg-critical">{error}</span> : "2–24자, 영문·한글·숫자와 !,.,?-_()'~· 만 사용해 주세요."}>
            <input
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="예: 뜨개하는 곰"
              className={inputCls}
            />
          </Field>
        </section>

        <section className="flex flex-col gap-x3 border-t border-stroke-neutral-muted pt-x4" aria-label="데이터">
          <div>
            <h3 className="t4-bold text-fg-neutral">데이터</h3>
            <p className="mt-x1 t3-regular text-fg-neutral-muted">
              지금 이 브라우저에 도안 {live}개{trashed ? `(휴지통 ${trashed}개)` : ""}가 있어요. 백업 파일은 다시 편집할 수 있는 .json 파일이에요.
            </p>
          </div>
          <div className="flex flex-wrap gap-x2">
            <Button onClick={backup}>모든 도안 백업</Button>
            <Button onClick={() => file.current?.click()} disabled={busy}>
              {busy ? "불러오는 중…" : "백업에서 복원"}
            </Button>
            <input ref={file} type="file" accept=".json,application/json" className="hidden" aria-label="백업 파일 선택" onChange={(e) => restore(e.target.files?.[0])} />
          </div>
          <p className="t2-regular text-fg-neutral-subtle">복원은 이 브라우저의 도안을 지우지 않아요. 같은 도안이 있으면 더 최근에 고친 쪽을 남겨요.</p>
          <div className="mt-x1 flex items-center justify-between gap-x3 rounded-r3 border border-stroke-neutral-muted p-x3">
            <div>
              <p className="t3-bold text-fg-critical">모든 로컬 데이터 삭제</p>
              <p className="t2-regular text-fg-neutral-muted">도안, 버전 기록, 아뜰리에, 프로필, 알림을 모두 지워요.</p>
            </div>
            <Button variant="danger" size="sm" onClick={wipe}>
              삭제
            </Button>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
