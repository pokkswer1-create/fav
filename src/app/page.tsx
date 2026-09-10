import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero-visual" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-brand">
          <Image
            src="/fav-wing-logo.png"
            alt="FAV 마젠타 날개 로고"
            width={88}
            height={88}
            priority
          />
          <strong>FAV</strong>
        </div>
        <h1>경기 넣으면 전력, 영상은 컷.</h1>
        <p className="lede">처음이면 전력분석에서 ‘데모로 해보기’만 누르면 됩니다.</p>
        <div className="cta-row">
          <Link className="btn primary" href="/analyze">
            전력분석 시작
          </Link>
          <Link className="btn ghost" href="/scout">
            스카우트
          </Link>
          <Link className="btn ghost" href="/editor">
            영상 편집
          </Link>
        </div>
        <ol className="home-steps">
          <li>
            <strong>전력분석</strong> — 데모로 결과 보기
          </li>
          <li>
            <strong>스카우트</strong> — 경기 중 득점·코딩 기록
          </li>
          <li>
            <strong>영상편집</strong> — 타임스탬프로 하이라이트
          </li>
        </ol>
      </div>
    </section>
  );
}
