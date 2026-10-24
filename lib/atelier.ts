"use client";

// Local atelier ("아뜰리에"): works the user published, kept only in this browser.
// Nothing is uploaded; other people never see these entries.
import { uid } from "./id";
import { createLocalList } from "./localList";
import { works } from "./store";
import type { Craft, Work, WorkData } from "./types";

/** AtelierTaxonomy keys (labels below). */
export const TAXONOMY = {
  category: {
    top: "상의",
    cardigan_outer: "가디건·아우터",
    dress_bottom: "원피스·하의",
    vest: "조끼",
    hat: "모자",
    scarf_shawl: "목도리·숄",
    gloves_socks: "장갑·양말",
    bag: "가방",
    accessory_etc: "소품·액세서리",
    home_living: "홈·리빙",
    doll: "인형·아미구루미",
    baby_kids: "베이비·키즈",
    pet: "반려동물",
    motif_technique: "모티브·기법",
  },
  difficulty: { beginner: "입문", easy: "쉬움", intermediate: "중급", advanced: "고급" },
  yarnWeight: {
    lace: "레이스 (극세사)",
    fingering: "핑거링 (세사)",
    sport: "스포츠",
    dk: "DK (합태사)",
    worsted: "워스티드 (중태사)",
    aran: "아란",
    bulky: "벌키 (극태사)",
    super_bulky: "슈퍼 벌키",
  },
  license: { personal: "개인 제작만", small_batch: "소량 판매 허용", commercial: "상업 이용 허용" },
  licenseDesc: {
    personal: "도안으로 만든 작품은 개인 소장·선물용으로만 쓸 수 있어요.",
    small_batch: "작가 표기 시 완성작을 소량(핸드메이드 마켓 등) 판매할 수 있어요.",
    commercial: "완성작 판매와 상업적 이용이 가능해요. 도안 재배포는 불가예요.",
  },
  technique: {
    top_down: "탑다운",
    bottom_up: "바텀업",
    in_the_round: "원통뜨기",
    flat: "평면뜨기",
    seamless: "심리스",
    colorwork: "배색",
    cables: "케이블",
    lace: "레이스 무늬",
    texture: "텍스처 무늬",
    motif_join: "모티브 잇기",
    amigurumi: "아미구루미",
    tapestry: "태피스트리",
  },
} as const;

export type Category = keyof typeof TAXONOMY.category;
export type Difficulty = keyof typeof TAXONOMY.difficulty;
export type YarnWeight = keyof typeof TAXONOMY.yarnWeight;
export type License = keyof typeof TAXONOMY.license;
export type Technique = keyof typeof TAXONOMY.technique;

export type AtelierMeta = {
  category?: Category;
  difficulty?: Difficulty;
  yarnWeight?: YarnWeight;
  license: License;
  techniques: Technique[];
};

export type AtelierEntry = {
  id: string;
  title: string;
  description: string;
  craft: Craft;
  meta: AtelierMeta;
  /** data URL thumbnail */
  thumbnail: string;
  data: WorkData;
  author: string;
  /** the work it was published from (if it still exists) */
  sourceId?: string;
  publishedAt: number;
};

const list = createLocalList<AtelierEntry>("pt:atelier", 200);

/** Tag labels shown on cards (AtelierTaxonomy strings). */
export function tagsOf(m: AtelierMeta): string[] {
  return [
    m.category && TAXONOMY.category[m.category],
    m.difficulty && TAXONOMY.difficulty[m.difficulty],
    m.yarnWeight && TAXONOMY.yarnWeight[m.yarnWeight],
    ...m.techniques.map((t) => TAXONOMY.technique[t]),
  ].filter((s): s is NonNullable<typeof s> => !!s);
}

export const atelier = {
  list: list.read,
  get: (id: string) => list.read().find((e) => e.id === id) ?? null,
  /** Publishes a snapshot. Returns null when storage is full. */
  publish(e: Omit<AtelierEntry, "id" | "publishedAt">): AtelierEntry | null {
    const entry: AtelierEntry = { ...e, data: structuredClone(e.data), id: uid(), publishedAt: Date.now() };
    const before = list.read();
    if (list.write([entry, ...before])) return entry;
    list.write(before);
    return null;
  },
  remove: (id: string) => list.write(list.read().filter((e) => e.id !== id)),
  /** "내 도안으로 가져오기": copies the snapshot into works. */
  importToWorks(id: string): Work | null {
    const e = atelier.get(id);
    if (!e) return null;
    const w = works.create(e.craft, e.title, structuredClone(e.data));
    works.update(w.id, { thumbnail: e.thumbnail });
    return w;
  },
};

export const useAtelier = list.useList;
