"use client";

import type { KnitData, Work } from "@/lib/types";

// Placeholder — implemented separately.
export default function KnitEditor({ work }: { work: Work; data: KnitData }) {
  return <div className="p-x8">{work.title}</div>;
}
