// Knitting editor (원문·파일로 만들기, AI 어시스턴트, 실체화, 내 기호, 버전 기록, 폴더) and the colour-chart preview.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const K = null; // a knit square is stored as an empty cell
const sym = (c) => c?.symbol ?? null;
const rowOf = (g, r) => g.cells.slice(r * g.cols, (r + 1) * g.cols).map(sym);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** new knitting work through the home button; the editor seeds one 20 × 20 grid */
async function newKnit(t) {
  await t.create("대바늘");
  await t.page.locator('[aria-label="격자"]').first().waitFor({ timeout: 8000 });
  return t.idFromUrl();
}
const saved = async (t, id, wait = 1100) => {
  await t.sleep(wait);
  return (await t.work(id)) ?? {};
};
const reload = async (t) => {
  await t.page.reload({ waitUntil: "domcontentloaded" });
  await t.sleep(2200);
};
/** clicks the centre of cell (c, r) of the n-th grid on the canvas */
async function clickCell(t, c, r, cols, rows, n = 0) {
  const b = await t.page.locator('[aria-label="격자"]').nth(n).boundingBox();
  await t.page.mouse.click(b.x + ((c + 0.5) * b.width) / cols, b.y + ((r + 0.5) * b.height) / rows);
  await t.sleep(250);
}
const railBtn = (t, label) => t.page.locator(`nav [aria-label="${label}"]`).first();
/** non-backdrop pixels of the knitted-look canvas, plus a cheap fingerprint */
const fabricPixels = (t) =>
  t.page.evaluate(() => {
    const cv = document.querySelector("[data-knit-preview] canvas");
    if (!cv || !cv.width) return { count: 0, total: 0, sig: "" };
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let count = 0;
    let sig = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - 0xe7) + Math.abs(d[i + 1] - 0xe4) + Math.abs(d[i + 2] - 0xde) > 30) count++;
      if (i % 4000 === 0) sig = (sig * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1e9;
    }
    return { count, total: d.length / 4, sig: String(sig) };
  });

async function say(t, text) {
  const box = t.page.getByLabel("어시스턴트에게 보낼 말");
  await box.fill(text);
  await box.press("Enter");
  await t.sleep(350);
}
const lastReply = (t) => t.page.evaluate(() => [...document.querySelectorAll('[data-assistant-panel] li div')].map((d) => d.innerText).pop() ?? "");

