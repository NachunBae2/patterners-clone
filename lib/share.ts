"use client";

// Share links carry the whole work inside the URL hash: JSON → deflate-raw → base64url.
// The hash never reaches a server, so nothing is uploaded anywhere.
import type { Craft, WorkData } from "./types";

export type SharedWork = { title: string; craft: Craft; data: WorkData; at: number };

type Payload = { v: 1; t: string; c: Craft; d: WorkData; at: number };

const CRAFTS: Craft[] = ["crochet", "knitting", "grid"];
/** Longer links still work in the browser, but many messengers cut them off. */
export const LONG_LINK = 8000;

function toB64Url(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Minimal shape check so a hand-made link can't crash the viewer or an editor. */
function validData(craft: Craft, d: unknown): d is WorkData {
  if (!d || typeof d !== "object") return false;
  const x = d as Record<string, unknown>;
  const arr = (v: unknown) => Array.isArray(v);
  if (craft === "crochet") return arr(x.layers) && (x.layers as { items?: unknown }[]).every((l) => l && arr(l.items));
  if (craft === "knitting") return arr(x.grids) && (x.grids as { cells?: unknown; cols?: unknown; rows?: unknown }[]).every((g) => g && arr(g.cells) && Number(g.cols) > 0 && Number(g.rows) > 0);
  return (
    arr(x.pages) &&
    arr(x.yarns) &&
    (x.pages as { cells?: unknown; cols?: unknown; rows?: unknown }[]).every((p) => p && arr(p.cells) && Number(p.cols) > 0 && Number(p.rows) > 0 && Number(p.cols) * Number(p.rows) <= 300 * 300)
  );
}

/** Encodes a work into the hash part of a share link (without the leading #). */
export async function encodeShare(w: { title: string; craft: Craft; data: WorkData }): Promise<string> {
  const p: Payload = { v: 1, t: w.title, c: w.craft, d: w.data, at: Date.now() };
  const json = new TextEncoder().encode(JSON.stringify(p));
  return toB64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Decodes a share hash. Returns null for anything that isn't a valid share payload. */
export async function decodeShare(hash: string): Promise<SharedWork | null> {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = await pipe(fromB64Url(raw), new DecompressionStream("deflate-raw"));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Payload>;
    if (p?.v !== 1 || !CRAFTS.includes(p.c as Craft) || !validData(p.c as Craft, p.d)) return null;
    return { title: typeof p.t === "string" && p.t.trim() ? p.t.slice(0, 60) : "제목 없음", craft: p.c as Craft, data: p.d, at: Number(p.at) || Date.now() };
  } catch {
    return null;
  }
}

/** Full share URL for the current origin. */
export async function shareUrl(w: { title: string; craft: Craft; data: WorkData }) {
  return `${window.location.origin}/share#${await encodeShare(w)}`;
}
