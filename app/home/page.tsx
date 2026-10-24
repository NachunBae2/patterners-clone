"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, ContextMenu, Dialog, Menu, cx, useToast, type MenuItem } from "@/components/app/ui";
import { HomeSidebar, NAV, type FooterAction, type HomeView } from "@/components/home/Sidebar";
import { AccountDialog } from "@/components/home/AccountDialog";
import { ContactDialog } from "@/components/home/ContactDialog";
import { HelpChat } from "@/components/home/HelpChat";
import { NoticesDialog } from "@/components/home/NoticesDialog";
import { NotificationsBell } from "@/components/home/NotificationsPopover";
import { PlanDialog } from "@/components/home/PlanDialog";
import {
  ApparelGlyph,
  CrochetGlyph,
  GridGlyph,
  KnittingGlyph,
  MegaphoneIcon,
  MenuIcon,
  MoreIcon,
  PaperGlyph,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
  XIcon,
} from "@/components/home/icons";
import { Wordmark } from "@/components/Wordmark";
import { SpotlightTour, tourSeen, type TourStep } from "@/components/tour/SpotlightTour";
import type { HelpAction } from "@/lib/helpIndex";
import { markNoticesRead, noticesRead } from "@/lib/notices";
import { profile } from "@/lib/profile";
import { useWorkList, works } from "@/lib/store";
import { CRAFT_LABEL, type Craft, type Work } from "@/lib/types";
import "@/components/home/home.css";

type Entry = Omit<Work, "data">;
type Sort = "updated" | "created";

const SOON = "준비 중이에요";
const NOTICE_ID = "26.10.21";
const NOTICE_KEY = "patterners.home.noticeDismissed";

const EMPTY: Record<HomeView, string> = {
  all: "아직 파일이 없어요.",
  crochet: "아직 코바늘 도안이 없어요.",
  knitting: "아직 대바늘 도안이 없어요.",
  grid: "아직 배색·방안 도안이 없어요.",
  apparel: "아직 의류 도안이 없어요.",
  papers: "아직 페이퍼가 없어요.",
  trash: "휴지통이 비어 있어요.",
};

const NEW_TITLE: Record<Craft, string> = {
  crochet: "새 코바늘 도안",
  knitting: "새 대바늘 도안",
  grid: "새 배색·방안 도안",
  apparel: "새 의류 도안",
  paper: "새 페이퍼",
};

type Kind = Craft;
/** Create buttons, in reference order, with their square badge colours. */
const CREATE: { kind: Kind; label: string; color: string; Glyph: (p: { className?: string }) => ReactNode }[] = [
  { kind: "crochet", label: "코바늘", color: "var(--seed-color-bg-brand-solid)", Glyph: CrochetGlyph },
  { kind: "knitting", label: "대바늘", color: "var(--seed-color-palette-blue-600)", Glyph: KnittingGlyph },
  { kind: "grid", label: "배색·방안", color: "var(--seed-color-palette-carrot-600)", Glyph: GridGlyph },
  { kind: "apparel", label: "의류 (beta)", color: "var(--seed-color-palette-purple-600)", Glyph: ApparelGlyph },
  { kind: "paper", label: "페이퍼", color: "var(--seed-color-palette-yellow-700)", Glyph: PaperGlyph },
];
const CRAFT_BADGE = Object.fromEntries(CREATE.map((c) => [c.kind, c])) as Record<Kind, (typeof CREATE)[number]>;

/** "내 작업 공간" first-visit tour (HomeTour strings; anchors as in the reference). */
const HOME_TOUR: TourStep[] = [
  {
    id: "welcome",
    anchor: null,
    title: "내 작업 공간",
    body: "저장한 도안과 페이퍼가 여기에 모여 있어요. 주요 사용 방법을 짧게 둘러볼게요. 언제든 건너뛸 수 있고, 사이드바에서 다시 볼 수 있어요.",
  },
  {
    id: "create",
    anchor: "home-new-work",
    side: "bottom",
    title: "새 도안 만들기",
    body: `오른쪽 위에서 ${CREATE.map((c) => c.label).join(", ")}를 바로 만들 수 있어요.`,
  },
  {
    id: "card",
    anchor: "home-work-card",
    side: "bottom",
    title: "카드 메뉴",
    body: "도안 카드를 마우스 오른쪽 버튼으로 클릭하면 이름 변경, 고정, 커버, 복제, 삭제를 할 수 있어요. 터치 기기에서는 카드를 길게 누르면 같은 메뉴가 열려요.",
  },
  {
    id: "trash",
    anchor: "home-trash",
    side: "right",
    title: "휴지통",
    body: "삭제한 작업은 왼쪽 휴지통에 30일 동안 보관된 뒤 자동으로 지워져요. 그 안에서 복원하거나 영구 삭제할 수 있어요.",
  },
];

