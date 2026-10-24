// Crochet editor: the features that used to say "준비 중이에요" (F11–F19).
// Each scenario starts from a new 코바늘 도안 made with the home "코바늘" button.

const SAVE = 1000; // autosave debounce (600ms) + margin

async function newChart(t) {
  await t.create("코바늘");
  const id = t.idFromUrl();
  t.expect(!!id, "새 코바늘 도안이 만들어졌다");
  return id;
}
/** The stored chart of a work wrapped as { data } (pt:work:<id> holds the data itself). */
const getWork = async (t, id) => ({ data: await t.work(id) });
const layersOf = (w) => (w?.data?.layers ?? []).map((l) => `${l.name}:${l.items.length}`).join(" ");
const folderOf = (w, l) => (w.data.folders ?? []).find((f) => f.id === l.folderId)?.name ?? null;
async function reload(t) {
  await t.page.reload({ waitUntil: "domcontentloaded" });
  await t.sleep(2500);
}
async function undo(t, n = 1) {
  await t.page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  for (let i = 0; i < n; i++) {
    await t.page.keyboard.press("ControlOrMeta+z");
    await t.sleep(150);
  }
  await t.sleep(SAVE);
}
/** Inserts a template with optional numeric fields ({ label: value }). */
async function insertTemplate(t, id, fields = {}, segment) {
  const p = t.page;
  if (!(await p.locator('[data-testid="template-panel"]').count())) await t.click('[data-maker-nav="library"]');
  if (await p.getByRole("button", { name: "템플릿 목록" }).count()) await p.getByRole("button", { name: "템플릿 목록" }).click();
  await t.click(`[data-template="${id}"]`);
  if (segment) await p.locator('[data-testid="template-panel"]').getByRole("button", { name: segment, exact: true }).click();
  for (const [label, v] of Object.entries(fields)) {
    await p.locator('[data-testid="template-panel"] label').filter({ hasText: label }).locator("input").fill(String(v));
  }
  await t.sleep(200);
  const counts = (await p.locator('[data-testid="template-counts"]').innerText()).replace(/\s+/g, " ").trim();
  const total = (await p.locator('[data-testid="template-total"]').innerText()).trim();
  await p.getByRole("button", { name: "도안에 넣기" }).click();
  await t.sleep(SAVE);
  return { counts, total };
}
async function say(t, text) {
  const p = t.page;
  await p.fill('input[aria-label="어시스턴트에게 보낼 말"]', text);
  await p.keyboard.press("Enter");
  await t.sleep(SAVE);
  const all = await p.locator('[data-role="assistant"]').allInnerTexts();
  return all[all.length - 1] ?? "";
}
async function importLines(t) {
  return (await t.page.locator('[data-testid="import-preview"] li').allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim());
}

