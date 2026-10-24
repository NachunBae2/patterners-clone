"use client";

// One-file backup of every work in this browser, and restore from such a file.
import { download } from "./export";
import { works } from "./store";
import type { Craft, Work } from "./types";

export const BACKUP_FORMAT = "patterners-backup";
export const BACKUP_VERSION = 1;
const MAX_BYTES = 50 * 1024 * 1024;
const CRAFTS: Craft[] = ["crochet", "knitting", "grid"];

type BackupFile = { format: typeof BACKUP_FORMAT; version: number; exportedAt: number; works: Work[] };

/** Downloads all works (trash included) as one .json file. Returns the number of works. */
export function downloadBackup(): number {
  const all = works
    .list()
    .map((m) => works.get(m.id))
    .filter((w): w is Work => !!w);
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), works: all };
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  download(new Blob([JSON.stringify(file)], { type: "application/json" }), `patterners-backup-${stamp}.json`);
  return all.length;
}

export type RestoreResult = { added: number; updated: number; kept: number; failed: number };

/** Error messages follow the PatternersFile strings. */
export class BackupError extends Error {}

const isWork = (w: unknown): w is Work => {
  const x = w as Work;
  return !!x && typeof x.id === "string" && typeof x.title === "string" && CRAFTS.includes(x.craft) && !!x.data && typeof x.data === "object";
};

/**
 * Restores works from a backup file. Works with an id that already exists are replaced only
 * when the file's copy is newer; nothing local is deleted.
 */
export async function restoreBackup(file: File): Promise<RestoreResult> {
  if (file.size > MAX_BYTES) throw new BackupError("파일이 너무 커요. 50MB 이하 백업 파일만 불러올 수 있어요.");
  let parsed: Partial<BackupFile>;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupError("파일을 읽을 수 없어요. 패터너스 백업 파일(.json)이 맞는지 확인해 주세요.");
  }
  if (parsed?.format !== BACKUP_FORMAT || !Array.isArray(parsed.works)) throw new BackupError("패터너스 백업 파일이 아니에요. 계정 설정에서 받은 백업 파일을 골라 주세요.");
  if ((parsed.version ?? 0) > BACKUP_VERSION) throw new BackupError("더 새로운 패터너스에서 만든 파일이에요. 페이지를 새로고침한 뒤 다시 불러와 주세요.");
  const local = new Map(works.list().map((w) => [w.id, w]));
  const r: RestoreResult = { added: 0, updated: 0, kept: 0, failed: 0 };
  // oldest first so the newest ends up on top of the list index
  const incoming = [...parsed.works].filter(isWork).sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  r.failed = parsed.works.length - incoming.length;
  for (const w of incoming) {
    const mine = local.get(w.id);
    if (mine && mine.updatedAt >= (w.updatedAt ?? 0)) {
      r.kept++;
      continue;
    }
    const now = Date.now();
    const ok = works.put({ ...w, createdAt: w.createdAt ?? now, updatedAt: w.updatedAt ?? now });
    if (!ok) r.failed++;
    else if (mine) r.updated++;
    else r.added++;
  }
  if (!incoming.length && parsed.works.length) throw new BackupError("파일 내용이 손상됐거나 올바르지 않아요.");
  return r;
}

/** Removes every key this app keeps in localStorage (works, versions, atelier, profile, notifications…). */
export function clearAllLocalData() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("pt:") || k.startsWith("patterners."))) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys.length;
}
