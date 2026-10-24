// Home & app-level features: atelier, help search, notices, contact, plans, account,
// logout, notifications, and the grid editor's atelier upload + share link.

const OUT = process.env.OUT || "e2e/.out";
const role = (t, r, name, exact = true) => t.page.getByRole(r, { name, exact }).filter({ visible: true }).first();
const dialog = (t) => t.page.locator("dialog[open]");
const filled = (cells) => (cells || []).filter((v) => v > 0).length;

/** Same tours-seen setup as the runner, for extra contexts. */
async function newContext(t) {
  const ctx = await t.browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("patterners.tour.home")) {
        localStorage.setItem("patterners.tour.home", "99");
        for (const c of ["crochet", "knitting", "grid", "apparel", "paper"]) localStorage.setItem(`patterners.tour.maker.${c}`, "99");
      }
    } catch {}
  });
  return ctx;
}

/** New 배색·방안 work from the home button, "빈 격자", then pencil clicks on the canvas. */
async function gridWithCells(t, clicks = 6) {
  await t.create("배색·방안");
  await t.page.locator('[data-grid-start="blank"]').click();
  await t.sleep(400);
  const box = await t.byLabel("배색 도안 격자").boundingBox();
  for (let i = 0; i < clicks; i++) await t.page.mouse.click(box.x + box.width * (0.2 + 0.1 * i), box.y + box.height * (0.3 + 0.05 * i));
  await t.sleep(1500); // autosave
  const id = t.idFromUrl();
  const doc = await t.work(id);
  return { id, cells: doc.pages[0].cells, title: (await t.works()).find((w) => w.id === id).title };
}

/** Opens a home sidebar footer item. */
async function footer(t, label) {
  await t.page.locator("nav.seed-side-navigation__root").filter({ visible: true }).getByRole("button", { name: new RegExp(`^${label}`) }).first().click();
  await t.sleep(400);
}

/** Publishes the open grid work to the local atelier through the Rail button. */
async function publish(t, title, description = "") {
  await t.byLabel("아뜰리에에 올리기").click();
  await t.sleep(400);
  const d = dialog(t);
  await d.getByPlaceholder("예: 데일리 크롭 가디건").fill(title);
  if (description) await d.getByPlaceholder(/완성 사이즈/).fill(description);
  await d.getByRole("button", { name: "목도리·숄", exact: true }).click();
  await d.getByRole("button", { name: "쉬움", exact: true }).click();
  await d.getByRole("button", { name: "배색", exact: true }).click();
  await d.getByRole("button", { name: "소량 판매 허용", exact: true }).click();
  await d.getByRole("button", { name: "올리기", exact: true }).click();
  await t.sleep(500);
}

