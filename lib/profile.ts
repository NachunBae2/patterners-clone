"use client";

// Local profile (nickname + avatar colour) and the "signed in" flag of this browser.
// There are no accounts: logging out only clears these keys.
import { useSyncExternalStore } from "react";

export type Profile = { nickname: string; color: string };

const PROFILE_KEY = "pt:profile";
const SESSION_KEY = "pt:session";

/** Avatar colours (SEED palette). */
export const AVATAR_COLORS = [
  "var(--seed-color-bg-brand-solid)",
  "var(--seed-color-palette-blue-600)",
  "var(--seed-color-palette-carrot-600)",
  "var(--seed-color-palette-purple-600)",
  "var(--seed-color-palette-yellow-700)",
  "var(--seed-color-palette-red-600)",
  "var(--seed-color-palette-gray-700)",
];

export const DEFAULT_PROFILE: Profile = { nickname: "", color: AVATAR_COLORS[0] };

/** Profile.nicknameInvalid: 2–24자, 영문·한글·숫자와 !,.,?-_()'~· (and spaces). */
export const validNickname = (s: string) => /^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ!,.?\-_()'~· ]{2,24}$/.test(s.trim()) && s.trim().length >= 2;

const listeners = new Set<() => void>();
let cache: Profile | null = null;

function read(): Profile {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    cache = v && typeof v.nickname === "string" ? { nickname: v.nickname, color: typeof v.color === "string" ? v.color : AVATAR_COLORS[0] } : DEFAULT_PROFILE;
  } catch {
    cache = DEFAULT_PROFILE;
  }
  return cache;
}

export const profile = {
  get: read,
  save(p: Profile) {
    cache = { nickname: p.nickname.trim(), color: p.color };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(cache));
      localStorage.setItem(SESSION_KEY, "1");
    } catch {}
    listeners.forEach((l) => l());
  },
  /** 로그아웃: forget the local profile and session flag. Works stay in this browser. */
  logout() {
    cache = DEFAULT_PROFILE;
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    listeners.forEach((l) => l());
  },
};

export function useProfile(): Profile {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_PROFILE,
  );
}
