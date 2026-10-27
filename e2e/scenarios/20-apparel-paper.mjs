// F01 의류 도안 · F02 페이퍼 — real user flows from the home "새 도안" buttons.
import fs from "node:fs";
import zlib from "node:zlib";

// ---------- helpers ----------

/** Same drafting rule as the editor: cast-on = finished bust / 2 in stitches, rounded to an even number. */
const castOnFor = (bust, ease, sts) => 2 * Math.round(Math.round(((bust + ease) / 2) * (sts / 10)) / 2);
const rowsFor = (cm, rows) => Math.round(cm * (rows / 10));

/** Tiny valid PNG (solid colour) built in memory. */
function png(w, h, rgb = [196, 122, 92]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const backHeader = (t) => t.page.locator('[data-piece="back"] button').first().innerText().then((s) => s.replace(/\s+/g, " ").trim());

/** Types into a SEED scrub field (focus starts edit mode). */
async function scrub(t, label, value) {
  const el = t.page.getByRole("textbox", { name: label, exact: true });
  await el.focus();
  await el.fill(String(value));
  await el.press("Enter");
  await t.sleep(250);
}

async function download(t, trigger) {
  const [dl] = await Promise.all([t.page.waitForEvent("download", { timeout: 10000 }), trigger()]);
  const p = await dl.path();
  return { name: dl.suggestedFilename(), text: fs.readFileSync(p, "utf8") };
}

/** Print media: only the print sheet is shown. */
async function printView(t) {
  await t.page.emulateMedia({ media: "print" });
  await t.sleep(200);
  const r = await t.page.evaluate(() => {
    const sheet = document.querySelector("body > [data-print-sheet]");
    const shell = document.querySelector("[data-editor-shell]");
    return {
      sheetShown: !!sheet && getComputedStyle(sheet).display !== "none",
      shellHidden: !shell || getComputedStyle(shell.closest("body > *")).display === "none",
      text: sheet ? sheet.innerText : "",
    };
  });
  await t.page.emulateMedia({ media: "screen" });
  return r;
}

const seedWork = (t, id, title, craft, withThumb = true) =>
  t.page.evaluate(
    ({ id, title, craft, withThumb }) => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#24365c"/><rect x="15" y="15" width="30" height="30" fill="#c47a5c"/></svg>';
      const idx = JSON.parse(localStorage.getItem("pt:works") || "[]");
      const now = Date.now();
      idx.unshift({ id, title, craft, createdAt: now, updatedAt: now, ...(withThumb ? { thumbnail: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) } : {}) });
      localStorage.setItem("pt:works", JSON.stringify(idx));
      localStorage.setItem(`pt:work:${id}`, JSON.stringify({ grids: [], activeGridId: null, colors: ["#24365c"], gauge: { sts: 22, rows: 30 }, view: { x: 0, y: 0, zoom: 1 } }));
    },
    { id, title, craft, withThumb },
  );

// ---------- scenarios ----------

