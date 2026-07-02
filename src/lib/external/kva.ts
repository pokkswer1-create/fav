type ScrapedNotice = {
  title: string;
  link: string;
  originalDate: string | null;
  author: string | null;
};

const DEFAULT_KVA_NOTICE_URL =
  "https://www.kva.or.kr/user/usr11Board/usrBoard.do?p_idNm=notice";
const KVA_NOTICE_PATH_KEYWORD = "/user/usr11Board/";
const KVA_NOTICE_QUERY_KEYWORD = "p_idNm=notice";

function toAbsoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDateFromText(text: string): string | null {
  const match = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function scrapeKVANotice(): Promise<ScrapedNotice[]> {
  const targetUrl = process.env.KVA_NOTICE_URL ?? DEFAULT_KVA_NOTICE_URL;
  const response = await fetch(targetUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`KVA 요청 실패: ${response.status}`);
  }

  const html = await response.text();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: ScrapedNotice[] = [];
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) && results.length < 30) {
    const href = match[1];
    const title = stripHtml(match[2]);
    if (!title || title.length < 4) continue;
    if (!/(공지|notice|알림|협회|세미나|교육)/i.test(title)) continue;
    if (!href || href.startsWith("javascript:")) continue;

    const absoluteLink = toAbsoluteUrl(targetUrl, href);
    // KVA 공지 게시판(notice) 링크만 허용
    if (
      !absoluteLink.includes(KVA_NOTICE_PATH_KEYWORD) ||
      !absoluteLink.includes(KVA_NOTICE_QUERY_KEYWORD)
    ) {
      continue;
    }

    const block = html.slice(Math.max(0, match.index - 300), Math.min(html.length, match.index + 300));
    const originalDate = parseDateFromText(block) ?? parseDateFromText(title);
    const authorMatch = block.match(/(작성자|등록자|author)\s*[:：]?\s*([^\s<]{2,30})/i);

    results.push({
      title,
      link: absoluteLink,
      originalDate,
      author: authorMatch?.[2] ?? null,
    });
  }

  const deduped = new Map<string, ScrapedNotice>();
  for (const item of results) deduped.set(item.link, item);
  return Array.from(deduped.values());
}
