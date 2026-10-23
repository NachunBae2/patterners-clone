"use client";

import type { GridData, Work } from "@/lib/types";

// Placeholder — implemented separately.
export default function GridEditor({ work }: { work: Work; data: GridData }) {
  return <div className="p-x8">{work.title}</div>;
}
