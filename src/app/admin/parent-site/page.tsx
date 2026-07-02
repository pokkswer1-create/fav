import { CopyShareUrl } from "@/components/copy-share-url";
import { getDeployedSiteBase, getParentsPublicUrl } from "@/lib/site-url";
import Link from "next/link";

export default function ParentSiteAdminPage() {
  const siteBase = getDeployedSiteBase();
  const parentsPublicUrl = getParentsPublicUrl();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">학부모 사이트</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          학부모 전용 공개 페이지(<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/parents</code>)를
          미리 보고, 수강료·안내 문구·공지를 수정합니다. 학부모에게는 이 주소만 안내하세요.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/parents"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-zinc-200 p-5 transition hover:border-sky-500 hover:bg-sky-50/50 dark:border-zinc-800 dark:hover:border-sky-600 dark:hover:bg-sky-950/30"
        >
          <h2 className="font-semibold text-sky-700 dark:text-sky-300">공개 페이지 미리보기</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            학부모가 보는 화면을 새 탭에서 엽니다.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-sky-600 underline dark:text-sky-400">
            /parents 열기 ↗
          </span>
        </Link>

        <Link
          href="/admin/parent-settings"
          className="rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-300 dark:hover:bg-zinc-900/40"
        >
          <h2 className="font-semibold">콘텐츠·공지 관리</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            준비물, 셔틀, 결제·보강·환불 안내, 수강료 JSON, 공지 등록
          </p>
          <span className="mt-3 inline-block text-sm font-medium underline opacity-90">
            설정으로 이동 →
          </span>
        </Link>

        <Link
          href="/admin/applications"
          className="rounded-xl border border-zinc-200 p-5 transition hover:border-emerald-600 hover:bg-emerald-50/50 dark:border-zinc-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
        >
          <h2 className="font-semibold text-emerald-800 dark:text-emerald-200">수업 신청 목록</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            학부모 사이트에서 접수된 체험·정규·대표팀·보강 신청을 확인합니다.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
            신청 관리 →
          </span>
        </Link>
      </section>

      <section className="rounded-xl border border-dashed border-sky-300 bg-sky-50/90 p-5 dark:border-sky-800 dark:bg-sky-950/40">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">다른 폰·PC에서 테스트 / 학부모 공유</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Vercel에 배포돼 있으면 아래 주소는 <strong>인터넷만 되면 어디서나</strong> 열립니다. 카톡·문자로 보내
          테스트하세요. 고정 주소를 쓰려면 환경 변수{" "}
          <code className="rounded bg-white/90 px-1 dark:bg-zinc-800">NEXT_PUBLIC_SITE_URL</code>에 루트 URL을
          넣으면 그 값이 우선합니다.
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/90">
          Vercel 프로젝트에서 <strong>Deployment Protection</strong>(접속 비밀번호)이 켜져 있으면 외부에서 막힙니다.
          공개 테스트 시 끄거나 허용 목록을 설정하세요.
        </p>
        {parentsPublicUrl ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={parentsPublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-sky-700 underline hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
            >
              {parentsPublicUrl}
            </a>
            <CopyShareUrl url={parentsPublicUrl} label="링크 복사" />
          </div>
        ) : (
          <p className="mt-3 break-all font-mono text-sm text-zinc-500">
            로컬만 실행 중이면 여기 URL이 비어 있습니다. Vercel에 배포하거나{" "}
            <code className="rounded bg-white px-1 dark:bg-zinc-800">NEXT_PUBLIC_SITE_URL</code>을 설정하세요.
          </p>
        )}
        {siteBase ? (
          <p className="mt-3 text-xs text-zinc-500">
            사이트 루트:{" "}
            <span className="break-all font-mono text-zinc-700 dark:text-zinc-300">{siteBase}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
