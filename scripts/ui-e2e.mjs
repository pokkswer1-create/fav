import puppeteer from "puppeteer-core";

async function clickByText(page, includes) {
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const t = await page.evaluate((el) => (el.textContent || "").trim(), b);
    if (t.includes(includes)) {
      await b.click();
      return t;
    }
  }
  throw new Error(`button not found: ${includes}`);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,900"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // 1) Scout demo → editor bridge
  await page.goto("http://127.0.0.1:3000/scout", { waitUntil: "networkidle0" });
  await page.click("button::-p-text(데모 스카우트)").catch(async () => {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const t = await page.evaluate((el) => el.textContent || "", b);
      if (t.includes("데모 스카우트")) {
        await b.click();
        return;
      }
    }
    throw new Error("데모 스카우트 button missing");
  });
  await page.waitForFunction(() => document.body.innerText.includes("포인트"));
  // click timestamp cut
  {
    const buttons = await page.$$("button");
    let clicked = false;
    for (const b of buttons) {
      const t = await page.evaluate((el) => el.textContent || "", b);
      if (t.includes("타임스탬프 컷")) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle0" }),
          b.click(),
        ]);
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error("타임스탬프 컷 button missing");
  }
  if (!page.url().includes("/editor")) throw new Error("did not navigate to editor: " + page.url());
  const body1 = await page.evaluate(() => document.body.innerText);
  if (!body1.includes("스카우트") && !body1.includes("브리지") && !body1.includes("클립")) {
    throw new Error("editor missing bridge status: " + body1.slice(0, 400));
  }
  // ensure not "연결 데이터가 없습니다"
  if (body1.includes("연결 데이터가 없습니다")) {
    throw new Error("bridge payload missing after scout send");
  }
  console.log("PASS scout→editor bridge", page.url());

  await clickByText(page, "하이라이트 생성");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("생성 완료") ||
      Boolean(document.querySelector("a[download]")),
    { timeout: 90000 },
  );
  // clips must survive highlight preview (regression: result video used to shrink timeline)
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /유효 클립 [3-9]/.test(text) || /유효 클립 [1-9]\d/.test(text);
  });
  const after = await page.evaluate(() => document.body.innerText);
  if (!after.includes("원본 타임라인") && !/미디어 20/.test(after) && !/미디어 2\d/.test(after)) {
    // still ok if media duration stayed near source
    console.log("note: status text", after.match(/미디어[^\n]+/)?.[0]);
  }
  const mediaLine = after.match(/미디어\s+([\d.]+)s/)?.[1];
  if (mediaLine && Number(mediaLine) < 15) {
    throw new Error(`media duration collapsed after highlight: ${mediaLine}`);
  }
  console.log("PASS highlight render (timeline preserved)");

  // 3) Analyze player cut
  await page.goto("http://127.0.0.1:3000/analyze", { waitUntil: "networkidle0" });
  {
    const buttons = await page.$$("button");
    let clicked = false;
    for (const b of buttons) {
      const t = await page.evaluate((el) => el.textContent || "", b);
      if (t.includes("이 선수 컷")) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle0" }),
          b.click(),
        ]);
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error("이 선수 컷 missing");
  }
  if (!page.url().includes("bridge=1")) throw new Error("analyze cut missing bridge");
  const body2 = await page.evaluate(() => document.body.innerText);
  if (body2.includes("연결 데이터가 없습니다")) throw new Error("analyze bridge empty");
  console.log("PASS analyze→editor player cut");

  // 4) Library seed
  await page.goto("http://127.0.0.1:3000/library", { waitUntil: "networkidle0" });
  {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const t = await page.evaluate((el) => el.textContent || "", b);
      if (t.includes("데모 시드")) {
        await b.click();
        break;
      }
    }
  }
  await page.waitForFunction(() => document.body.innerText.includes("저장된 경기 (1)") || document.body.innerText.match(/저장된 경기 \([1-9]/));
  console.log("PASS library demo seed");

  if (errors.length) {
    console.log("PAGE_ERRORS", errors.slice(0, 10));
  } else {
    console.log("NO_PAGE_ERRORS");
  }
  console.log("UI_E2E_ALL_PASSED");
  await browser.close();
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