export const scenarios = [
  // ---------------- F20 원문·파일로 만들기 ----------------
  {
    id: "F20a",
    feature: "대바늘 원문·파일로 만들기",
    name: "한국어 서술 → 미리보기 줄별 코 수 → 정확한 칸의 새 격자, 되돌리기, 새로고침",
    async run(t) {
      const id = await newKnit(t);
      await railBtn(t, "원문·파일로 만들기").click();
      await t.sleep(400);
      t.expect(await t.has(/서버 없이 브라우저에서 규칙으로 변환해요/), "첫 화면에 로컬 규칙 변환 안내");
      await t.page.getByLabel("서술형 텍스트").fill("12코 만들기\n1단: 겉뜨기 2, 안뜨기 2 반복\n2단: 코 모양대로 뜨기\n3단: (겉1, 안1)×6\n4단: 안뜨기");
      await t.sleep(300);
      const list = t.page.getByLabel("줄별 변환 결과");
      t.expect((await list.innerText()).includes("4단 · 안면"), "4단은 안면 단으로 읽음");
      t.expect((await list.locator("li").count()) === 5, "줄 5개가 결과 목록에 있음");
      t.expect(await t.has(/4단 × 12코/), "합계 4단 × 12코");
      await t.shot("preview");
      await t.click("격자 만들기", { exact: true, wait: 600 });
      t.expect(await t.has(/4단 × 12코 격자를 만들었어요/), "만들기 토스트");
      const doc = await saved(t, id);
      const g = doc.grids?.[doc.grids.length - 1];
      t.expect(doc.grids?.length === 2 && g?.cols === 12 && g?.rows === 4 && g?.name === "가져온 도안", "새 격자 12코 × 4단 「가져온 도안」");
      const P = "k_purl";
      // row 1 (bottom) is worked right → left: k2 p2 from the right edge
      t.expect(same(rowOf(g, 3), [P, P, K, K, P, P, K, K, P, P, K, K]), "1단 칸: 오른쪽부터 겉2 안2");
      t.expect(same(rowOf(g, 2), rowOf(g, 3)), "2단 「코 모양대로」 = 1단과 같은 모양");
      t.expect(same(rowOf(g, 1), [P, K, P, K, P, K, P, K, P, K, P, K]), "3단 칸: (겉1, 안1)×6");
      t.expect(same(rowOf(g, 0), Array(12).fill(K)), "4단 안면의 안뜨기 = 차트에선 겉뜨기 칸");
      t.expect(g?.sides?.worked === "flat" && g?.sides?.firstRowSide === "RS", "평면 · 1단 겉면 설정이 격자에 저장");
      await t.page.keyboard.press("Meta+z");
      t.expect((await saved(t, id)).grids?.length === 1, "되돌리기로 가져온 격자 제거");
      await t.page.keyboard.press("Meta+Shift+z");
      t.expect((await saved(t, id)).grids?.length === 2, "다시 실행으로 복구");
      await reload(t);
      t.expect((await t.page.locator('[aria-label="격자"]').count()) === 2, "새로고침 뒤에도 격자 2개");
    },
  },
  {
    id: "F20b",
    feature: "대바늘 원문·파일로 만들기",
    name: "영어 .txt 올리기 → 모르는 용어 오류 줄 → 기호 지정 → 정확한 칸",
    async run(t) {
      const id = await newKnit(t);
      const file = path.join(os.tmpdir(), "pattern.txt");
      fs.writeFileSync(file, "Cast on 8 sts\nRow 1 (RS): k2, p2; rep to end\nRow 2 and all WS rows: purl\nRow 3: k1, yo, k2tog, p2, frob, k2\n");
      await railBtn(t, "원문·파일로 만들기").click();
      await t.sleep(300);
      await t.page.locator('input[type=file][accept*=".txt"]').setInputFiles(file);
      await t.sleep(500);
      t.expect((await t.page.getByLabel("서술형 텍스트").inputValue()).startsWith("Cast on 8 sts"), "파일 내용이 입력칸에 들어감");
      t.expect(await t.has(/pattern\.txt/), "파일 이름 표시");
      t.expect(await t.has(/인식하지 못한 용어: frob/), "모르는 용어 줄 오류");
      t.expect(await t.has(/읽지 못한 줄 1개/), "읽지 못한 줄 1개 요약");
      await t.shot("unknown");
      await t.page.getByLabel("frob 기호 지정").selectOption("k_purl");
      await t.sleep(300);
      t.expect(!(await t.has(/인식하지 못한 용어/)), "기호를 지정하면 오류가 사라짐");
      t.expect(await t.has(/3단 × 8코/), "합계 3단 × 8코");
      await t.click("격자 만들기", { exact: true, wait: 600 });
      const doc = await saved(t, id);
      const g = doc.grids?.[doc.grids.length - 1];
      t.expect(g?.cols === 8 && g?.rows === 3 && g?.name === "pattern", "새 격자 8코 × 3단, 이름은 파일 이름");
      const P = "k_purl";
      t.expect(same(rowOf(g, 2), [P, P, K, K, P, P, K, K]), "Row 1: k2, p2 반복 (오른쪽부터)");
      t.expect(same(rowOf(g, 1), Array(8).fill(K)), "Row 2 (WS purl) = 겉뜨기 칸");
      t.expect(same(rowOf(g, 0), [K, K, P, P, P, "k_k2tog", "k_yo", K]), "Row 3: k1, yo, k2tog, p2, frob(=안뜨기), k2");
    },
  },
  {
    id: "F20d",
    feature: "대바늘 원문·파일로 만들기",
    name: "한국어 단 반복 표현 (3~4단: 1~2단 반복, 1단과 같이, 1-2단을 반복, 1단과 2단 반복)",
    async run(t) {
      const id = await newKnit(t);
      await railBtn(t, "원문·파일로 만들기").click();
      await t.sleep(300);
      await t.page
        .getByLabel("서술형 텍스트")
        .fill("8코 만들기\n1단: 겉2, 안2 반복\n2단: 안뜨기\n3~4단: 1~2단 반복\n5단: 1단과 같이\n6단: 2단과 같이\n1-2단을 반복\n1단과 2단 반복");
      await t.sleep(300);
      const list = await t.page.getByLabel("줄별 변환 결과").innerText();
      t.expect(!list.includes("읽지 못함") && !list.includes("인식하지 못한 용어"), "단 반복 줄을 모두 읽음");
      t.expect(list.includes("3–4단 = 1–2단") && list.includes("5단 = 1단") && list.includes("6단 = 2단"), "「N단: M단 반복/같이」 표시");
      t.expect((list.match(/1–2단 1번 더/g) ?? []).length === 2, "「1-2단을 반복」「1단과 2단 반복」 = 1–2단 한 번 더");
      t.expect(await t.has(/10단 × 8코/), "합계 10단 × 8코");
      await t.shot("repeats");
      await t.click("격자 만들기", { exact: true, wait: 600 });
      const g = (await saved(t, id)).grids.at(-1);
      const P = "k_purl";
      const rib = [P, P, K, K, P, P, K, K];
      const ok = Array.from({ length: 10 }, (_, i) => same(rowOf(g, 9 - i), i % 2 === 0 ? rib : Array(8).fill(K))).every(Boolean);
      t.expect(g.rows === 10 && g.cols === 8 && ok, "홀수단은 겉2 안2, 짝수단(안면 안뜨기)은 겉뜨기 칸 — 10단 모두");
    },
  },
  {
    id: "F20e",
    feature: "대바늘 원문·파일로 만들기",
    name: "아직 없는 단을 반복하라고 하면 그 줄에 이유를 보여 준다",
    async run(t) {
      await newKnit(t);
      await railBtn(t, "원문·파일로 만들기").click();
      await t.sleep(300);
      await t.page.getByLabel("서술형 텍스트").fill("1단: 겉뜨기 6\n2단: 5단과 같이");
      await t.sleep(300);
      t.expect(await t.has(/5단은 이 단보다 앞에 있어야 반복할 수 있어요/), "앞에 없는 단 반복 → 이유 표시");
      t.expect(await t.has(/1단 × 6코/), "읽을 수 있는 1단만 격자로");
    },
  },
  {
    id: "F20c",
    feature: "대바늘 원문·파일로 만들기",
    name: "빈 입력은 만들 수 없고, 취소하면 격자가 안 생긴다",
    async run(t) {
      const id = await newKnit(t);
      await railBtn(t, "원문·파일로 만들기").click();
      await t.sleep(300);
      t.expect(await t.has(/변환할 내용이 없어요/), "빈 상태 안내");
      t.expect(await t.page.getByRole("button", { name: "격자 만들기", exact: true }).isDisabled(), "빈 입력이면 「격자 만들기」 비활성");
      await t.page.getByLabel("서술형 텍스트").fill("1단: 겉뜨기 10");
      await t.click("취소", { exact: true });
      t.expect((await saved(t, id)).grids?.length === 1, "취소하면 격자 수 그대로 1개");
    },
  },

  // ---------------- F21 AI 어시스턴트 ----------------
  {
    id: "F21a",
    feature: "AI 어시스턴트",
    name: "명령마다 문서가 정확히 바뀌고, 모르는 말엔 할 수 있는 일, 되돌리기, 새로고침",
    async run(t) {
      const id = await newKnit(t);
      await railBtn(t, "AI 어시스턴트").click();
      await t.sleep(300);
      t.expect(await t.has(/서버 없이 브라우저에서 규칙으로 해석해요/), "로컬 규칙 기반 안내");
      t.expect(await t.has(/규칙 기반 · 로컬/), "규칙 기반 · 로컬 배지");

      await say(t, "아래 4단은 2코 고무뜨기");
      t.expect((await lastReply(t)).includes("1–4단을(를) 2코 고무뜨기(으)로 채웠어요 · 4단, 40칸을 바꿨어요"), "고무뜨기 답: 4단, 40칸");
      let g = (await saved(t, id)).grids[0];
      const rib = Array.from({ length: 20 }, (_, c) => ((20 - c - 1) % 4 < 2 ? K : "k_purl"));
      t.expect([16, 17, 18, 19].every((r) => same(rowOf(g, r), rib)), "아래 4단이 2코 고무 (1번째 코부터 겉2 안2)");
      t.expect(same(rowOf(g, 15), Array(20).fill(K)), "5단은 그대로");

      await say(t, "3단 지우기");
      t.expect((await lastReply(t)).includes("3단을(를) 지웠어요 (10칸)"), "3단 지우기 답: 10칸");
      g = (await saved(t, id)).grids[0];
      t.expect(same(rowOf(g, 17), Array(20).fill(K)) && same(rowOf(g, 18), rib), "3단만 비워짐");

      await say(t, "1~2코 빨간색으로 칠해");
      g = (await saved(t, id)).grids[0];
      const red = g.cells.filter((c) => c?.color === "#d64545").length;
      t.expect(red === 40 && g.cells[19]?.color === "#d64545" && g.cells[18]?.color === "#d64545" && !g.cells[17]?.color, "1~2코(오른쪽 두 열) 40칸이 빨강");

      await say(t, "코 수 세어줘");
      const count = await lastReply(t);
      t.expect(count.includes("20코 × 20단, 400칸") && count.includes("안뜨기 30"), "세기 답: 20코 × 20단, 안뜨기 30");

      await say(t, "오늘 날씨 어때");
      t.expect((await lastReply(t)).startsWith("이 요청은 아직 이해하지 못했어요"), "모르는 말 → 이해 못 함 안내");
      t.expect((await lastReply(t)).includes("격자 만들기 · 「10코 20단 격자 추가」"), "할 수 있는 일 목록");

      await say(t, "10코 6단 격자 추가");
      let doc = await saved(t, id);
      t.expect(doc.grids.length === 2 && doc.grids[1].cols === 10 && doc.grids[1].rows === 6, "10코 6단 격자 추가");
      await t.shot("chat");
      await t.click("되돌리기", { exact: true });
      t.expect((await saved(t, id)).grids.length === 1, "답의 「되돌리기」로 추가 취소");
      await say(t, "되돌려");
      g = (await saved(t, id)).grids[0];
      t.expect(g.cells.every((c) => !c?.color), "「되돌려」로 색칠 취소");
      await reload(t);
      g = (await t.work(id)).grids[0];
      t.expect(same(rowOf(g, 19), rib) && same(rowOf(g, 17), Array(20).fill(K)), "새로고침 뒤에도 고무뜨기·지운 단 유지");
    },
  },
  {
    id: "F21b",
    feature: "AI 어시스턴트",
    name: "선택 영역만 채우기, 범위 밖 단 번호 오류",
    async run(t) {
      const id = await newKnit(t);
      await clickCell(t, 0, 0, 20, 20);
      // drag a 3 × 2 selection
      const b = await t.page.locator('[aria-label="격자"]').first().boundingBox();
      const at = (c, r) => ({ x: b.x + ((c + 0.5) * b.width) / 20, y: b.y + ((r + 0.5) * b.height) / 20 });
      await t.page.mouse.move(at(2, 2).x, at(2, 2).y);
      await t.page.mouse.down();
      await t.page.mouse.move(at(4, 3).x, at(4, 3).y, { steps: 4 });
      await t.page.mouse.up();
      await railBtn(t, "AI 어시스턴트").click();
      await t.sleep(300);
      t.expect(await t.has(/선택 영역만 편집해요 · 단 17–18, 코 16–18/), "선택 배너에 도안 번호");
      await say(t, "선택 영역 바늘비우기로 채워");
      t.expect((await lastReply(t)).includes("선택 영역을(를) 바늘비우기(으)로 채웠어요 · 2단, 6칸을 바꿨어요"), "선택 영역 6칸");
      const g = (await saved(t, id)).grids[0];
      t.expect(g.cells.filter((c) => c?.symbol === "k_yo").length === 6 && g.cells[2 * 20 + 2]?.symbol === "k_yo" && g.cells[3 * 20 + 4]?.symbol === "k_yo", "선택한 6칸만 바늘비우기");
      await say(t, "25단 안뜨기로 채워");
      t.expect((await lastReply(t)).includes("1–20단이에요"), "없는 단 번호는 범위를 알려 줌");
    },
  },

  // ---------------- F22 실체화 ----------------
  {
    id: "F22a",
    feature: "실체화 (β)",
    name: "열면 편물 픽셀이 그려지고 겉면/안면·2D/3D가 바뀌며 PNG로 저장된다",
    async run(t) {
      await newKnit(t);
      await railBtn(t, "실체화 (β)").click();
      await t.sleep(900);
      t.expect((await railBtn(t, "실체화 (β)").getAttribute("aria-pressed")) === "true", "레일 버튼 눌림 상태");
      const a = await fabricPixels(t);
      t.expect(a.count > a.total * 0.2, `편물 픽셀이 그려짐 (${a.count}/${a.total})`);
      t.expect(await t.has(/20코 × 20단 · 예상 완성 크기 약 9\.1 × 6\.7cm/), "크기 요약 (게이지 22×30)");
      await t.shot("rs");
      await t.page.getByLabel("보는 면").getByRole("radio", { name: "안면" }).click();
      await t.sleep(500);
      const b = await fabricPixels(t);
      t.expect(b.count > 0 && b.sig !== a.sig, "안면으로 바꾸면 그림이 달라짐");
      await t.shot("ws");
      await t.page.getByLabel("보기").getByRole("radio", { name: "2D" }).click();
      await t.sleep(500);
      const c = await fabricPixels(t);
      t.expect(c.count > 0 && c.sig !== b.sig, "2D로 바꾸면 그림이 달라짐");
      const dl = t.page.waitForEvent("download", { timeout: 8000 });
      await t.click("이미지 저장", { exact: true });
      const d = await dl;
      const p = await d.path();
      const head = fs.readFileSync(p).subarray(0, 8).toString("hex");
      t.expect(d.suggestedFilename().endsWith("-실체화.png") && head === "89504e470d0a1a0a", `PNG 다운로드 (${d.suggestedFilename()})`);
      await t.click("[aria-label='차트로 돌아가기']");
      t.expect((await t.page.locator("[data-knit-preview]").count()) === 0, "닫기");
    },
  },
  {
    id: "F22c",
    feature: "실체화 (β)",
    name: "2단짜리 짧은 차트도 20단 차트와 같은 코 크기로 그린다",
    async run(t) {
      const id = await newKnit(t);
      const zoomAt = async (rows) => {
        await t.page.evaluate(
          ({ id, rows }) => {
            const k = `pt:work:${id}`;
            const w = JSON.parse(localStorage.getItem(k));
            const g = w.grids[0];
            g.rows = rows;
            g.cols = 10;
            g.cells = Array.from({ length: rows * 10 }, () => ({ symbol: "k_purl" }));
            localStorage.setItem(k, JSON.stringify(w));
          },
          { id, rows },
        );
        await reload(t);
        await railBtn(t, "실체화 (β)").click();
        await t.sleep(900);
        const z = await t.page.locator("[data-knit-preview]").getByLabel("화면에 맞추기").innerText();
        await t.click("[aria-label='차트로 돌아가기']");
        return z;
      };
      const tall = await zoomAt(20);
      const short = await zoomAt(2);
      t.expect(tall === short, `맞춤 배율이 같음 (20단 ${tall}, 2단 ${short})`);
    },
  },
  {
    id: "F22b",
    feature: "실체화 (β)",
    name: "격자가 없으면 빈 상태 안내",
    async run(t) {
      await newKnit(t);
      // a new chart starts with nothing selected: pick the layer first, then delete it
      await t.page.locator('[data-tour="layer-panel"] div.group\\/row', { hasText: "격자 1" }).first().locator("button").first().click();
      await t.page.locator("[data-tour='layer-panel'] > div:last-child [aria-label='격자 삭제']").click();
      await t.sleep(300);
      await railBtn(t, "실체화 (β)").click();
      await t.sleep(500);
      t.expect(await t.has(/실체화할 격자가 아직 없어요/), "빈 상태 문구");
      t.expect((await t.page.locator("[data-knit-preview] canvas").count()) === 0, "캔버스 없음");
    },
  },

  // ---------------- F23 기호 만들기 ----------------
  {
    id: "F23a",
    feature: "기호 만들기",
    name: "그리기 → 저장 → 내 기호 → 차트에 놓기 → 새로고침 · SVG 내보내기에도 남음",
    async run(t) {
      const id = await newKnit(t);
      await t.click("[aria-label='내 기호 만들기']");
      await t.click("저장", { exact: true });
      t.expect(await t.has(/이름을 입력해 주세요/), "이름 없이 저장하면 안내");
      t.expect(await t.page.getByLabel("기호 그리는 칸").isVisible(), "편집기가 열린 채로");
      const pad = await t.page.getByLabel("기호 그리는 칸").boundingBox();
      const pt = (x, y) => ({ x: pad.x + (x / 24) * pad.width, y: pad.y + (y / 24) * pad.height });
      const drag = async (p0, p1) => {
        await t.page.mouse.move(p0.x, p0.y);
        await t.page.mouse.down();
        await t.page.mouse.move(p1.x, p1.y, { steps: 5 });
        await t.page.mouse.up();
      };
      await drag(pt(5, 19), pt(19, 5));
      await t.page.getByRole("button", { name: "원", exact: true }).click();
      await t.page.getByRole("button", { name: "채우기" }).click();
      await drag(pt(9, 9), pt(15, 15));
      await t.page.getByLabel("기호 이름").fill("별꽃");
      await t.shot("editor");
      await t.click("저장", { exact: true, wait: 500 });
      const lib = JSON.parse((await t.storage("pt:knit:myGlyphs")) || "[]");
      t.expect(lib.length === 1 && lib[0].name === "별꽃" && lib[0].svg.includes("<ellipse") && lib[0].svg.includes('fill="currentColor"'), "내 기호 저장 (선 + 채운 원)");
      t.expect(await t.page.locator("[data-my-glyphs]").getByRole("button", { name: "별꽃", exact: true }).isVisible(), "팔레트 「내 기호」에 표시");
      await clickCell(t, 10, 10, 20, 20);
      await clickCell(t, 11, 10, 20, 20);
      let doc = await saved(t, id);
      const placed = doc.grids[0].cells.filter((c) => c?.symbol === lib[0].id).length;
      t.expect(placed === 2, "차트에 2칸 놓임");
      t.expect(doc.glyphs?.[0]?.id === lib[0].id, "문서에 기호 정의가 함께 저장");
      await reload(t);
      t.expect((await t.page.locator(`symbol#ks-${lib[0].id}`).count()) > 0 && (await t.page.locator(`use[href="#ks-${lib[0].id}"]`).count()) === 2, "새로고침 뒤 차트에 그대로 그려짐");
      await t.shot("placed");
      await t.click("[aria-label='내보내기']");
      await t.page.getByRole("dialog").getByRole("button", { name: "SVG", exact: true }).click();
      const dl = t.page.waitForEvent("download", { timeout: 8000 });
      await t.page.getByRole("dialog").getByRole("button", { name: "내보내기", exact: true }).click();
      const svg = fs.readFileSync(await (await dl).path(), "utf8");
      t.expect(svg.includes(`id="ks-${lib[0].id}"`) && svg.includes("<ellipse"), "SVG 내보내기에 내 기호 포함");
    },
  },
  {
    id: "F23b",
    feature: "기호 만들기",
    name: "내 기호 삭제는 확인 후 라이브러리에서만 빠지고 놓은 칸은 남는다",
    async run(t) {
      const id = await newKnit(t);
      await t.click("[aria-label='내 기호 만들기']");
      const pad = await t.page.getByLabel("기호 그리는 칸").boundingBox();
      await t.page.mouse.move(pad.x + pad.width * 0.2, pad.y + pad.height * 0.5);
      await t.page.mouse.down();
      await t.page.mouse.move(pad.x + pad.width * 0.8, pad.y + pad.height * 0.5, { steps: 4 });
      await t.page.mouse.up();
      await t.page.getByLabel("기호 이름").fill("가로줄");
      await t.click("저장", { exact: true, wait: 500 });
      await clickCell(t, 5, 5, 20, 20);
      const tile = t.page.locator("[data-my-glyphs] .group\\/glyph").first();
      await tile.hover();
      await tile.getByRole("button", { name: "내 기호 삭제" }).click();
      t.expect(await t.has(/이미 차트에 놓은 칸은 그대로 남아요/), "삭제 확인 문구");
      await t.page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
      await t.sleep(400);
      t.expect(JSON.parse((await t.storage("pt:knit:myGlyphs")) || "[]").length === 0, "라이브러리에서 빠짐");
      t.expect((await t.page.locator("[data-my-glyphs]").count()) === 0, "내 기호 칸이 사라짐");
      const doc = await saved(t, id);
      t.expect(doc.grids[0].cells.some((c) => c?.symbol?.startsWith("u_")) && doc.glyphs?.length === 1, "놓은 칸과 문서의 정의는 남음");
    },
  },

  // ---------------- F24 버전 기록 ----------------
  {
    id: "F24a",
    feature: "버전 기록",
    name: "이름 붙여 저장 → 지우기 → 복원 → 되돌리기 → 새로고침",
    async run(t) {
      const id = await newKnit(t);
      await t.page.getByRole("button", { name: "안뜨기", exact: true }).first().click();
      await clickCell(t, 3, 3, 20, 20);
      await clickCell(t, 4, 3, 20, 20);
      await t.sleep(1200);
      await t.click("[aria-label='버전 기록']");
      t.expect(await t.has(/현재 버전/), "버전 기록 창");
      await t.page.getByLabel("버전 이름").fill("첫 버전");
      await t.click("지금 버전 저장", { exact: true });
      t.expect(await t.has(/「첫 버전」 버전을 저장했어요/), "저장 토스트");
      await t.page.keyboard.press("Escape");
      await t.sleep(300);
      await t.page.keyboard.press("v");
      await t.page.keyboard.press("Meta+a");
      await t.page.keyboard.press("Delete");
      let doc = await saved(t, id);
      t.expect(doc.grids[0].cells.every((c) => !c), "모두 지움");
      await t.click("[aria-label='버전 기록']");
      await t.page.getByRole("button", { name: /^첫 버전/ }).click();
      await t.sleep(300);
      t.expect((await t.page.getByRole("dialog").locator("img").count()) === 1, "버전 미리보기 그림");
      await t.click("이 버전으로 복원", { exact: true });
      t.expect(await t.has(/이 버전으로 복원할까요\?/), "복원 확인");
      await t.click("복원", { exact: true, wait: 600 });
      doc = await saved(t, id);
      t.expect(doc.grids[0].cells.filter((c) => c?.symbol === "k_purl").length === 2, "복원으로 안뜨기 2칸이 돌아옴");
      await t.page.keyboard.press("Meta+z");
      doc = await saved(t, id);
      t.expect(doc.grids[0].cells.every((c) => !c), "되돌리기로 복원 취소");
      await t.page.keyboard.press("Meta+Shift+z");
      doc = await saved(t, id);
      t.expect(doc.grids[0].cells.filter((c) => c?.symbol === "k_purl").length === 2, "다시 실행으로 복원");
      await reload(t);
      const vers = JSON.parse((await t.storage(`pt:versions:${id}`)) || "[]");
      t.expect(vers.some((v) => v.label === "첫 버전") && vers.some((v) => (v.label ?? "").endsWith("복원 전")), "새로고침 뒤에도 「첫 버전」·「복원 전」 버전 남음");
      t.expect((await t.work(id)).grids[0].cells.filter((c) => c?.symbol === "k_purl").length === 2, "새로고침 뒤 복원된 내용 유지");
      await t.click("[aria-label='버전 기록']");
      const row = t.page.getByRole("dialog").locator("li", { hasText: "첫 버전" }).first();
      await row.hover();
      await row.getByRole("button", { name: "버전 삭제" }).click();
      await t.sleep(300);
      t.expect(!JSON.parse((await t.storage(`pt:versions:${id}`)) || "[]").some((v) => v.label === "첫 버전"), "버전 삭제");
    },
  },

  // ---------------- F25 폴더 ----------------
  {
    id: "F25a",
    feature: "폴더",
    name: "폴더 만들기 → 넣고 빼기 → 숨기기 → 삭제(확인) → 되돌리기 → 새로고침",
    async run(t) {
      const id = await newKnit(t);
      await t.click("[aria-label='레이어 추가']");
      await t.click("[aria-label='폴더 추가']");
      let doc = await saved(t, id);
      const fid = doc.folders?.[0]?.id;
      t.expect(doc.folders?.length === 1 && doc.folders[0].name === "폴더 1", "폴더 1 생성");
      t.expect(doc.grids.find((g) => g.name === "격자 2")?.folderId === fid, "선택한 격자 2가 폴더에 들어감");
      const layer = (name) => t.page.locator('[data-tour="layer-panel"] div.group\\/row', { hasText: name }).last();
      await layer("격자 1").hover();
      await layer("격자 1").getByRole("button", { name: "폴더로 옮기기" }).click();
      await t.page.getByRole("menuitem", { name: "폴더 1(으)로 옮기기" }).click();
      await t.sleep(300);
      doc = await saved(t, id);
      t.expect(doc.grids.every((g) => g.folderId === fid), "격자 1도 폴더로 옮김");
      await layer("격자 2").hover();
      await layer("격자 2").getByRole("button", { name: "폴더로 옮기기" }).click();
      await t.page.getByRole("menuitem", { name: "폴더 밖으로 빼기" }).click();
      await t.sleep(300);
      doc = await saved(t, id);
      t.expect(!doc.grids.find((g) => g.name === "격자 2").folderId, "격자 2를 폴더 밖으로 뺌");
      const folderRow = t.page.locator("[data-layer-folder]").first();
      await folderRow.hover();
      await folderRow.getByRole("button", { name: "폴더 숨기기" }).click();
      await t.sleep(300);
      t.expect((await t.page.locator('[aria-label="격자"]').count()) === 1, "숨긴 폴더의 격자가 캔버스에서 사라짐");
      t.expect((await saved(t, id)).folders[0].visible === false, "폴더 숨김 저장");
      await t.shot("hidden");
      await folderRow.getByRole("button", { name: "폴더 표시" }).click();
      await folderRow.getByRole("button", { name: "폴더 메뉴" }).click();
      await t.page.getByRole("menuitem", { name: "폴더 삭제" }).click();
      t.expect(await t.has(/폴더와 내부 레이어 1개가 함께 삭제돼요/), "삭제 확인 문구");
      await t.page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
      await t.sleep(300);
      doc = await saved(t, id);
      t.expect(!doc.folders?.length && doc.grids.length === 1 && doc.grids[0].name === "격자 2", "폴더와 안의 격자 1 삭제");
      await t.page.keyboard.press("Meta+z");
      doc = await saved(t, id);
      t.expect(doc.folders?.length === 1 && doc.grids.length === 2, "되돌리기로 폴더·격자 복구");
      await reload(t);
      t.expect((await t.page.locator("[data-layer-folder]").count()) === 1 && (await t.has(/폴더 1/)), "새로고침 뒤 폴더 유지");
    },
  },

  // ---------------- F26 배색 뜬 모습 미리보기 ----------------
  {
    id: "F26a",
    feature: "배색 뜬 모습 미리보기",
    name: "대바늘 배색에서 열면 실 색 편물이 그려지고, 다른 기법은 안내만",
    async run(t) {
      await t.create("배색");
      await t.page.locator('[data-grid-start="blank"]').click({ timeout: 5000 }).catch(() => {});
      await t.sleep(600);
      const btn = railBtn(t, "뜬 모습 미리보기");
      t.expect((await btn.getAttribute("aria-pressed")) === "false", "처음엔 눌리지 않음");
      // paint a few cells with yarn 1 (dark) so the preview has two colours
      const canvas = t.page.locator("canvas").first();
      const b = await canvas.boundingBox();
      await t.page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5);
      await t.page.mouse.down();
      await t.page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5, { steps: 6 });
      await t.page.mouse.up();
      await btn.click();
      await t.sleep(900);
      t.expect((await btn.getAttribute("aria-pressed")) === "true", "열린 동안 레일 버튼 눌림");
      const px = await fabricPixels(t);
      t.expect(px.count > px.total * 0.2, `편물 픽셀 (${px.count}/${px.total})`);
      const dark = await t.page.evaluate(() => {
        const cv = document.querySelector("[data-knit-preview] canvas");
        const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) n++;
        return n;
      });
      t.expect(dark > 50, `칠한 어두운 실도 보임 (${dark}px)`);
      await t.shot("open");
      await btn.click();
      await t.sleep(300);
      t.expect((await t.page.locator("[data-knit-preview]").count()) === 0 && (await btn.getAttribute("aria-pressed")) === "false", "다시 누르면 닫히고 눌림 해제");
      await t.page.getByRole("radio", { name: "코바늘 배색" }).click();
      await t.sleep(300);
      await btn.click();
      t.expect(await t.has(/뜬 모습 미리보기는 대바늘 배색에서 볼 수 있어요/), "코바늘 배색에선 안내 토스트");
      t.expect((await t.page.locator("[data-knit-preview]").count()) === 0, "창은 열리지 않음");
    },
  },
];
