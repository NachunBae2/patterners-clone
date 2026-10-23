"use client";

import type { CrochetData, Work } from "@/lib/types";

// Placeholder — implemented separately.
export default function CrochetEditor({ work }: { work: Work; data: CrochetData }) {
  return <div className="p-x8">{work.title}</div>;
}