const SORT_LABEL: Record<Sort, string> = { updated: "최근 편집순", created: "생성일 순" };

// Korean initial-consonant search (e.g. ㅋㅂㄴ → 코바늘)
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const initials = (s: string) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
const matches = (title: string, q: string) => {
  const t = title.toLowerCase();
  const query = q.toLowerCase().trim();
  return !query || t.includes(query) || initials(t).includes(query);
};

function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

/** "새 코바늘 도안 1", "… 2", … — next free number for that craft. */
function nextTitle(list: Entry[], craft: Craft) {
  const base = NEW_TITLE[craft];
  const re = new RegExp(`^${base} (\\d+)$`);
  const n = list.reduce((m, w) => Math.max(m, Number(re.exec(w.title)?.[1] ?? 0)), 0);
  return `${base} ${n + 1}`;
}

const isView = (v: string | null): v is HomeView => !!v && NAV.some((n) => n.id === v && n.ready);

export default function HomePage() {
  const list = useWorkList();
  const router = useRouter();
  const toast = useToast();
  const [view, setViewState] = useState<HomeView>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState(true);
  const [tour, setTour] = useState(false);
  const [dialog, setDialog] = useState<"notices" | "contact" | "plan" | "account" | null>(null);
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [noticeDot, setNoticeDot] = useState(true);
  const soon = () => toast(SOON);

  // Restore ?tab= and the dismissed notice after mount (static page, no SSR data).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(NOTICE_KEY) === NOTICE_ID;
    } catch {}
    if (isView(tab)) setViewState(tab);
    if (dismissed) setNotice(false);
    if (noticesRead()) setNoticeDot(false);
    // first visit: the "내 작업 공간" tour (after paint, like the reference)
    const raf = requestAnimationFrame(() => {
      if (!tourSeen.home()) setTour(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const openTour = () => {
    setNavOpen(false);
    if (view !== "all") setView("all");
    setTour(true);
  };
  const closeTour = () => {
    tourSeen.markHome();
    setTour(false);
  };

  const setView = (v: HomeView) => {
    setViewState(v);
    setNavOpen(false);
    window.history.replaceState(null, "", v === "all" ? "/home" : `/home?tab=${v}`);
  };

  // A native <dialog> fires "close" after the next one opened (e.g. 플랜 → 문의하기),
  // so only clear the state when it still points at the dialog that closed.
  const closeDialog = (which: NonNullable<typeof dialog>) => setDialog((d) => (d === which ? null : d));

  const openNotices = (id: string | null) => {
    setNavOpen(false);
    setNoticeId(id);
    setDialog("notices");
    markNoticesRead();
    setNoticeDot(false);
  };

  /** Sidebar footer items and help-chat shortcuts. */
  const onAction = (a: FooterAction | HelpAction) => {
    setNavOpen(false);
    if (a === "atelier") return router.push("/atelier");
    if (a === "tour") return openTour();
    if (a === "help") return setHelp(true);
    if (a === "notices") return openNotices(null);
    if (a === "logout") {
      profile.logout();
      return router.push("/");
    }
    setDialog(a);
  };

  const dismissNotice = () => {
    setNotice(false);
    try {
      localStorage.setItem(NOTICE_KEY, NOTICE_ID);
    } catch {}
  };

  const visible = useMemo(() => {
    const live = list.filter((w) => (view === "trash" ? !!w.deletedAt : !w.deletedAt));
    const craft = view === "papers" ? "paper" : view;
    const byView = view === "all" || view === "trash" ? live : live.filter((w) => w.craft === craft);
    return byView
      .filter((w) => matches(w.title, query))
      .sort((a, b) => (sort === "updated" ? b.updatedAt - a.updatedAt : b.createdAt - a.createdAt));
  }, [list, view, query, sort]);
  const pinned = view === "trash" ? [] : visible.filter((w) => w.pinned);
  const rest = view === "trash" ? visible : visible.filter((w) => !w.pinned);
  const hasLive = list.some((w) => !w.deletedAt);

  const create = (kind: Kind) => {
    const w = works.create(kind, nextTitle(list, kind));
    router.push(`/maker/${w.id}`);
  };

  const title = NAV.find((n) => n.id === view)?.label ?? "모든 파일";
  const trash = view === "trash";

  return (
    <div className="flex min-h-dvh bg-bg-layer-default" data-own-chrome="true" data-works-home="">
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col lg:flex">
        <HomeSidebar className="min-h-dvh" view={view} onView={setView} onSoon={soon} onTour={openTour} onAction={onAction} noticeDot={noticeDot} />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="relative h-dvh bg-bg-layer-default shadow-s3">
            <HomeSidebar className="h-dvh" view={view} onView={setView} onSoon={soon} onTour={openTour} onAction={onAction} noticeDot={noticeDot} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-y-auto px-x5 py-x8 sm:px-x8 sm:py-x10">
        {/* mobile top bar (the sidebar is hidden below lg) */}
        <div className="-mt-x3 mb-x4 flex items-center gap-x2 lg:hidden">
          <button
            type="button"
            aria-label="메뉴"
            onClick={() => setNavOpen(true)}
            className="seed-action-button seed-action-button--variant_ghost seed-action-button--size_small seed-action-button--layout_iconOnly seed-action-button--size_small-layout_iconOnly rounded-full"
          >
            <MenuIcon className="seed-icon" />
          </button>
          <Wordmark className="h-6 text-fg-neutral" />
        </div>

        {notice && (
          <div className="seed-callout__root seed-callout__root--tone_informative mb-x4">
            <MegaphoneIcon className="seed-prefix-icon" />
            <div className="seed-callout__content seed-callout__content--tone_informative flex min-w-0 flex-1 items-baseline gap-x1_5">
              <span className="seed-callout__title seed-callout__title--tone_informative shrink-0 whitespace-nowrap">새 공지</span>
              <span className="seed-callout__description seed-callout__description--tone_informative min-w-0 truncate">[update] 기능 업데이트 안내 (26.10.21)</span>
              <button type="button" className="seed-callout__link seed-callout__link--tone_informative shrink-0" onClick={() => openNotices(NOTICE_ID)}>
                보기
              </button>
            </div>
            <button type="button" aria-label="공지 배너 닫기" className="seed-callout__closeButton seed-callout__closeButton--tone_informative" onClick={dismissNotice}>
              <XIcon className="seed-suffix-icon" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x3 border-b border-stroke-neutral-muted pb-x4">
          <h1 className="t6-bold text-fg-neutral sm:t7-bold">{title}</h1>
          <div className="flex flex-wrap items-center justify-end gap-x2">
            <label className="relative block w-full sm:w-56" data-works-search="">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-neutral-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제목으로 검색"
                aria-label="제목으로 검색"
                className="h-x9 w-full rounded-full border border-stroke-neutral-muted bg-bg-layer-default pr-x8 pl-x8 t3-regular text-fg-neutral outline-none placeholder:text-fg-neutral-subtle focus:border-stroke-neutral-contrast [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-neutral-subtle hover:bg-bg-layer-fill"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </label>
            <span className="hidden lg:contents">
              <NotificationsBell />
            </span>
            {trash ? (
              visible.length > 0 && (
                <button
                  type="button"
                  className="seed-action-button seed-action-button--variant_neutralOutline seed-action-button--size_small seed-action-button--layout_withText seed-action-button--size_small-layout_withText seed-scale-feedback rounded-full text-fg-critical"
                  onClick={() => {
                    if (confirm("휴지통의 모든 항목을 영구적으로 삭제할까요? 이 작업은 되돌릴 수 없어요.")) {
                      visible.forEach((w) => works.destroy(w.id));
                      toast("휴지통을 비웠어요");
                    }
                  }}
                >
                  휴지통 비우기
                </button>
              )
            ) : (
              <>
                <div data-tour="home-new-work">
                  <div className="flex flex-wrap items-center gap-x2">
                    {CREATE.map(({ kind, label, color, Glyph }) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => create(kind)}
                        className={cx(
                          "seed-action-button seed-action-button--variant_neutralOutline seed-action-button--size_small seed-action-button--layout_withText seed-action-button--size_small-layout_withText seed-scale-feedback rounded-full pr-x2",
                          !hasLive && "work-create-pulse",
                        )}
                      >
                        <PlusIcon className="seed-prefix-icon" />
                        {label}
                        <span className="ml-x0_5 flex size-x5 items-center justify-center rounded-r1 text-palette-static-white" aria-hidden="true" style={{ backgroundColor: color }}>
                          <Glyph className="size-x3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <Menu
                  align="end"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      aria-label={SORT_LABEL[sort]}
                      aria-haspopup="menu"
                      onClick={toggle}
                      className="seed-action-button seed-action-button--variant_neutralOutline seed-action-button--size_small seed-action-button--layout_withText seed-action-button--size_small-layout_withText seed-scale-feedback rounded-full"
                    >
                      <SortIcon className="seed-prefix-icon" />
                      <span className="hidden min-[1440px]:inline">{SORT_LABEL[sort]}</span>
                    </button>
                  )}
                  items={(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({
                    label: (s === sort ? "✓ " : "") + SORT_LABEL[s],
                    onSelect: () => setSort(s),
                  }))}
                />
              </>
            )}
          </div>
        </div>

        {trash && <p className="mt-x4 t3-regular text-fg-neutral-muted">삭제한 작업은 30일 동안 여기에 보관된 뒤 자동으로 지워져요.</p>}

        {visible.length === 0 ? (
          <div data-tour="home-work-card" className="flex min-h-[50dvh] flex-col items-center justify-center gap-x2 px-x4 text-center">
            <p className="t7-bold text-fg-neutral">{query ? `‘${query}’에 맞는 파일이 없어요` : EMPTY[view]}</p>
            {(query || !trash) && (
              <p className="t4-regular text-fg-neutral-muted">
                {query ? "다른 낱말이나 초성(예: ㅋㅂㄴ)으로 찾아보세요." : "오른쪽 위에서 깜빡이는 + 버튼을 눌러 시작해 보세요."}
              </p>
            )}
          </div>
        ) : (
          <div className="pt-x6">
            {pinned.length > 0 && (
              <>
                <h2 className="mb-x3 t3-bold text-fg-neutral-muted">고정된 도안</h2>
                <CardGrid items={pinned} onRename={setRenaming} tourFirst />
                <div className="h-x8" />
              </>
            )}
            <CardGrid items={rest} trash={trash} onRename={setRenaming} tourFirst={!pinned.length} />
          </div>
        )}
      </div>

      <RenameDialog entry={renaming} onClose={() => setRenaming(null)} />
      <SpotlightTour open={tour} steps={HOME_TOUR} onClose={closeTour} />
      <NoticesDialog open={dialog === "notices"} openId={noticeId} onOpenId={setNoticeId} onClose={() => closeDialog("notices")} />
      <ContactDialog open={dialog === "contact"} onClose={() => closeDialog("contact")} />
      <PlanDialog open={dialog === "plan"} onClose={() => closeDialog("plan")} onContact={() => setDialog("contact")} />
      <AccountDialog open={dialog === "account"} onClose={() => closeDialog("account")} />
      <HelpChat open={help} onClose={() => setHelp(false)} onAction={onAction} />
    </div>
  );
}

function CardGrid({ items, trash, onRename, tourFirst }: { items: Entry[]; trash?: boolean; onRename: (e: Entry) => void; tourFirst?: boolean }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x5">
      {items.map((w, i) => (
        <WorkCard key={w.id} w={w} trash={trash} onRename={onRename} tour={tourFirst && i === 0} />
      ))}
    </ul>
  );
}

function WorkCard({ w, trash, onRename, tour }: { w: Entry; trash?: boolean; onRename: (e: Entry) => void; tour?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () => !trash && router.push(`/maker/${w.id}`);
  const daysLeft = w.deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - w.deletedAt) / 864e5)) : 0;
  const badge = CRAFT_BADGE[w.craft];

  const items: MenuItem[] = trash
    ? [
        { label: "복원", onSelect: () => (works.restore(w.id), toast("복원했어요.")) },
        {
          label: "영구 삭제",
          danger: true,
          onSelect: () => {
            if (confirm("이 작업은 되돌릴 수 없어요. 영구적으로 삭제할까요?")) {
              works.destroy(w.id);
              toast("영구 삭제했어요");
            }
          },
        },
      ]
    : [
        { label: "열기", onSelect: open },
        { label: "이름 변경", onSelect: () => onRename(w) },
        { label: "복제", onSelect: () => (works.duplicate(w.id), toast("복제했어요")) },
        { label: w.pinned ? "고정 해제" : "고정", onSelect: () => works.update(w.id, { pinned: !w.pinned }) },
        "separator",
        {
          label: "삭제",
          danger: true,
          onSelect: () => {
            works.trash(w.id);
            toast("휴지통으로 옮겼어요", { label: "실행 취소", run: () => works.restore(w.id) });
          },
        },
      ];

  return (
    <li
      className="group relative"
      data-tour={tour ? "home-work-card" : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        setAt({ x: e.clientX, y: e.clientY });
      }}
    >
      <button type="button" onClick={open} disabled={trash} aria-label={w.title} className="block w-full text-left">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-r3 border border-stroke-neutral-muted bg-bg-layer-fill transition-colors group-hover:border-stroke-neutral-weak">
          {w.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.thumbnail} alt="" className="h-full w-full object-contain p-x3" />
          ) : (
            <span className="flex size-x10 items-center justify-center rounded-r2 text-palette-static-white opacity-80" style={{ backgroundColor: badge.color }} aria-hidden="true">
              <badge.Glyph className="size-x5" />
            </span>
          )}
        </div>
      </button>
      <div className="mt-x2_5 flex items-start gap-x1">
        <button type="button" onClick={open} disabled={trash} tabIndex={-1} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-x1_5">
            <span className="flex size-x4 shrink-0 items-center justify-center rounded-r1 text-palette-static-white" style={{ backgroundColor: badge.color }} aria-hidden="true">
              <badge.Glyph className="size-x2_5" />
            </span>
            <span className="truncate t4-bold text-fg-neutral">{w.title}</span>
            {w.pinned && <PinIcon className="size-3.5 shrink-0 text-fg-brand" />}
          </span>
          <span className="mt-x0_5 block t2-regular text-fg-neutral-subtle">
            {CRAFT_LABEL[w.craft]} · {trash ? (daysLeft ? `${daysLeft}일 후 삭제` : "오늘 삭제") : `수정됨 ${timeAgo(w.updatedAt)}`}
          </span>
        </button>
        <Menu
          align="end"
          trigger={({ toggle }) => (
            <button
              type="button"
              aria-label={`${w.title} 메뉴`}
              onClick={toggle}
              className="-mt-x1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-neutral-muted hover:bg-bg-layer-fill"
            >
              <MoreIcon className="size-[18px]" />
            </button>
          )}
          items={items}
        />
      </div>
      <ContextMenu at={at} items={items} onClose={() => setAt(null)} />
    </li>
  );
}

function RenameDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const toast = useToast();
  const [lastId, setLastId] = useState<string | null>(null);
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setValue(entry.title);
  }
  const save = () => {
    if (!entry) return;
    works.update(entry.id, { title: value.trim().slice(0, 60) || "제목 없음", updatedAt: Date.now() });
    toast("이름을 바꿨어요");
    onClose();
  };
  return (
    <Dialog
      open={!!entry}
      onClose={() => (onClose(), setLastId(null))}
      title="이름 변경"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        aria-label="도안 제목"
        className="h-11 w-full rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default px-x3 text-[1rem] outline-none focus:border-stroke-neutral-contrast"
      />
    </Dialog>
  );
}