/** Builds a share link in the page with the same encoding as lib/share (JSON → deflate-raw → base64url). */
const shareLinkInPage = (t, payload) =>
  t.page.evaluate(async (p) => {
    const bytes = new TextEncoder().encode(JSON.stringify(p));
    const out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    let s = "";
    out.forEach((b) => (s += String.fromCharCode(b)));
    return `${location.origin}/share#${btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  }, payload);

/** Opens a share link in a fresh context, clones it, follows the toast's "열기" and returns the new work. */
async function cloneFromLink(t, link, name) {
  const ctx = await newContext(t);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message || e)));
  await p.goto(link, { waitUntil: "domcontentloaded" });
  await t.sleep(1500);
  const text = await p.evaluate(() => document.body.innerText);
  const img = await p.locator('img[alt="도안 미리보기"]').evaluate((el) => el.naturalWidth).catch(() => 0);
  await p.screenshot({ path: `${OUT}/${name}-viewer.png` });
  await p.getByRole("button", { name: "내 도안으로 복제" }).click();
  await p.waitForURL(/\/maker\//, { timeout: 10000 }); // lands in the copy right away
  await t.sleep(2500);
  const id = p.url().split("/maker/")[1];
  const res = await p.evaluate((i) => ({ works: JSON.parse(localStorage.getItem("pt:works") || "[]"), data: JSON.parse(localStorage.getItem(`pt:work:${i}`) || "null") }), id);
  await p.screenshot({ path: `${OUT}/${name}-editor.png` });
  // back on the same link: the button now opens that copy instead of making another
  await p.goto(link, { waitUntil: "domcontentloaded" });
  await t.sleep(1200);
  const again = p.getByRole("button", { name: "복제됨 · 열기" });
  const guardLabel = (await again.count()) === 1;
  await again.click().catch(() => {});
  await p.waitForURL(/\/maker\//, { timeout: 10000 }).catch(() => {});
  await t.sleep(800);
  const reopenId = p.url().split("/maker/")[1];
  const worksAfter = await p.evaluate(() => JSON.parse(localStorage.getItem("pt:works") || "[]").length);
  await ctx.close();
  return { text, img, id, errors, guardLabel, reopenId, worksAfter, ...res };
}

export const scenarios = [
  // ---------------- F03 아뜰리에 ----------------
  {
    id: "F03a",
    feature: "F03 아뜰리에",
    name: "빈 아뜰리에, 없는 도안 주소",
    async run(t) {
      await t.goto("/home");
      await footer(t, "아뜰리에");
      await t.page.waitForURL(/\/atelier/);
      await t.sleep(800);
      t.expect(await t.has(/아직 올라온 도안이 없어요\./), "빈 상태 문구");
      t.expect(await t.has(/이 브라우저에만 저장돼요/), "로컬 저장 안내");
      await t.goto("/atelier?id=nope");
      t.expect(await t.has(/도안을 찾을 수 없어요\./), "없는 id → 찾을 수 없어요");
      await t.click("아뜰리에로");
      t.expect(/\/atelier$/.test(t.page.url()), "목록으로 돌아감");
    },
  },
  {
    id: "F03b",
    feature: "F03 아뜰리에",
    name: "둘러보기 → 검색·필터 → 상세 → 내 도안으로 가져오기 → 내리기",
    async run(t) {
      const g = await gridWithCells(t);
      await publish(t, "점무늬 목도리", "40코 30단 점무늬 연습");
      await t.goto("/atelier");
      t.expect(await t.has(/점무늬 목도리/), "카드 제목");
      t.expect((await t.page.locator("main li").count()) === 1, "카드 1개");
      t.expect(await t.has(/목도리·숄\s*쉬움\s*배색/), "태그 3개 표시");
      const search = t.page.getByPlaceholder("도안, 작가, 태그 검색");
      await search.fill("케이블");
      await t.sleep(200);
      t.expect(await t.has(/조건에 맞는 도안이 없어요\./), "검색 결과 없음");
      await search.fill("목도리");
      await t.sleep(200);
      t.expect((await t.page.locator("main li").count()) === 1, "태그 검색으로 다시 1개");
      await role(t, "button", "코바늘").click();
      await t.sleep(200);
      t.expect((await t.page.locator("main li").count()) === 0, "코바늘 필터 → 0개");
      await role(t, "button", "배색·방안").click();
      await t.sleep(200);
      await t.page.getByRole("link", { name: /점무늬 목도리/ }).click();
      await t.sleep(1000);
      t.expect(/\/atelier\?id=/.test(t.page.url()), "상세 주소");
      t.expect(await t.has(/40코 30단 점무늬 연습/), "도안 소개");
      t.expect(await t.has(/라이선스 · 소량 판매 허용/), "라이선스");
      t.expect(await t.has(/크기\s*40코 × 30단/), "크기 정보");
      t.expect((await t.page.locator('img[alt="도안 미리보기"]').evaluate((el) => el.naturalWidth)) > 0, "도안 그림이 그려짐");
      await t.shot("detail");
      const before = (await t.works()).length;
      const detailUrl = t.page.url();
      await role(t, "button", "내 도안으로 가져오기").click();
      await t.page.waitForURL(/\/maker\//, { timeout: 10000 });
      await t.sleep(2000);
      t.expect(true, "가져오면 바로 그 사본의 편집기로 이동");
      const importedId = t.idFromUrl();
      const list = await t.works();
      t.expect(list.length === before + 1, `내 도안 ${before} → ${before + 1}`);
      const imported = list.find((w) => w.id !== g.id && w.title === "점무늬 목도리");
      t.expect(!!imported, "가져온 도안 이름 = 아뜰리에 제목");
      const data = imported && (await t.work(imported.id));
      t.expect(data && JSON.stringify(data.pages[0].cells) === JSON.stringify(g.cells), `가져온 칸이 원본과 같음 (${filled(g.cells)}칸)`);
      t.expect(imported?.id === importedId, "열린 편집기 = 가져온 사본");
      await t.page.goto(detailUrl);
      await t.sleep(1200);
      t.expect(await role(t, "button", "가져옴 · 열기").isVisible(), "다시 오면 '가져옴 · 열기'");
      await role(t, "button", "가져옴 · 열기").click();
      await t.page.waitForURL(/\/maker\//, { timeout: 10000 });
      await t.sleep(800);
      t.expect(t.idFromUrl() === importedId, "다시 누르면 같은 사본을 엶");
      t.expect((await t.works()).length === before + 1, "두 번 눌러도 사본은 1개");
      await t.page.goto(detailUrl);
      await t.sleep(800);
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1200);
      t.expect(await t.has(/점무늬 목도리/), "새로고침 뒤에도 상세가 보임");
      await role(t, "button", "아뜰리에에서 내리기").click();
      await t.sleep(800);
      t.expect(/\/atelier$/.test(t.page.url()), "내린 뒤 목록으로");
      t.expect(await t.has(/아직 올라온 도안이 없어요\./), "내린 뒤 빈 목록");
      t.expect((await t.works()).length === before + 1, "내 도안은 그대로");
    },
  },

  // ---------------- F04 기능 물어보기 ----------------
  {
    id: "F04a",
    feature: "F04 기능 물어보기",
    name: "질문 → 규칙 검색 답 → 바로가기, 못 찾을 때, 새 대화",
    async run(t) {
      await t.goto("/home");
      await footer(t, "기능 물어보기");
      const panel = t.page.getByRole("dialog", { name: "기능 물어보기" });
      t.expect(await panel.isVisible(), "패널 열림");
      t.expect(/AI가 아니에요/.test(await panel.innerText()), "AI가 아니라고 안내");
      const send = panel.getByRole("button", { name: "보내기" });
      t.expect(await send.isDisabled(), "빈 입력이면 보내기 꺼짐");
      const input = panel.getByRole("textbox", { name: "궁금한 기능을 물어보세요" });
      await input.fill("다른 컴퓨터로 옮기고 싶어요");
      await input.press("Enter");
      await t.sleep(300);
      let txt = await panel.innerText();
      t.expect(/모든 도안을 파일로 백업하려면\?/.test(txt), "백업 항목을 찾음");
      t.expect((await input.inputValue()) === "", "보낸 뒤 입력칸 비움");
      await input.fill("오늘 날씨 어때");
      await input.press("Enter");
      await t.sleep(300);
      txt = await panel.innerText();
      t.expect(/딱 맞는 항목을 찾지 못했어요/.test(txt), "못 찾을 때 안내");
      await panel.getByRole("button", { name: "새 대화" }).click();
      txt = await panel.innerText();
      t.expect(!/오늘 날씨 어때/.test(txt) && /새 도안은 어디서 만들어요\?/.test(txt), "새 대화 → 기록 지우고 추천 질문");
      await panel.getByRole("button", { name: "Free와 Pro는 뭐가 달라요?" }).click();
      await t.sleep(300);
      t.expect(/결제를 받지 않고/.test(await panel.innerText()), "추천 질문 답");
      await panel.getByRole("button", { name: "플랜 보기" }).click();
      await t.sleep(400);
      t.expect(await dialog(t).getByText("나에게 맞는 플랜을 선택하세요").isVisible(), "답의 바로가기로 플랜 열림");
      await t.shot("plan-from-help");
      await t.page.keyboard.press("Escape");
      await t.sleep(200);
      t.expect(await panel.isVisible(), "모달을 Esc로 닫아도 패널은 남음");
      await t.page.keyboard.press("Escape");
      await t.sleep(200);
      t.expect(!(await panel.isVisible()), "Esc로 패널 닫힘");
    },
  },
  {
    id: "F04b",
    feature: "F04 기능 물어보기",
    name: "단축키·편집기 질문",
    async run(t) {
      await t.goto("/home");
      await footer(t, "기능 물어보기");
      const panel = t.page.getByRole("dialog", { name: "기능 물어보기" });
      const input = panel.getByRole("textbox", { name: "궁금한 기능을 물어보세요" });
      for (const [q, title] of [
        ["실행 취소 단축키", "실행 취소·다시 실행 단축키"],
        ["사진을 배색 도안으로", "이미지를 배색 도안으로 바꾸려면?"],
        ["교차뜨기", "교차뜨기 기호는 어디 있어요?"],
      ]) {
        await input.fill(q);
        await input.press("Enter");
        await t.sleep(250);
        const answers = await panel.locator("p.t3-bold").allInnerTexts();
        t.expect(answers.at(-1) === title, `"${q}" → "${title}"`);
      }
    },
  },

  // ---------------- F05 공지사항 ----------------
  {
    id: "F05a",
    feature: "F05 공지사항",
    name: "배너 보기 → 해당 공지, 읽음 점, 목록·다른 공지, 새로고침 뒤 유지",
    async run(t) {
      await t.goto("/home");
      t.expect((await t.page.getByRole("button", { name: "공지사항 · 새 공지" }).count()) > 0, "처음엔 새 공지 점");
      await t.page.getByRole("button", { name: "보기", exact: true }).click();
      await t.sleep(400);
      const d = dialog(t);
      t.expect(await d.getByText("[update] 기능 업데이트 안내 (26.10.21)").isVisible(), "배너의 공지가 열림");
      t.expect((await d.locator("li").count()) === 5, "공지 항목 5개");
      t.expect(/^새 기능\s*도움말\s*기능 물어보기:/.test(await d.locator("li").filter({ hasText: "기능 물어보기:" }).innerText()), "기능 물어보기 항목 태그 = 도움말");
      await d.getByRole("button", { name: "목록으로" }).click();
      t.expect((await d.locator("li button").count()) === 3, "공지 목록 3개");
      await d.getByRole("button", { name: /버전 기록과 처음 사용 안내/ }).click();
      t.expect(await d.getByText("대바늘 기호 목록을 328개로 넓혔어요.").isVisible(), "다른 공지 상세");
      await t.page.keyboard.press("Escape");
      await t.sleep(200);
      t.expect((await t.page.getByRole("button", { name: "공지사항 · 새 공지" }).count()) === 0, "읽은 뒤 점 사라짐");
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1200);
      t.expect((await t.page.getByRole("button", { name: "공지사항 · 새 공지" }).count()) === 0, "새로고침 뒤에도 점 없음");
      t.expect((await t.storage("patterners.home.noticesRead")) === "26.10.21", "읽음 저장");
      await footer(t, "공지사항");
      t.expect(await dialog(t).getByText("[안내] 도안은 이 브라우저에 저장돼요").isVisible(), "사이드바에서 목록 열림");
      await t.page.keyboard.press("Escape");
      await t.byLabel("공지 배너 닫기").click();
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1000);
      t.expect(!(await t.has(/새 공지\s/)), "배너 닫기 유지");
    },
  },

  // ---------------- F06 문의하기 ----------------
  {
    id: "F06a",
    feature: "F06 문의하기",
    name: "필수 항목 → mailto → 보낸 문의, 새로고침 뒤 유지",
    async run(t) {
      await t.page.addInitScript(() =>
        document.addEventListener(
          "click",
          (e) => {
            const a = e.target instanceof Element && e.target.closest('a[href^="mailto:"]');
            if (a) {
              e.preventDefault();
              localStorage.setItem("e2e:mailto", a.href);
            }
          },
          true,
        ),
      );
      await t.goto("/home");
      await footer(t, "문의하기");
      const d = dialog(t);
      t.expect(await d.getByText("아직 문의 내역이 없어요.").count() === 0, "새 문의 탭이 먼저");
      await d.getByRole("button", { name: "보내기" }).click();
      t.expect(await d.getByText("필수 항목을 입력해 주세요").isVisible(), "빈 칸 → 필수 항목 안내");
      await d.getByLabel("이메일").fill("not-an-email");
      await d.getByLabel("내용").fill("공유 링크를 QR 코드로도 만들 수 있으면 좋겠어요.");
      await d.getByRole("button", { name: "보내기" }).click();
      t.expect(await d.getByText("필수 항목을 입력해 주세요").isVisible(), "잘못된 이메일 → 안내");
      t.expect((await t.storage("e2e:mailto")) === null, "보내지 않음");
      await d.getByLabel("이름").fill("홍길동");
      await d.getByLabel("이메일").fill("me@example.com");
      t.expect((await d.getByText("필수 항목을 입력해 주세요").count()) === 0, "고치면 안내 사라짐");
      await d.getByRole("button", { name: "기능", exact: true }).click();
      await d.getByRole("button", { name: "보내기" }).click();
      await t.sleep(500);
      const mail = (await t.storage("e2e:mailto")) || "";
      t.expect(mail.startsWith("mailto:"), "메일 앱 열기(mailto:)");
      const body = decodeURIComponent(mail);
      t.expect(/\[패터너스 문의 · 기능\]/.test(body) && /QR 코드로도/.test(body) && /me@example\.com/.test(body), "제목·본문에 유형·내용·이메일");
      t.expect((await d.getByRole("heading", { name: "문의 상세" }).count()) === 1 && (await t.has(/메일 앱으로 보냄/)), "보낸 문의 상세 표시");
      await d.getByRole("button", { name: "목록으로" }).click();
      t.expect(await d.getByRole("button", { name: "보낸 문의 1" }).isVisible(), "보낸 문의 1");
      const saved = JSON.parse((await t.storage("pt:inquiries")) || "[]");
      t.expect(saved.length === 1 && saved[0].category === "feature" && saved[0].name === "홍길동", "로컬 사본 저장");
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1000);
      await footer(t, "문의하기");
      await dialog(t).getByRole("button", { name: "보낸 문의 1" }).click();
      t.expect(await dialog(t).getByText("공유 링크를 QR 코드로도 만들 수 있으면 좋겠어요.").isVisible(), "새로고침 뒤에도 보낸 문의");
    },
  },

  // ---------------- F07 플랜 구매 ----------------
  {
    id: "F07a",
    feature: "F07 플랜 구매",
    name: "플랜 4개·가격, 구매 꺼짐, 카드 입력 없음, 기업 문의로 이동",
    async run(t) {
      await t.goto("/home");
      await footer(t, "플랜 구매");
      const d = dialog(t);
      const plans = await d.locator('li[aria-label$="플랜"]').allInnerTexts();
      t.expect(plans.length === 4, "플랜 4개");
      t.expect(/₩0/.test(plans[0]) && /₩8,900/.test(plans[1]) && /₩14,900/.test(plans[2]) && /맞춤 견적/.test(plans[3]), "가격 ₩0 / ₩8,900 / ₩14,900 / 맞춤 견적");
      t.expect(/결제를 받지 않아요/.test(await d.innerText()), "결제 안 받는다는 안내");
      const buy = d.getByRole("button", { name: "구독 결제 준비 중" });
      t.expect((await buy.count()) === 1 && (await buy.isDisabled()), "구매 버튼 꺼짐");
      t.expect((await d.locator("input, select, textarea").count()) === 0, "카드 입력 없음");
      await buy.click({ force: true });
      t.expect(await d.isVisible(), "꺼진 버튼은 아무 일 없음");
      await d.getByRole("button", { name: "문의하기" }).click();
      await t.sleep(400);
      t.expect(await dialog(t).getByRole("heading", { name: "문의하기" }).isVisible(), "기업 → 문의하기");
      await t.page.keyboard.press("Escape");
      await footer(t, "플랜 구매");
      await dialog(t).getByRole("button", { name: "작업으로 돌아가기" }).first().click();
      await t.sleep(300);
      t.expect((await dialog(t).count()) === 0, "작업으로 돌아가기 → 닫힘");
    },
  },

  // ---------------- F08 계정 설정 ----------------
  {
    id: "F08a",
    feature: "F08 계정 설정",
    name: "프로필: 잘못된 닉네임, 저장, 새로고침 뒤 유지",
    async run(t) {
      await t.goto("/home");
      await footer(t, "계정 설정");
      const d = dialog(t);
      const nick = d.getByPlaceholder("예: 뜨개하는 곰");
      await nick.fill("a");
      await d.getByRole("button", { name: "저장", exact: true }).click();
      t.expect(/2–24자/.test(await d.locator(".text-fg-critical").first().innerText().catch(() => "")), "1글자 → 오류");
      t.expect((await t.storage("pt:profile")) === null, "저장 안 됨");
      await nick.fill("뜨개쟁이");
      await d.getByRole("radio", { name: "색 3" }).click();
      await d.getByRole("button", { name: "저장", exact: true }).click();
      await t.sleep(300);
      t.expect(await t.has(/프로필이 저장됐어요/), "저장 토스트");
      const p = JSON.parse(await t.storage("pt:profile"));
      t.expect(p.nickname === "뜨개쟁이" && /carrot-600/.test(p.color), "닉네임·색 저장");
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1000);
      await footer(t, "계정 설정");
      t.expect((await dialog(t).getByPlaceholder("예: 뜨개하는 곰").inputValue()) === "뜨개쟁이", "새로고침 뒤 닉네임");
      t.expect((await dialog(t).getByRole("radio", { name: "색 3" }).getAttribute("aria-checked")) === "true", "새로고침 뒤 색");
      await nick.fill("다른이름");
      await dialog(t).getByRole("button", { name: "닫기" }).last().click();
      await footer(t, "계정 설정");
      t.expect((await dialog(t).getByPlaceholder("예: 뜨개하는 곰").inputValue()) === "뜨개쟁이", "저장 안 하고 닫으면 원래대로");
    },
  },
  {
    id: "F08b",
    feature: "F08 계정 설정",
    name: "백업 받기 → 전체 삭제 → 그 파일로 복원 → 도안이 돌아옴",
    async run(t) {
      const fs = await import("node:fs");
      const g = await gridWithCells(t);
      await t.create("코바늘");
      const all = await t.works();
      t.expect(all.length === 2, "도안 2개");
      await t.goto("/home");
      await footer(t, "계정 설정");
      t.expect(await dialog(t).getByText(/도안 2개가 있어요/).isVisible(), "도안 수 표시");
      const [dl] = await Promise.all([t.page.waitForEvent("download"), dialog(t).getByRole("button", { name: "모든 도안 백업" }).click()]);
      const file = `${OUT}/F08b-backup.json`;
      await dl.saveAs(file);
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      t.expect(/^patterners-backup-\d{8}\.json$/.test(dl.suggestedFilename()), "파일 이름");
      t.expect(json.format === "patterners-backup" && json.works.length === 2, "백업에 도안 2개");
      t.expect(JSON.stringify(json.works.find((w) => w.id === g.id).data.pages[0].cells) === JSON.stringify(g.cells), "백업에 칸 데이터");
      await dialog(t).getByRole("button", { name: "삭제", exact: true }).click(); // confirm accepted by the runner
      await t.page.waitForURL(/\/home/);
      await t.sleep(1500);
      t.expect((await t.works()).length === 0, "전체 삭제 → 도안 0개");
      t.expect(await t.has(/아직 파일이 없어요\./), "홈 빈 상태");
      await footer(t, "계정 설정");
      fs.writeFileSync(`${OUT}/F08b-bad.json`, '{"hello":1}');
      await t.page.getByLabel("백업 파일 선택").setInputFiles(`${OUT}/F08b-bad.json`);
      await t.sleep(600);
      t.expect(await t.has(/패터너스 백업 파일이 아니에요/), "잘못된 파일 → 오류");
      await t.page.getByLabel("백업 파일 선택").setInputFiles(file);
      await t.sleep(800);
      t.expect(await t.has(/복원했어요 · 새로 2개, 갱신 0개/), "복원 결과 토스트");
      const back = await t.works();
      t.expect(back.length === 2 && back.some((w) => w.id === g.id), "도안 2개, 같은 id");
      t.expect(JSON.stringify((await t.work(g.id)).pages[0].cells) === JSON.stringify(g.cells), "칸이 그대로");
      await t.page.getByLabel("백업 파일 선택").setInputFiles(file);
      await t.sleep(800);
      t.expect(await t.has(/새로 0개, 갱신 0개, 그대로 2개/), "다시 복원 → 그대로 2개 (중복 없음)");
      t.expect((await t.works()).length === 2, "중복 생기지 않음");
      await t.page.keyboard.press("Escape");
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1200);
      t.expect((await t.page.locator("main li, ul.grid > li").count()) >= 2 || (await t.has(/새 배색·방안 도안 1/)), "새로고침 뒤 홈에 도안");
      await t.page.goto(`${t.base}/maker/${g.id}`);
      await t.sleep(2500);
      t.expect(JSON.stringify((await t.work(g.id)).pages[0].cells) === JSON.stringify(g.cells), "복원한 도안이 편집기에서 열리고 칸 유지");
      await t.shot("restored-editor");
    },
  },
  {
    id: "F08c",
    feature: "F08 계정 설정",
    name: "모든 로컬 데이터 삭제: 도안·아뜰리에·프로필·알림이 모두 지워짐",
    async run(t) {
      await gridWithCells(t, 3);
      await publish(t, "지울 도안");
      await t.goto("/home");
      await footer(t, "계정 설정");
      await dialog(t).getByPlaceholder("예: 뜨개하는 곰").fill("지울사람");
      await dialog(t).getByRole("button", { name: "저장", exact: true }).click();
      const keysBefore = await t.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pt:")));
      t.expect(["pt:works", "pt:atelier", "pt:profile", "pt:notifications"].every((k) => keysBefore.includes(k)), "삭제 전 데이터 있음");
      await dialog(t).getByRole("button", { name: "삭제", exact: true }).click();
      await t.page.waitForURL(/\/home/);
      await t.sleep(1500);
      const keysAfter = await t.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pt:")));
      t.expect(keysAfter.length === 0, `pt:* 키 0개 (남은 것: ${keysAfter.join(",")})`);
      t.expect(await t.has(/아직 파일이 없어요\./), "홈 빈 상태");
      await t.goto("/atelier");
      t.expect(await t.has(/아직 올라온 도안이 없어요\./), "아뜰리에도 비었음");
    },
  },

  // ---------------- F09 로그아웃 ----------------
  {
    id: "F09a",
    feature: "F09 로그아웃",
    name: "로그아웃 → 처음 화면, 프로필만 지우고 도안은 남김",
    async run(t) {
      await t.create("대바늘");
      await t.goto("/home");
      await footer(t, "계정 설정");
      await dialog(t).getByPlaceholder("예: 뜨개하는 곰").fill("나가는사람");
      await dialog(t).getByRole("button", { name: "저장", exact: true }).click();
      await t.page.keyboard.press("Escape");
      t.expect((await t.storage("pt:session")) === "1", "세션 표시");
      await footer(t, "로그아웃");
      await t.page.waitForURL(new RegExp(`^${t.base}/?$`), { timeout: 8000 });
      t.expect(true, "처음 화면(/)으로 이동");
      t.expect((await t.storage("pt:profile")) === null && (await t.storage("pt:session")) === null, "프로필·세션 지움");
      t.expect((await t.works()).length === 1, "도안은 그대로 1개");
      await t.goto("/home");
      await footer(t, "계정 설정");
      t.expect((await dialog(t).getByPlaceholder("예: 뜨개하는 곰").inputValue()) === "", "다시 열면 닉네임 비어 있음");
    },
  },

  // ---------------- F10 알림 ----------------
  {
    id: "F10a",
    feature: "F10 알림",
    name: "빈 알림 → 아뜰리에 올리기 알림 → 눌러서 이동 → 모두 읽음 유지",
    async run(t) {
      await t.goto("/home");
      await t.byLabel("알림").click();
      t.expect(await t.page.getByRole("dialog", { name: "알림" }).getByText("새로운 알림이 없어요").isVisible(), "빈 상태");
      t.expect(await t.page.getByRole("button", { name: "모두 읽음" }).isDisabled(), "모두 읽음 꺼짐");
      await gridWithCells(t, 3);
      await publish(t, "알림 확인용");
      await t.goto("/home");
      t.expect(await t.byLabel("알림 · 읽지 않음 1").isVisible(), "읽지 않음 1 표시");
      await t.byLabel("알림 · 읽지 않음 1").click();
      const pop = t.page.getByRole("dialog", { name: "알림" });
      t.expect(await pop.getByText("‘알림 확인용’ 도안을 아뜰리에에 올렸어요").isVisible(), "알림 제목");
      await t.shot("bell");
      await pop.getByText("‘알림 확인용’ 도안을 아뜰리에에 올렸어요").click();
      await t.page.waitForURL(/\/atelier\?id=/);
      await t.sleep(800);
      t.expect(await t.has(/알림 확인용/), "알림을 누르면 아뜰리에 상세로");
      await t.goto("/home");
      t.expect(await t.byLabel("알림").isVisible(), "누른 알림은 읽음");
      // a second notification, then 모두 읽음
      await footer(t, "문의하기");
      await dialog(t).getByLabel("이메일").fill("me@example.com");
      await dialog(t).getByLabel("내용").fill("알림 테스트");
      await t.page.evaluate(() => document.addEventListener("click", (e) => e.target instanceof Element && e.target.closest('a[href^="mailto:"]') && e.preventDefault(), true));
      await dialog(t).getByRole("button", { name: "보내기" }).click();
      await t.page.keyboard.press("Escape");
      await t.sleep(300);
      await t.byLabel("알림 · 읽지 않음 1").click();
      t.expect((await pop.locator("li").count()) === 2, "알림 2개");
      await pop.getByRole("button", { name: "모두 읽음" }).click();
      t.expect(await t.byLabel("알림").isVisible(), "모두 읽음 → 점 사라짐");
      await t.page.reload({ waitUntil: "domcontentloaded" });
      await t.sleep(1000);
      t.expect(await t.byLabel("알림").isVisible(), "새로고침 뒤에도 읽음");
      const list = JSON.parse(await t.storage("pt:notifications"));
      t.expect(list.length === 2 && list.every((n) => n.read), "저장된 알림 2개 모두 읽음");
    },
  },

  // ---------------- F27 아뜰리에에 올리기 (배색·방안) ----------------
  {
    id: "F27a",
    feature: "F27 아뜰리에에 올리기",
    name: "제목 비우면 막힘, 취소, 올리기 → /atelier에 표시 + 알림",
    async run(t) {
      const g = await gridWithCells(t);
      await t.byLabel("아뜰리에에 올리기").click();
      await t.sleep(400);
      let d = dialog(t);
      t.expect((await d.getByPlaceholder("예: 데일리 크롭 가디건").inputValue()) === g.title, "제목 기본값 = 도안 이름");
      t.expect((await d.locator('img[alt="썸네일 미리보기"]').count()) === 1, "썸네일 미리보기");
      t.expect(/이 브라우저에만 저장/.test(await d.innerText()), "로컬 안내");
      await d.getByRole("button", { name: "취소" }).click();
      await t.sleep(200);
      t.expect((await t.storage("pt:atelier")) === null, "취소 → 올라가지 않음");
      await t.byLabel("아뜰리에에 올리기").click();
      await t.sleep(300);
      d = dialog(t);
      await d.getByPlaceholder("예: 데일리 크롭 가디건").fill("   ");
      await d.getByRole("button", { name: "올리기", exact: true }).click();
      t.expect(await d.getByText("제목을 입력해 주세요.").isVisible(), "빈 제목 → 안내");
      await d.getByRole("button", { name: "취소" }).click();
      await publish(t, "올린 배색", "설명입니다");
      t.expect(await t.has(/아뜰리에에 올렸어요/), "올리기 토스트");
      const list = JSON.parse(await t.storage("pt:atelier"));
      t.expect(list.length === 1 && list[0].title === "올린 배색" && list[0].craft === "grid", "아뜰리에 저장 1건");
      t.expect(JSON.stringify(list[0].data.pages[0].cells) === JSON.stringify(g.cells), "올린 칸 = 편집기 칸");
      t.expect(list[0].meta.category === "scarf_shawl" && list[0].meta.license === "small_batch" && list[0].meta.techniques.join() === "colorwork", "태그 저장");
      await t.page.getByRole("button", { name: "보기", exact: true }).click();
      await t.page.waitForURL(/\/atelier\?id=/);
      await t.sleep(800);
      t.expect(await t.has(/올린 배색/) && (await t.has(/설명입니다/)), "토스트 보기 → 상세");
      await t.goto("/atelier");
      t.expect(await t.has(/올린 배색/), "/atelier 목록에 표시");
      await t.goto("/home");
      await t.byLabel("알림 · 읽지 않음 1").click();
      t.expect(await t.page.getByText("‘올린 배색’ 도안을 아뜰리에에 올렸어요").isVisible(), "알림 생김");
    },
  },

  // ---------------- F28 공유하기 ----------------
  {
    id: "F28a",
    feature: "F28 공유하기",
    name: "배색·방안: 링크 복사 → 새 브라우저에서 보기 → 내 도안으로 복제 → 같은 칸",
    async run(t) {
      const g = await gridWithCells(t, 8);
      await t.byLabel("공유하기").click();
      await t.sleep(800);
      const d = dialog(t);
      t.expect(/서버에 올리지 않아서/.test(await d.innerText()), "링크 안 저장 안내");
      await d.getByRole("button", { name: "링크 복사" }).click();
      await t.sleep(300);
      t.expect(await t.has(/공유 링크를 복사했어요/), "복사 토스트");
      const link = await t.page.evaluate(() => navigator.clipboard.readText());
      t.expect(link.startsWith(`${t.base}/share#`), "링크 형식 /share#…");
      t.expect((await d.getByLabel("공유 링크").inputValue()) === link, "입력칸 = 복사한 링크");
      const [popup] = await Promise.all([t.ctx.waitForEvent("page"), d.getByRole("button", { name: "보기 열기" }).click()]);
      await popup.waitForLoadState("domcontentloaded");
      await t.sleep(1200);
      t.expect(/읽기 전용/.test(await popup.evaluate(() => document.body.innerText)), "보기 열기 → 새 탭에 보기");
      await popup.close();
      const r = await cloneFromLink(t, link, "F28a");
      t.expect(r.errors.length === 0, "보기 페이지 오류 없음");
      t.expect(r.text.includes(g.title) && /읽기 전용/.test(r.text) && /40코 × 30단/.test(r.text), "보기: 제목·읽기 전용·크기");
      t.expect(r.img > 0, "보기: 도안 그림");
      t.expect(r.works.length === 1 && r.works[0].title === `${g.title} (사본)`, "새 브라우저에 사본 1개");
      t.expect(r.data && JSON.stringify(r.data.pages[0].cells) === JSON.stringify(g.cells), `편집기에서 같은 칸 (${filled(g.cells)}칸)`);
      t.expect(r.guardLabel && r.reopenId === r.id && r.worksAfter === 1, "같은 링크 다시 → '복제됨 · 열기'가 같은 사본을 열고 중복 없음");
      // edge: a cut-off link
      await t.page.goto(link.slice(0, link.length - 12));
      await t.sleep(1200);
      t.expect(await t.has(/공유 도안을 찾을 수 없어요\./), "잘린 링크 → 찾을 수 없어요");
    },
  },
  {
    id: "F28b",
    feature: "F28 공유하기",
    name: "코바늘: /share 링크 → 보기 → 복제 → 코바늘 편집기에서 같은 기호",
    async run(t) {
      // The crochet editor has no share button yet; build the link in-page with lib/share's encoding.
      await t.create("코바늘");
      const id = t.idFromUrl();
      const items = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return { id: `s${i}`, type: "stitch", symbol: i % 2 ? "sc" : "dc", x: Math.round(Math.cos(a) * 80), y: Math.round(Math.sin(a) * 80), rotation: Math.round((a * 180) / Math.PI + 90) };
      });
      const base = await t.work(id);
      const data = { ...base, layers: [{ id: "l1", name: "레이어 1", visible: true, items }], activeLayerId: "l1" };
      const link = await shareLinkInPage(t, { v: 1, t: "원형 모티브", c: "crochet", d: data, at: Date.now() });
      const r = await cloneFromLink(t, link, "F28b");
      t.expect(r.errors.length === 0, "오류 없음");
      t.expect(/원형 모티브/.test(r.text) && /기호\s*8개/.test(r.text), "보기: 제목·기호 8개");
      t.expect(r.img > 0, "보기: 도안 그림");
      t.expect(r.works.length === 1 && r.works[0].craft === "crochet", "코바늘 사본 1개");
      t.expect(r.guardLabel && r.reopenId === r.id && r.worksAfter === 1, "다시 누르면 같은 사본, 중복 없음");
      const got = r.data?.layers?.flatMap((l) => l.items).filter((i) => i.type === "stitch") ?? [];
      t.expect(got.length === 8 && got.every((s, i) => s.symbol === items[i].symbol && s.x === items[i].x && s.y === items[i].y), "편집기 저장본의 기호 8개가 같음");
    },
  },
  {
    id: "F28c",
    feature: "F28 공유하기",
    name: "대바늘: /share 링크 → 보기 → 복제 → 대바늘 편집기에서 같은 칸",
    async run(t) {
      await t.create("대바늘");
      const id = t.idFromUrl();
      const cols = 10;
      const rows = 8;
      const cells = Array.from({ length: cols * rows }, (_, i) => (i % 3 === 0 ? { symbol: "k_purl" } : i % 5 === 0 ? { symbol: "k_knit", color: "#c47a5c" } : { symbol: "k_knit" }));
      const base = await t.work(id);
      const data = { ...base, grids: [{ id: "g1", name: "차트 1", x: 0, y: 0, cols, rows, cells, visible: true }], activeGridId: "g1" };
      const link = await shareLinkInPage(t, { v: 1, t: "고무단 차트", c: "knitting", d: data, at: Date.now() });
      const r = await cloneFromLink(t, link, "F28c");
      t.expect(r.errors.length === 0, "오류 없음");
      t.expect(/고무단 차트/.test(r.text) && /10코 × 8단/.test(r.text), "보기: 제목·차트 크기");
      t.expect(r.img > 0, "보기: 도안 그림");
      t.expect(r.works.length === 1 && r.works[0].craft === "knitting", "대바늘 사본 1개");
      t.expect(r.guardLabel && r.reopenId === r.id && r.worksAfter === 1, "다시 누르면 같은 사본, 중복 없음");
      const g = r.data?.grids?.[0];
      t.expect(!!g && g.cols === cols && g.rows === rows && JSON.stringify(g.cells) === JSON.stringify(cells), "편집기 저장본의 칸 80개가 같음");
    },
  },
];
