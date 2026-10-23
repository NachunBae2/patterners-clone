"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { useWork } from "@/lib/store";
import type { CrochetData, GridData, KnitData } from "@/lib/types";

const Loading = () => <div className="flex h-dvh items-center justify-center text-[0.875rem] text-fg-neutral-muted">도안을 여는 중</div>;
const CrochetEditor = dynamic(() => import("@/components/editor/crochet/CrochetEditor"), { ssr: false, loading: Loading });
const KnitEditor = dynamic(() => import("@/components/editor/knitting/KnitEditor"), { ssr: false, loading: Loading });
const GridEditor = dynamic(() => import("@/components/editor/grid/GridEditor"), { ssr: false, loading: Loading });

export default function MakerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { work } = useWork(id);

  if (work === undefined) return <Loading />;
  if (work === null)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-x3 text-center">
        <p className="t6-bold">도안을 불러오지 못했어요.</p>
        <Link href="/home" className="lp-btn lp-btn-secondary">
          홈으로
        </Link>
      </div>
    );

  if (work.craft === "crochet") return <CrochetEditor work={work} data={work.data as CrochetData} />;
  if (work.craft === "knitting") return <KnitEditor work={work} data={work.data as KnitData} />;
  return <GridEditor work={work} data={work.data as GridData} />;
}
