"use client";

// Local notifications ("알림") written by things that happen in this browser:
// publishing to the local atelier, importing from it, restoring a backup, saving an inquiry.
import { uid } from "./id";
import { createLocalList } from "./localList";

export type Notice = {
  id: string;
  at: number;
  kind: "atelier_publish" | "atelier_import" | "restore" | "backup" | "inquiry" | "share_import";
  title: string;
  body?: string;
  /** in-app link opened when the notification is clicked */
  href?: string;
  read: boolean;
};

const list = createLocalList<Notice>("pt:notifications", 100);

export const notifications = {
  list: list.read,
  add(n: Omit<Notice, "id" | "at" | "read">) {
    list.write([{ ...n, id: uid(), at: Date.now(), read: false }, ...list.read()]);
  },
  markRead: (id: string) => list.write(list.read().map((n) => (n.id === id ? { ...n, read: true } : n))),
  markAllRead: () => list.write(list.read().map((n) => (n.read ? n : { ...n, read: true }))),
  remove: (id: string) => list.write(list.read().filter((n) => n.id !== id)),
  clear: () => list.write([]),
};

export const useNotifications = list.useList;