export const scenarios = [
  // ---------- F11 템플릿 ----------
  {
    id: "F11a",
    feature: "템플릿",
    name: "원형 템플릿: 설정·단별 코 수·넣기·되돌리기·새로고침",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="library"]');
      t.expect(await t.has(/원형[\s\S]*그래니 스퀘어[\s\S]*육각 모티프/), "템플릿 목록이 보인다");
      const r = await insertTemplate(t, "circle", { "단 수": 4 });
      t.expect(r.counts === "1단 6 2단 12 3단 18 4단 24", `단별 코 수 = ${r.counts}`);
      t.expect(r.total === "4단 · 모두 60코", `합계 = ${r.total}`);
      t.expect(await t.has(/‘원형’ 템플릿을 넣었어요\. \(60코\)/), "넣기 토스트");
      let w = await getWork(t, id);
      t.expect(layersOf(w) === "1단:7 2단:6 3단:12 4단:18", `레이어 = ${layersOf(w)}`);
      t.expect(w.data.layers.every((l) => folderOf(w, l) === "원형"), "모두 '원형' 폴더 안");
      t.expect(w.data.layers[0].items.some((i) => i.symbol === "magic_ring"), "1단에 매직링");
      t.expect(await t.page.locator('[data-folder-row="원형"]').count() === 1, "레이어 패널에 폴더 행");
      await t.shot("inserted");
      await undo(t);
      w = await getWork(t, id);
      t.expect(w.data.layers.every((l) => !l.items.length) && !(w.data.folders ?? []).length, "되돌리기로 템플릿이 사라진다");
      await t.page.keyboard.press("ControlOrMeta+Shift+z");
      await t.sleep(SAVE);
      await reload(t);
      w = await getWork(t, id);
      t.expect(layersOf(w) === "1단:7 2단:6 3단:12 4단:18", "다시 실행 후 새로고침해도 남아 있다");
    },
  },
  {
    id: "F11b",
    feature: "템플릿",
    name: "사각 평면(한길 긴뜨기)·그래니: 코 수, 겹치지 않게 배치, 검색 없음",
    async run(t) {
      const id = await newChart(t);
      const a = await insertTemplate(t, "rect", { "가로 코 수": 8, "단 수": 3 }, "한길 긴뜨기");
      t.expect(a.counts === "바닥 11 1단 8 2단 8 3단 8", `사각 평면 코 수 = ${a.counts}`);
      const g = await insertTemplate(t, "granny", { "단 수": 2 });
      t.expect(g.counts === "1단 12 2단 24" && g.total === "2단 · 모두 36코", `그래니 = ${g.counts} / ${g.total}`);
      const w = await getWork(t, id);
      const box = (name) => {
        const items = w.data.layers.filter((l) => folderOf(w, l) === name).flatMap((l) => l.items).filter((i) => "x" in i);
        return { x0: Math.min(...items.map((i) => i.x)), x1: Math.max(...items.map((i) => i.x)) };
      };
      const r = box("사각 평면"), gr = box("그래니 스퀘어");
      t.expect(gr.x0 > r.x1, "두 번째 템플릿은 첫 번째와 겹치지 않게 옆에 놓인다");
      await t.click('[data-maker-nav="library"]');
      await t.click('[data-maker-nav="library"]');
      if (await t.page.getByRole("button", { name: "템플릿 목록" }).count()) await t.page.getByRole("button", { name: "템플릿 목록" }).click();
      await t.page.fill('input[aria-label="템플릿 검색"]', "없는모양");
      t.expect(await t.has(/찾는 템플릿이 없어요/), "검색 결과가 없을 때 안내");
      await t.shot("search-empty");
    },
  },

  // ---------- F12 원문·파일로 만들기 ----------
  {
    id: "F12a",
    feature: "원문·파일로 만들기",
    name: "한글·영어 섞인 서술: 미리보기 코 수·오류 줄·배치·새로고침",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="aiConvert"]');
      t.expect(await t.has(/서버 없이 브라우저에서 규칙으로 변환해요/), "로컬 규칙 안내 문구");
      await t.page.fill('textarea[aria-label="서술형 텍스트"]', ["1단: 원형코 짧은뜨기 6코", "2단: 늘려뜨기 6번 (12)", "R3: (sc, inc) x6 (18)", "4단: 짧은뜨기 2, 늘려뜨기 1을 6번 반복 (24)", "5단: 짧은뜨기 24코, 깡총 2 (30)", "메모: 4mm 바늘"].join("\n"));
      await t.sleep(400);
      const lines = await importLines(t);
      t.expect(lines[0] === "1 1단 · 6코" && lines[2] === "3 3단 · 18코" && lines[3] === "4 4단 · 24코", `줄별 코 수: ${lines.slice(0, 4).join(" | ")}`);
      t.expect(/인식하지 못한 용어 1개: 깡총/.test(lines[4]) && /5단 원문 30 \/ 계산 24/.test(lines[4]), `오류 줄: ${lines[4]}`);
      t.expect(/건너뜀/.test(lines[5]), "메모 줄은 건너뜀");
      t.expect((await t.page.locator('[data-testid="import-total"]').innerText()).startsWith("5단 · 모두 84코"), "합계 5단 84코");
      await t.shot("preview");
      await t.page.getByRole("button", { name: "도안 만들기" }).click();
      await t.sleep(SAVE);
      t.expect(await t.has(/5단 · 84코를 배치했어요/), "배치 토스트");
      await reload(t);
      const w = await getWork(t, id);
      t.expect(layersOf(w) === "1단:7 2단:6 3단:12 4단:18 5단:24", `배치된 레이어 = ${layersOf(w)}`);
      t.expect(w.data.layers.every((l) => folderOf(w, l) === "서술도안"), "'서술도안' 폴더");
    },
  },
  {
    id: "F12b",
    feature: "원문·파일로 만들기",
    name: "영어 평면 서술 .txt 올리기: 자동 '평면', 기초 사슬·단 코 수",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="aiConvert"]');
      const txt = "ch 12, turn\nRow 1: sc in 2nd ch from hook, sc across (11)\nRow 2: ch 1, turn, sc 5, 2 sc in next st, sc 5 (12)\nRow 3: ch 1, turn, sc in each st across (12)\nRow 4: ch 1, turn, (sc 2, dec) x3 (9)\n";
      await t.page.setInputFiles('input[aria-label="도안 파일 열기"]', { name: "rows.txt", mimeType: "text/plain", buffer: Buffer.from(txt) });
      await t.sleep(500);
      t.expect((await t.page.inputValue('textarea[aria-label="서술형 텍스트"]')).startsWith("ch 12, turn"), "파일 내용이 입력칸에 들어간다");
      t.expect((await t.page.locator('[aria-label="배치"] button[aria-pressed="true"]').innerText()).trim() === "자동 · 평면", "자동 배치 = 평면");
      const lines = await importLines(t);
      t.expect(lines.join(" | ") === "1 바닥 · 12코 | 2 1단 · 11코 | 3 2단 · 12코 | 4 3단 · 12코 | 5 4단 · 9코", `줄별: ${lines.join(" | ")}`);
      await t.page.getByRole("button", { name: "도안 만들기" }).click();
      await t.sleep(SAVE);
      const w = await getWork(t, id);
      t.expect(layersOf(w) === "바닥:12 1단:11 2단:12 3단:13 4단:10", `레이어 (사슬 기둥 포함) = ${layersOf(w)}`);
      const row2 = w.data.layers.find((l) => l.name === "2단");
      t.expect(row2.items.filter((i) => i.type === "gather").length === 1, "2단에 늘려뜨기 1개");
      await t.shot("rows");
    },
  },
  {
    id: "F12c",
    feature: "원문·파일로 만들기",
    name: "코 정보가 없는 글·코바늘이 아닌 JSON은 막힌다",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="aiConvert"]');
      await t.page.fill('textarea[aria-label="서술형 텍스트"]', "안녕하세요\n오늘은 뜨개 이야기");
      await t.sleep(300);
      t.expect(await t.page.getByRole("button", { name: "도안 만들기" }).isDisabled(), "만들 단이 없으면 '도안 만들기' 비활성");
      await t.page.setInputFiles('input[aria-label="도안 파일 열기"]', { name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ craft: "knitting", data: { grids: [] } })) });
      await t.sleep(400);
      t.expect(await t.has(/코바늘 도안 파일\(JSON\)이 아니에요/), "잘못된 JSON 안내");
      const w = await getWork(t, id);
      t.expect(!w.data.layers.some((l) => l.items.length), "도안은 그대로");
    },
  },

  // ---------- F13 AI 어시스턴트 ----------
  {
    id: "F13a",
    feature: "AI 어시스턴트",
    name: "예시 명령이 말한 대로 도안을 바꾸고, 모르는 말엔 할 수 있는 일을 알려 준다",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="ai"]');
      t.expect(await t.has(/규칙 기반 · 로컬/) && (await t.has(/AI 모델이 답하지 않아요/)), "규칙 기반·로컬 표시");
      let r = await say(t, "매직링 짧은뜨기 6코로 시작해 3단까지 6코씩 늘리기");
      t.expect(/원형 3단을 만들었어요\. 모두 36코/.test(r), `생성: ${r.split("\n")[0]}`);
      t.expect(layersOf(await getWork(t, id)) === "1단:7 2단:6 3단:12", "1~3단");
      r = await say(t, "한 단 더 늘림 없이");
      t.expect(/4단을 반영했어요/.test(r) && layersOf(await getWork(t, id)).endsWith("4단:18"), `한 단 더: ${r.split("\n")[0]}`);
      r = await say(t, "5단 추가해줘");
      let w = await getWork(t, id);
      t.expect(/5단을 반영했어요/.test(r) && layersOf(w).endsWith("5단:18"), `5단 추가 (늘림 없이 이어짐): ${layersOf(w)}`);
      r = await say(t, "전체 코 수 알려줘");
      t.expect(/모두 72코예요/.test(r) && /단별 코 수: 1단 6 · 2단 12 · 3단 18 · 4단 18 · 5단 18/.test(r), `코 수: ${r.replace(/\n/g, " ")}`);
      r = await say(t, "2단 빨간색으로");
      w = await getWork(t, id);
      t.expect(w.data.layers.find((l) => l.name === "2단").items.every((i) => i.color === "#d64545"), `2단 빨간색: ${r}`);
      r = await say(t, "마지막 단을 한길긴뜨기로 바꾸기");
      w = await getWork(t, id);
      t.expect(w.data.layers.find((l) => l.name === "5단").items.every((i) => i.symbol === "dc"), `마지막 단 → 한길 긴뜨기: ${r.split(".")[0]}`);
      r = await say(t, "짧은뜨기를 긴뜨기로 바꿔");
      w = await getWork(t, id);
      const scLeft = w.data.layers.flatMap((l) => l.items).filter((i) => i.symbol === "sc").length;
      t.expect(scLeft === 0 && /짧은뜨기 \d+개를 긴뜨기로/.test(r), `짧은뜨기 → 긴뜨기: ${r.split(".")[0]}`);
      r = await say(t, "3단 지우기");
      w = await getWork(t, id);
      t.expect(!w.data.layers.some((l) => l.name === "3단") && /3단을 지웠어요/.test(r), "3단 지우기");
      r = await say(t, "하늘을 날아줘");
      t.expect(/이 요청은 아직 처리할 수 없어요/.test(r) && /이렇게 말해 보세요/.test(r), "모르는 말 → 할 수 있는 말 목록");
      const before = layersOf(await getWork(t, id));
      r = await say(t, "되돌리기");
      w = await getWork(t, id);
      t.expect(w.data.layers.some((l) => l.name === "3단") && layersOf(w) !== before, "'되돌리기'로 3단이 돌아온다");
      await undo(t);
      w = await getWork(t, id);
      t.expect(w.data.layers.flatMap((l) => l.items).some((i) => i.symbol === "sc"), "⌘Z로 긴뜨기 바꾸기도 되돌린다");
      await t.shot("chat");
    },
  },
  {
    id: "F13b",
    feature: "AI 어시스턴트",
    name: "선택한 기호만 바꾸기, 서술 한 줄로 단 고치기, 없는 단",
    async run(t) {
      const id = await newChart(t);
      await t.click('[data-maker-nav="ai"]');
      await say(t, "매직링 짧은뜨기 6코로 시작해 3단까지 6코씩 늘리기");
      let r = await say(t, "7단 지우기");
      t.expect(/7단을 찾지 못했어요/.test(r), `없는 단: ${r}`);
      r = await say(t, "3단: 짧은뜨기 2, 늘려뜨기 1을 6번 반복 (24)");
      let w = await getWork(t, id);
      t.expect(/3단을 고쳐 반영했어요/.test(r) && layersOf(w) === "1단:7 2단:6 3단:18", `3단을 24코로 고치기: ${layersOf(w)}`);
      // select 2단 from the layer panel's items: click its first stitch on the canvas via select-all of layer
      r = await say(t, "2단 선택해");
      t.expect(/2단 6개를 선택했어요/.test(r), `선택: ${r}`);
      t.expect(await t.has(/선택한 기호 6개만 편집해요/), "선택 배너");
      r = await say(t, "파란색으로");
      w = await getWork(t, id);
      t.expect(w.data.layers.find((l) => l.name === "2단").items.every((i) => i.color === "#2e86c1") && w.data.layers.find((l) => l.name === "3단").items.every((i) => !i.color), "선택한 2단만 파란색");
    },
  },

  // ---------- F14 서술도안 ----------
  {
    id: "F14a",
    feature: "서술도안",
    name: "차트와 같은 서술, 복사, 복사한 글을 다시 가져오면 같은 코 수",
    async run(t) {
      await newChart(t);
      const toggle = t.page.locator('[data-tour="written-toggle"] button');
      await toggle.click();
      t.expect((await toggle.getAttribute("aria-pressed")) === "true", "토글이 눌린 상태");
      t.expect(await t.has(/기호를 놓으면 놓은 순서대로 여기에 표시돼요/), "빈 도안 안내");
      t.expect(await t.page.getByRole("button", { name: "서술도안 복사" }).isDisabled(), "빈 도안은 복사 비활성");
      await toggle.click();
      await insertTemplate(t, "circle", { "단 수": 4 });
      await insertTemplate(t, "rect", { "가로 코 수": 5, "단 수": 2 });
      await toggle.click();
      await t.sleep(300);
      const rounds = await t.page.locator("[data-written-round]").allInnerTexts();
      t.expect(rounds[0] === "1단: 매직링, 짧은뜨기 6 (6코)", `1단: ${rounds[0]}`);
      t.expect(rounds[2] === "3단: (짧은뜨기 1, 짧은뜨기 2코 늘려뜨기 1) × 6 (18코)", `3단: ${rounds[2]}`);
      t.expect(rounds[5] === "1단: 짧은뜨기 5 (5코)" && rounds[6] === "2단: 사슬뜨기 1, 짧은뜨기 5 (5코)", `평면: ${rounds[5]} / ${rounds[6]}`);
      t.expect((await t.page.locator('[data-testid="written-total"]').innerText()) === "모두 76코", "합계 모두 76코 (60 + 바닥 6 + 10)");
      await t.page.locator('[data-testid="written-panel"]').getByRole("button", { name: "EN" }).click();
      t.expect((await t.page.locator("[data-written-round]").first().innerText()) === "R1: MR, sc 6 (6)", "EN 표기");
      await t.page.locator('[data-testid="written-panel"]').getByRole("button", { name: "한글" }).click();
      await t.page.getByRole("button", { name: "서술도안 복사" }).click();
      await t.sleep(300);
      t.expect(await t.has(/서술도안을 복사했어요/), "복사 토스트");
      const clip = await t.page.evaluate(() => navigator.clipboard.readText());
      t.expect(clip.startsWith("[원형]\n1단: 매직링, 짧은뜨기 6 (6코)") && clip.includes("[사각 평면]") && clip.trim().endsWith("모두 76코"), "클립보드 내용");
      await t.shot("written");
      await toggle.click();
      // re-import only the round part of the copied circle
      const circle = clip.split("\n\n")[0];
      await t.click('[data-maker-nav="aiConvert"]');
      await t.page.fill('textarea[aria-label="서술형 텍스트"]', circle);
      await t.sleep(400);
      const lines = (await importLines(t)).filter((l) => !/건너뜀/.test(l)).map((l) => l.replace(/^\d+ /, ""));
      t.expect(lines.join(" | ") === "1단 · 6코 | 2단 · 12코 | 3단 · 18코 | 4단 · 24코", `다시 읽은 코 수: ${lines.join(" | ")}`);
      t.expect(!(await t.page.locator('[data-testid="import-preview"] .text-fg-critical').count()), "다시 읽을 때 오류 없음");
    },
  },

  // ---------- F15 경로 편집 ----------
  {
    id: "F15a",
    feature: "경로 편집",
    name: "펜 선의 점 옮기기·추가·삭제, 새로고침 후 유지, 두 점 남으면 안 지워짐",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      const svg = await p.locator('[data-testid="crochet-canvas"]').boundingBox();
      const P = (x, y) => [svg.x + svg.width / 2 + x, svg.y + (svg.height - 154) / 2 + y];
      t.expect(await t.byLabel("편집할 기호를 하나 선택한 뒤 경로 편집을 눌러 주세요.").isDisabled(), "선택 없으면 경로 편집 비활성");
      await p.keyboard.press("p");
      for (const [x, y] of [[-100, 0], [0, 80], [100, 0]]) await p.mouse.click(...P(x, y));
      await p.keyboard.press("Enter");
      await p.keyboard.press("v");
      await t.sleep(SAVE);
      const pts = async () => (await getWork(t, id)).data.layers.flatMap((l) => l.items).find((i) => i.type === "stroke")?.points;
      const p0 = await pts();
      t.expect(p0?.length === 3, `펜 선 3점: ${JSON.stringify(p0)}`);
      await p.mouse.click(...P(-50, 40));
      await t.click('[aria-label="경로 편집"]');
      t.expect((await p.locator("[data-vertex]").count()) === 3, "꼭짓점 핸들 3개");
      t.expect(await t.has(/꼭짓점을 드래그해 형태를 수정하세요/), "경로 편집 안내");
      // drag the middle point 60px down
      const [mx, my] = P(0, 80);
      await p.mouse.move(mx, my);
      await p.mouse.down();
      await p.mouse.move(mx, my + 30, { steps: 5 });
      await p.mouse.move(mx, my + 60, { steps: 5 });
      await p.mouse.up();
      await t.sleep(SAVE);
      let q = await pts();
      t.expect(q[1][0] === p0[1][0] && q[1][1] === p0[1][1] + 60, `가운데 점이 60 아래로: ${JSON.stringify(q)}`);
      // insert on the first segment
      const mid = [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2];
      await p.mouse.click(...P(mid[0], mid[1]));
      await t.sleep(SAVE);
      q = await pts();
      t.expect(q.length === 4, `선 위를 눌러 점 추가 → 4점: ${JSON.stringify(q)}`);
      await t.shot("inserted");
      // delete the new point: press it twice
      const nv = p.locator('[data-vertex="1"]');
      await nv.click();
      await nv.click();
      await t.sleep(SAVE);
      q = await pts();
      t.expect(q.length === 3, `점 두 번 누르기로 삭제 → 3점`);
      await p.getByRole("group", { name: "경로 편집" }).getByRole("button", { name: "완료" }).click();
      t.expect((await p.locator("[data-vertex]").count()) === 0, "완료로 경로 편집 종료");
      await reload(t);
      const after = await pts();
      t.expect(JSON.stringify(after) === JSON.stringify(q), "새로고침 후 점이 그대로");
      // edge: only two points left cannot be deleted
      await p.mouse.click(...P(-50, 70));
      await t.click('[aria-label="경로 편집"]');
      await p.locator('[data-vertex="2"]').click({ modifiers: ["Alt"] });
      await t.sleep(300);
      await p.locator('[data-vertex="1"]').click({ modifiers: ["Alt"] });
      await t.sleep(SAVE);
      t.expect((await pts()).length === 2 && (await t.has(/점이 두 개 남은 선은 더 지울 수 없어요/)), "두 점 남은 선은 안 지워진다");
    },
  },

  // ---------- F16 버전 기록 ----------
  {
    id: "F16a",
    feature: "버전 기록",
    name: "이름 붙여 저장 → 지운 뒤 복원 → 복원 되돌리기 → 새로고침",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      await insertTemplate(t, "circle", { "단 수": 3 });
      await t.click('[aria-label="버전 기록"]');
      t.expect(await t.has(/현재 버전/), "버전 기록 대화상자");
      await p.fill('input[aria-label="버전 이름"]', "3단 완성");
      await p.locator("dialog[open]").getByRole("button", { name: "지금 버전 저장" }).click();
      await t.sleep(300);
      t.expect(await t.has(/버전을 저장했어요 · 3단 완성/), "저장 토스트");
      t.expect((await p.locator('[aria-label="버전 목록"] li').first().innerText()).includes("3단 완성"), "목록 맨 위에 '3단 완성'");
      await p.keyboard.press("Escape");
      await p.keyboard.press("ControlOrMeta+a");
      await p.keyboard.press("Delete");
      await t.sleep(SAVE);
      t.expect(!(await getWork(t, id)).data.layers.some((l) => l.items.length), "기호를 모두 지움");
      await t.click('[aria-label="버전 기록"]');
      const row = p.locator('[aria-label="버전 목록"] li').filter({ hasText: "3단 완성" });
      await row.locator('button[title="미리보기"]').click();
      t.expect(await t.has(/버전을 보는 중/) && (await t.has(/3단 완성 · 기호 25개 · 36코/)), "미리보기 정보");
      // edge: cancel the restore
      await row.getByRole("button", { name: "복원" }).click();
      await p.getByRole("alertdialog").getByRole("button", { name: "취소" }).click();
      await t.sleep(300);
      t.expect(!(await getWork(t, id)).data.layers.some((l) => l.items.length), "취소하면 그대로");
      await row.getByRole("button", { name: "복원" }).click();
      await p.getByRole("alertdialog").getByRole("button", { name: "복원", exact: true }).click();
      await t.sleep(SAVE);
      t.expect(layersOf(await getWork(t, id)) === "1단:7 2단:6 3단:12", "복원됨");
      t.expect(await t.has(/버전으로 복원했어요/), "복원 토스트");
      const vs = JSON.parse((await t.storage(`pt:versions:${id}`)) || "[]");
      t.expect(vs.some((v) => v.label === "복원 전"), "'복원 전' 버전이 남는다");
      await t.shot("restored");
      await p.keyboard.press("Escape");
      await undo(t);
      t.expect(!(await getWork(t, id)).data.layers.some((l) => l.items.length), "⌘Z로 복원을 되돌린다");
      await reload(t);
      t.expect(!(await getWork(t, id)).data.layers.some((l) => l.items.length), "새로고침 후에도 되돌린 상태");
      await t.click('[aria-label="버전 기록"]');
      t.expect((await p.locator('[aria-label="버전 목록"] li').filter({ hasText: "3단 완성" }).count()) === 1, "새로고침 후에도 '3단 완성' 버전");
    },
  },

  // ---------- F17 배경색 ----------
  {
    id: "F17a",
    feature: "배경색",
    name: "배경색·투명도 저장, 새로고침, SVG 내보내기에 반영, 잘못된 값",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      await insertTemplate(t, "circle", { "단 수": 2 });
      await t.click('[aria-label="배경색"]');
      await t.click('[data-testid="bg-popover"] [aria-label="색 #e9f3fa"]');
      await p.keyboard.press("Escape");
      const op = p.locator('input[aria-label="배경 투명도"]');
      await op.fill("80");
      await op.press("Enter");
      await t.sleep(SAVE);
      let w = await getWork(t, id);
      t.expect(w.data.background === "#e9f3fa" && w.data.backgroundOpacity === 80, `저장: ${w.data.background} ${w.data.backgroundOpacity}`);
      const bg = () => p.locator("[data-canvas-surface]").evaluate((e) => e.style.backgroundColor);
      t.expect((await bg()) === "rgba(233, 243, 250, 0.8)", `캔버스 배경 ${await bg()}`);
      await reload(t);
      t.expect((await bg()) === "rgba(233, 243, 250, 0.8)" && (await op.inputValue()) === "80", "새로고침 후 유지");
      await t.click('[data-tour="export"]');
      await p.locator("dialog[open]").getByRole("button", { name: "SVG" }).click();
      const [dl] = await Promise.all([p.waitForEvent("download"), p.locator("dialog[open]").getByRole("button", { name: "내보내기" }).click()]);
      const svg = await new Promise((res) => dl.createReadStream().then((s) => { let b = ""; s.on("data", (c) => (b += c)); s.on("end", () => res(b)); }));
      t.expect(/fill="#e9f3fa" fill-opacity="0\.8"/.test(svg), "SVG에 배경색과 투명도");
      // edge: letters are ignored, 150 clamps to 100
      await op.fill("abc");
      await op.press("Enter");
      await t.sleep(SAVE);
      t.expect((await getWork(t, id)).data.backgroundOpacity === 80 && (await op.inputValue()) === "80", "글자를 넣으면 무시");
      await op.fill("150");
      await op.press("Enter");
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(w.data.backgroundOpacity === undefined && (await op.inputValue()) === "100", "150 → 100으로 맞춤");
      await t.shot("bg");
    },
  },

  // ---------- F18 기호 높이 ----------
  {
    id: "F18a",
    feature: "기호 높이",
    name: "한길긴뜨기 높이를 바꾸면 그림이 커지고, 새로고침해도 유지, 기본으로",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      await insertTemplate(t, "circle", { "단 수": 2 }, "한길 긴뜨기");
      const w0 = await getWork(t, id);
      const dcId = w0.data.layers[0].items.find((i) => i.symbol === "dc").id;
      const h = () => p.locator(`[data-id="${dcId}"]`).evaluate((e) => Math.round(e.getBBox().height));
      const before = await h();
      await t.click('[aria-label="기호 높이"]');
      t.expect(await t.has(/사슬 1개 높이를 기준으로/), "기호 높이 대화상자");
      await p.locator('[data-testid="heights-dialog"] li').filter({ hasText: "한길긴뜨기" }).locator("input").fill("4.5");
      await p.locator("dialog[open]").getByRole("button", { name: "완료" }).click();
      await t.sleep(SAVE);
      const after = await h();
      t.expect(after > before * 1.4, `한길 긴뜨기 그림 높이 ${before} → ${after}`);
      t.expect(JSON.stringify((await getWork(t, id)).data.heights) === '{"units":{"3":4.5}}', "문서에 기호 높이 저장");
      await reload(t);
      t.expect((await h()) === after, "새로고침 후에도 같은 높이");
      await t.click('[aria-label="기호 높이"]');
      await p.locator("dialog[open]").getByRole("button", { name: "기본으로" }).click();
      await p.locator("dialog[open]").getByRole("button", { name: "완료" }).click();
      await t.sleep(SAVE);
      t.expect((await getWork(t, id)).data.heights === undefined && (await h()) === before, "기본으로 → 원래 높이");
      await t.shot("heights");
    },
  },

  // ---------- F19 폴더 ----------
  {
    id: "F19a",
    feature: "폴더",
    name: "폴더 만들기, 레이어 넣고 빼기, 숨기기, 접기, 삭제(취소 포함)",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      for (let i = 0; i < 3; i++) await t.click('[aria-label="레이어 추가"]', { wait: 200 });
      await p.locator('[data-layer-row="2단"]').click();
      await t.click('[aria-label="폴더 추가"]');
      await t.sleep(SAVE);
      let w = await getWork(t, id);
      t.expect((w.data.folders ?? []).map((f) => f.name).join() === "폴더 1" && folderOf(w, w.data.layers.find((l) => l.name === "2단")) === "폴더 1", "폴더 1에 활성 레이어(2단)");
      await p.locator('[data-layer-row="1단"]').click({ button: "right" });
      await p.getByRole("menuitem", { name: "‘폴더 1’ 폴더로 옮기기" }).click();
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(w.data.layers.map((l) => `${l.name}${l.folderId ? "*" : ""}`).join(" ") === "1단* 2단* 3단", `옮긴 뒤 순서 유지: ${w.data.layers.map((l) => l.name).join(" ")}`);
      await t.byLabel("폴더 숨기기").click();
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(w.data.layers.filter((l) => l.folderId).every((l) => !l.visible) && w.data.layers.find((l) => l.name === "3단").visible, "폴더 숨기기 → 안의 레이어만 숨김");
      await t.byLabel("폴더 표시").click();
      await p.locator('[data-folder-row="폴더 1"]').click();
      t.expect((await p.locator("[data-layer-row]").count()) === 1, "폴더 접기 → 안의 레이어 행 숨김");
      await p.locator('[data-folder-row="폴더 1"]').click();
      await p.locator('[data-layer-row="2단"]').click({ button: "right" });
      await p.getByRole("menuitem", { name: "폴더에서 빼기" }).click();
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(!w.data.layers.find((l) => l.name === "2단").folderId, "폴더에서 빼기");
      await reload(t);
      t.expect((await p.locator('[data-folder-row="폴더 1"]').count()) === 1, "새로고침 후 폴더 유지");
      // delete: cancel first
      await p.locator('[data-folder-row="폴더 1"]').click({ button: "right" });
      await p.getByRole("menuitem", { name: "폴더 삭제" }).click();
      t.expect(await t.has(/폴더와 내부 레이어 1개가 함께 삭제돼요/), "삭제 확인 문구");
      await p.locator("dialog[open]").getByRole("button", { name: "취소" }).click();
      t.expect((await getWork(t, id)).data.layers.length === 3, "취소하면 그대로");
      await p.locator('[data-folder-row="폴더 1"]').click({ button: "right" });
      await p.getByRole("menuitem", { name: "폴더 삭제" }).click();
      await p.locator("dialog[open]").getByRole("button", { name: "삭제" }).click();
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(w.data.layers.map((l) => l.name).join(" ") === "2단 3단" && !(w.data.folders ?? []).length, `폴더와 1단 삭제: ${w.data.layers.map((l) => l.name).join(" ")}`);
      await t.shot("folders");
    },
  },
  {
    id: "F19b",
    feature: "폴더",
    name: "끌어서 폴더에 넣고, 끌어서 폴더 밖으로 빼기",
    async run(t) {
      const id = await newChart(t);
      const p = t.page;
      for (let i = 0; i < 2; i++) await t.click('[aria-label="레이어 추가"]', { wait: 200 });
      await p.locator('[data-layer-row="2단"]').click({ button: "right" });
      await p.getByRole("menuitem", { name: "새 폴더로 묶기" }).click();
      await p.locator('[data-layer-row="1단"]').dragTo(p.locator('[data-folder-row="폴더 1"]'));
      await t.sleep(SAVE);
      let w = await getWork(t, id);
      t.expect(w.data.layers.every((l) => l.folderId), "끌어서 폴더에 넣기");
      const box = await p.locator('[data-layer-row="1단"]').boundingBox();
      await p.mouse.move(box.x + 60, box.y + 20);
      await p.mouse.down();
      await p.mouse.move(box.x + 60, box.y + 60, { steps: 4 });
      await t.sleep(200);
      const zone = p.getByText("여기에 놓으면 폴더 밖으로 빠져요");
      t.expect((await zone.count()) === 1, "끄는 동안 '폴더 밖' 놓기 영역이 보인다");
      const zb = await zone.boundingBox();
      if (zb) await p.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2, { steps: 6 });
      await p.mouse.up();
      await t.sleep(SAVE);
      w = await getWork(t, id);
      t.expect(!w.data.layers.find((l) => l.name === "1단").folderId, "끌어서 폴더 밖으로");
    },
  },
];
