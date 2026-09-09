import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

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

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("SHOT", file);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,900"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "01-home.png");

  await page.goto("http://127.0.0.1:3000/scout", { waitUntil: "networkidle0" });
  await clickByText(page, "데모 스카우트");
  await page.waitForFunction(() => document.body.innerText.includes("2.8"));
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "02-scout-demo.png");

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    clickByText(page, "타임스탬프 컷"),
  ]);
  await page.waitForFunction(() => !document.body.innerText.includes("연결 데이터가 없습니다"));
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "03-editor-bridge.png");

  await clickByText(page, "하이라이트 생성");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("생성 완료") ||
      Boolean(document.querySelector("a[download]")),
    { timeout: 90000 },
  );
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "04-highlight-done.png");

  await page.goto("http://127.0.0.1:3000/library", { waitUntil: "networkidle0" });
  await clickByText(page, "데모 시드");
  await page.waitForFunction(() => /저장된 경기 \([1-9]/.test(document.body.innerText));
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, "05-library-seeded.png");

  console.log("DEMO_SHOTS_OK");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
