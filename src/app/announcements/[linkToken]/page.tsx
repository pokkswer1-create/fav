import { getSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

type PageProps = {
  params: Promise<{ linkToken: string }>;
};

export default async function AnnouncementPublicPage({ params }: PageProps) {
  const { linkToken } = await params;
  const supabase = getSupabaseServer();

  const { data: linkData } = await supabase
    .from("class_application_links")
    .select("*")
    .eq("link_token", linkToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!linkData) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">안내를 찾을 수 없습니다.</h1>
        <p className="mt-2 text-sm opacity-75">링크가 만료되었거나 잘못되었습니다.</p>
      </main>
    );
  }

  if (linkData.expiry_date && new Date(linkData.expiry_date) < new Date()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">신청 기간이 종료되었습니다.</h1>
      </main>
    );
  }

  const { data: announcement } = await supabase
    .from("class_announcements")
    .select("*")
    .eq("id", linkData.announcement_id)
    .maybeSingle();

  if (!announcement) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">안내를 불러올 수 없습니다.</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="border-b border-zinc-200 pb-4 text-center dark:border-zinc-800">
        <h1 className="text-3xl font-semibold">{announcement.title}</h1>
        <p className="mt-2 text-sm opacity-70">
          {announcement.class_name} · 업데이트 {new Date(announcement.updated_at).toLocaleDateString("ko-KR")}
        </p>
      </header>

      <article className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="prose prose-zinc max-w-none whitespace-pre-wrap dark:prose-invert">
          {announcement.content}
        </div>

        {announcement.navercafe_url ? (
          <p className="mt-4 text-sm">
            네이버 카페:{" "}
            <a className="underline" href={announcement.navercafe_url} target="_blank" rel="noreferrer">
              {announcement.navercafe_url}
            </a>
          </p>
        ) : null}
        {announcement.address ? <p className="mt-2 text-sm">주소: {announcement.address}</p> : null}
        {announcement.map_link ? (
          <p className="mt-2 text-sm">
            지도:{" "}
            <a className="underline" href={announcement.map_link} target="_blank" rel="noreferrer">
              지도 열기
            </a>
          </p>
        ) : null}
      </article>

      <div className="text-center">
        <a
          href={linkData.external_form_url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded bg-blue-600 px-6 py-3 font-medium text-white"
        >
          신청서 작성하기
        </a>
      </div>

      <div className="text-center text-xs opacity-70">
        <Link href="/">홈으로</Link>
      </div>
    </main>
  );
}