export const scenarios = [
  {
    id: "F01a",
    feature: "의류 도안",
    name: "의류: 치수·게이지·형태를 바꾸면 코수가 계산대로 바뀌고, 새로고침 후에도 남는다",
    async run(t) {
      const { page } = t;
      await t.create("의류");
      const id = t.idFromUrl();
      await page.waitForSelector("[data-apparel-canvas] svg");
      t.expect((await t.works()).some((w) => w.id === id && w.craft === "apparel" && /^새 의류 도안 \d+$/.test(w.title)), "홈 목록에 '새 의류 도안 N' (craft apparel)");
      t.expect((await backHeader(t)) === `뒤판 ${castOnFor(88, 10, 22)}코 · ${rowsFor(60, 30)}단`, `기본 M·레귤러: 뒤판 ${castOnFor(88, 10, 22)}코 · 180단`);
      t.expect((await page.locator("[data-piece]").count()) === 3, "피스 3개 (뒤판·앞판·소매)");

      // measurements
      await t.byLabel("치수").click();
      await scrub(t, "가슴둘레", 90);
      await scrub(t, "옷길이", 64);
      t.expect((await backHeader(t)) === `뒤판 ${castOnFor(90, 10, 22)}코 · ${rowsFor(64, 30)}단`, `가슴 90·길이 64 → 뒤판 ${castOnFor(90, 10, 22)}코 · ${rowsFor(64, 30)}단`);
      t.expect(await t.has(/가슴둘레\s*100cm/), "완성 가슴둘레 100cm (90 + 여유 10)");

      // fit changes the ease
      await page.getByRole("radio", { name: "오버" }).click();
      await t.sleep(200);
      t.expect((await backHeader(t)).startsWith(`뒤판 ${castOnFor(90, 24, 22)}코`), `오버 핏(여유 24) → ${castOnFor(90, 24, 22)}코`);
      await page.getByRole("radio", { name: "레귤러" }).click();

      // gauge
      await t.byLabel("게이지").click();
      await scrub(t, "게이지 코", 20);
      await scrub(t, "게이지 단", 28);
      t.expect((await backHeader(t)) === `뒤판 ${castOnFor(90, 10, 20)}코 · ${rowsFor(64, 28)}단`, `게이지 20×28 → 뒤판 ${castOnFor(90, 10, 20)}코 · ${rowsFor(64, 28)}단`);
      // edge: a non-number is ignored
      await scrub(t, "게이지 코", "abc");
      t.expect((await t.page.getByRole("textbox", { name: "게이지 코", exact: true }).inputValue()) === "20", "게이지에 'abc' 입력은 무시 (20 유지)");
      // swatch: 30 sts over 15 cm = 20 / 10 cm
      await t.click("스와치로 재기");
      await scrub(t, "스와치 코수", 33);
      await scrub(t, "스와치 가로", 15);
      t.expect(await t.has(/10cm = 22코 ×/), "스와치 33코/15cm → 10cm = 22코");
      await page.getByRole("button", { name: "스와치 지우기" }).click();
      t.expect((await backHeader(t)).startsWith(`뒤판 ${castOnFor(90, 10, 20)}코`), "스와치 지우기는 게이지를 바꾸지 않음");

      // style
      await page.getByRole("radio", { name: "베스트" }).first().click();
      await t.sleep(200);
      t.expect((await page.locator('[data-piece="sleeve"]').count()) === 0, "베스트: 소매 피스 없음");
      t.expect(await t.has(/진동 둘레 [\d.]+cm: 한쪽에 \d+코 줍기/), "베스트: 진동 고무단 줍는 코수 표시");
      await page.keyboard.press("Control+z");
      await t.sleep(200);
      t.expect((await page.locator('[data-piece="sleeve"]').count()) === 1, "Ctrl+Z → 소매가 돌아옴 (셋인)");
      await page.getByRole("radio", { name: "래글런" }).first().click();
      await t.sleep(200);
      t.expect(await t.has(/래글런선/), "래글런: 래글런선 줄임 단계");
      const dimHits = await page.evaluate(() => {
        const svg = [...document.querySelectorAll("svg")].find((s) => s.querySelector(".ap-dim"));
        const r = [...(svg?.querySelectorAll(".ap-dim text") ?? [])].map((e) => [e.textContent, e.getBoundingClientRect()]);
        const hits = [];
        for (let i = 0; i < r.length; i++)
          for (let j = i + 1; j < r.length; j++) {
            const [a, b] = [r[i][1], r[j][1]];
            if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) hits.push(`${r[i][0]} / ${r[j][0]}`);
          }
        return { n: r.length, hits };
      });
      t.expect(dimHits.n > 0 && dimHits.hits.length === 0, `래글런: 치수 글자끼리 겹치지 않음 (${dimHits.hits.join(", ") || `${dimHits.n}개`})`);

      // shaping steps show the 2-1-3 notation and add up
      const steps = await page.locator('[data-piece="back"] ol li').allInnerTexts();
      t.expect(steps.some((s) => /\d+단마다 \d+코씩 \d+번 줄이기/.test(s)), "줄임 단계 문장 (N단마다 N코씩 N번 줄이기)");
      await t.shot("raglan");

      await t.sleep(1200); // autosave
      const saved = await t.work(id);
      t.expect(saved?.style === "raglan" && saved?.gauge?.sts === 20 && saved?.measure?.bust === 90, "저장된 문서: raglan · 게이지 20 · 가슴 90");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-apparel-canvas] svg");
      await t.sleep(500);
      t.expect((await backHeader(t)) === `뒤판 ${castOnFor(90, 10, 20)}코 · ${rowsFor(64, 28)}단`, "새로고침 후 같은 코수·단수");
      t.expect((await page.getByRole("radio", { name: "래글런" }).first().getAttribute("aria-checked")) === "true", "새로고침 후 래글런 유지");
    },
  },
  {
    id: "F01b",
    feature: "의류 도안",
    name: "의류: SVG·TXT 내보내기, 인쇄 화면, 서술도안",
    async run(t) {
      const { page } = t;
      await t.create("의류");
      await page.waitForSelector("[data-apparel-canvas] svg");
      const co = castOnFor(88, 10, 22);

      await t.click("서술도안");
      const written = await page.locator("[data-apparel-written]").innerText();
      t.expect(written.includes(`■ 뒤판  (시작 ${co}코 · 총 180단)`) && written.includes("■ 소매 ×2") && /목둘레 [\d.]+cm: \d+코 줍기/.test(written), "서술도안: 피스별 시작 코·총 단수·목둘레 줍기");
      await t.click("서술도안");

      await t.byLabel("내보내기").click();
      await page.getByRole("radio", { name: "SVG" }).click();
      const svg = await download(t, () => page.getByRole("button", { name: "내보내기", exact: true }).last().click());
      t.expect(svg.name.endsWith(".svg") && svg.text.startsWith("<svg") && svg.text.includes("뒤판") && svg.text.includes(`${co}코`), `SVG 다운로드: 뒤판·${co}코 포함`);

      await t.byLabel("내보내기").click();
      await page.getByRole("radio", { name: "서술 (TXT)" }).click();
      const txt = await download(t, () => page.getByRole("button", { name: "내보내기", exact: true }).last().click());
      t.expect(txt.name.endsWith(".txt") && txt.text.includes(`${co}코 잡기`) && txt.text.includes("게이지 10cm = 22코 × 30단"), "TXT 다운로드: 코 잡기·게이지");

      // edge: cancel closes without a download
      await t.byLabel("내보내기").click();
      let got = false;
      const onDl = () => (got = true);
      page.on("download", onDl);
      await page.getByRole("button", { name: "취소", exact: true }).click();
      await t.sleep(500);
      page.off("download", onDl);
      t.expect(!got && !(await page.locator("dialog[open]").count()), "취소: 다운로드 없이 닫힘");

      const pr = await printView(t);
      t.expect(pr.sheetShown && pr.shellHidden, "인쇄: 편집 화면은 숨기고 인쇄 시트만 보임");
      t.expect(pr.text.includes("피스") && pr.text.includes(`${co}코`) && pr.text.includes("■ 앞판"), "인쇄 시트: 코수 표 + 서술도안");
    },
  },
  {
    id: "F01c",
    feature: "의류 도안",
    name: "의류: 홈 탭·휴지통 이동·복원",
    async run(t) {
      const { page } = t;
      await t.create("의류");
      await t.goto("/home?tab=apparel");
      t.expect(await t.has(/의류 도안 \(beta\)/), "의류 탭 제목");
      const cards = page.locator("ul li.group");
      t.expect((await cards.count()) === 1 && /의류 · 수정됨/.test(await cards.first().innerText()), "의류 탭에 카드 1개 (의류 · 수정됨)");
      await page.getByRole("button", { name: /새 의류 도안 1 메뉴/ }).click();
      await page.getByRole("menuitem", { name: "삭제" }).click();
      await t.sleep(300);
      t.expect((await cards.count()) === 0 && (await t.has(/아직 의류 도안이 없어요/)), "삭제 후 빈 상태 '아직 의류 도안이 없어요.'");
      await t.goto("/home?tab=trash");
      t.expect(/30일 후 삭제/.test(await cards.first().innerText()), "휴지통: 30일 후 삭제");
      await page.getByRole("button", { name: /새 의류 도안 1 메뉴/ }).click();
      await page.getByRole("menuitem", { name: "복원" }).click();
      await t.goto("/home?tab=apparel");
      t.expect((await cards.count()) === 1, "복원 후 의류 탭에 다시 보임");
      await cards.first().locator("button").first().click();
      await page.waitForURL(/\/maker\//);
      await page.waitForSelector("[data-apparel-canvas] svg");
      t.expect(await t.has(/코수 계산/), "카드를 누르면 의류 편집기가 열림");
    },
  },
  {
    id: "F02a",
    feature: "페이퍼",
    name: "페이퍼: 모든 블록 넣기 → 순서·삭제 → 되돌리기 → 새로고침 유지",
    async run(t) {
      const { page } = t;
      await t.goto("/home");
      await seedWork(t, "e2eknit", "체크 무늬", "knitting");
      await t.create("페이퍼");
      const id = t.idFromUrl();
      await page.waitForSelector("[data-paper-page]");
      t.expect((await t.works()).some((w) => w.id === id && w.craft === "paper"), "홈 목록에 페이퍼 (craft paper)");

      await page.getByRole("textbox", { name: "본문" }).first().click();
      await page.keyboard.type("여름 탑 도안이에요.");
      await t.click("제목 1", { exact: true });
      await page.keyboard.type("준비물");
      await t.click("글머리 기호", { exact: true });
      await page.keyboard.type("면사 4볼");
      await page.keyboard.press("Enter");
      await page.keyboard.type("4mm 대바늘");
      await page.keyboard.press("Enter");
      await page.keyboard.type("돗바늘");
      await t.click("표", { exact: true });
      await page.getByRole("textbox", { name: "2행 1열" }).click();
      await page.keyboard.type("1–10");
      await page.getByRole("textbox", { name: "2행 2열" }).click();
      await page.keyboard.type("96");
      await page.getByRole("button", { name: "머리글 강조" }).click();
      await page.getByRole("radio", { name: "파선" }).click();
      await page.getByRole("button", { name: "아래에 행 추가" }).click();
      t.expect(await t.has(/4×3칸/), "표: 행 추가 후 4×3칸");
      await t.click("구분선", { exact: true });
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), t.click("이미지", { exact: true })]);
      await chooser.setFiles({ name: "swatch.png", mimeType: "image/png", buffer: png(40, 30) });
      await page.waitForSelector('[data-block-type="image"] img');
      await t.byLabel("내 도안").click();
      await page.getByRole("button", { name: /체크 무늬/ }).click();
      await page.waitForSelector('[data-block-type="embed"] img');

      const order = () => page.$$eval("[data-block-type]", (els) => els.map((e) => e.getAttribute("data-block-type")).join(","));
      t.expect((await order()) === "paragraph,heading,list,table,divider,image,embed", "블록 순서: 본문·제목·목록·표·구분선·이미지·도안");
      t.expect((await page.locator('[data-block-type="list"] li').count()) === 3, "목록 3개 항목 (Enter로 추가)");
      const th = await page.locator('[data-block-type="table"] th').first().evaluate((e) => getComputedStyle(e).borderBottomStyle);
      t.expect(th === "dashed", "표 머리글 아래 선이 파선");
      await t.shot("filled");

      const embed = page.locator('[data-block-type="embed"]');
      await embed.hover();
      await embed.getByRole("button", { name: "위로" }).click();
      t.expect((await order()) === "paragraph,heading,list,table,divider,embed,image", "도안 블록을 위로 이동");
      const div = page.locator('[data-block-type="divider"]');
      await div.hover();
      await div.getByRole("button", { name: "삭제" }).click();
      t.expect((await order()) === "paragraph,heading,list,table,embed,image", "구분선 삭제");
      await page.keyboard.press("Control+z");
      t.expect((await order()) === "paragraph,heading,list,table,divider,embed,image", "Ctrl+Z로 구분선 복구");
      await page.keyboard.press("Control+Shift+z");
      t.expect((await order()) === "paragraph,heading,list,table,embed,image", "Ctrl+Shift+Z로 다시 삭제");

      await t.sleep(1200);
      const saved = await t.work(id);
      const types = saved?.blocks?.map((b) => b.type).join(",");
      t.expect(types === "paragraph,heading,list,table,embed,image", `저장된 블록 ${types}`);
      t.expect(saved?.blocks?.find((b) => b.type === "table")?.preset === "header" && saved.blocks.find((b) => b.type === "image")?.src?.startsWith("data:image/png"), "표 preset=header, 이미지는 data URL");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-paper-page]");
      await t.sleep(500);
      t.expect((await order()) === "paragraph,heading,list,table,embed,image", "새로고침 후 같은 블록 순서");
      const vals = await page.$$eval("textarea.pp-input", (els) => els.map((e) => e.value));
      t.expect(["여름 탑 도안이에요.", "준비물", "면사 4볼", "4mm 대바늘", "돗바늘", "1–10", "96"].every((v) => vals.includes(v)), "새로고침 후 입력한 글이 그대로");
    },
  },
  {
    id: "F02b",
    feature: "페이퍼",
    name: "페이퍼: HTML 내보내기·인쇄, 빈 도안 목록과 큰 이미지 거절",
    async run(t) {
      const { page } = t;
      await t.create("페이퍼");
      await page.waitForSelector("[data-paper-page]");
      // edge: nothing to embed yet
      await t.byLabel("내 도안").click();
      t.expect(await t.has(/삽입할 도안이 없어요/), "도안이 없으면 '삽입할 도안이 없어요.'");
      // edge: too-large and non-image files are refused
      await t.byLabel("컴포넌트").click();
      let [chooser] = await Promise.all([page.waitForEvent("filechooser"), t.click("이미지", { exact: true })]);
      await chooser.setFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(6 * 1024 * 1024, 1) });
      await t.sleep(300);
      t.expect((await t.has(/5MB 이하 이미지만 올릴 수 있어요/)) && (await page.locator('[data-block-type="image"]').count()) === 0, "6MB 이미지는 거절 (블록 안 생김)");
      [chooser] = await Promise.all([page.waitForEvent("filechooser"), t.click("이미지", { exact: true })]);
      await chooser.setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
      await t.sleep(300);
      t.expect((await page.locator('[data-block-type="image"]').count()) === 0, "텍스트 파일은 이미지로 안 들어감");

      await page.getByRole("textbox", { name: "본문" }).first().click();
      await page.keyboard.type("게이지는 10cm에 22코예요.");
      await t.click("제목 2", { exact: true });
      await page.keyboard.type("단별 설명");
      await t.click("표", { exact: true });
      await page.getByRole("textbox", { name: "2행 3열" }).click();
      await page.keyboard.type("1코 고무뜨기");
      await page.getByRole("button", { name: "바깥 굵게" }).click();
      [chooser] = await Promise.all([page.waitForEvent("filechooser"), t.click("이미지", { exact: true })]);
      await chooser.setFiles({ name: "photo.png", mimeType: "image/png", buffer: png(24, 24) });
      await page.waitForSelector('[data-block-type="image"] img');

      await t.byLabel("내보내기").click();
      const html = await download(t, () => page.getByRole("button", { name: "HTML로 저장" }).click());
      t.expect(html.name.endsWith(".html") && html.text.startsWith("<!doctype html>"), "HTML 파일 다운로드");
      t.expect(html.text.includes("게이지는 10cm에 22코예요.") && html.text.includes("단별 설명") && html.text.includes("1코 고무뜨기"), "HTML에 입력한 글 포함");
      t.expect(/<table class="pp-table">/.test(html.text) && /border-left:2px solid/.test(html.text) && /<img src="data:image\/png/.test(html.text), "HTML: 바깥 굵게 표 + 이미지 data URL");
      const p2 = await t.ctx.newPage();
      await p2.setContent(html.text);
      t.expect((await p2.locator("table td, table th").count()) === 9 && (await p2.locator("h3.pp-h2").innerText()) === "단별 설명", "내보낸 HTML을 열면 표 9칸·제목이 보임");
      await p2.close();

      const pr = await printView(t);
      t.expect(pr.sheetShown && pr.shellHidden, "인쇄: 편집 화면은 숨기고 문서만 보임");
      t.expect(pr.text.includes("단별 설명") && pr.text.includes("1코 고무뜨기") && !pr.text.includes("컴포넌트"), "인쇄 시트에 문서 내용만");
    },
  },
];
