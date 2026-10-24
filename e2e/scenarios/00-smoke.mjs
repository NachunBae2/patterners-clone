export const scenarios = [
  {
    id: "S00-home",
    feature: "홈",
    name: "홈이 열리고 새 도안 버튼이 있다",
    async run(t) {
      await t.goto("/home");
      t.expect(await t.has(/모든 파일/), "홈 제목 '모든 파일'");
      t.expect(await t.has(/코바늘/), "새 도안 버튼 '코바늘'");
    },
  },
];
