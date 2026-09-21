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
        <p className="lede">
          처음이면 <strong>영상편집</strong>에서 «데모로 한 번 돌려보기»만 누르면 됩니다. 영상만
          올려도 자동으로 잘리지 않아요.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/editor">
            영상편집 · 데모 돌려보기
          </Link>
          <Link className="btn ghost" href="/analyze">
            전력분석
          </Link>
          <Link className="btn ghost" href="/scout">
            스카우트
          </Link>
        </div>
        <ol className="home-steps">
          <li>
            <strong>영상편집</strong> — 데모 버튼 → 하이라이트 MP4
          </li>
          <li>
            <strong>스카우트</strong> — 득점 날 때만 찍기 (선택)
          </li>
          <li>
            <strong>전력분석</strong> — 데모로 리포트 보기
          </li>
        </ol>
      </div>
    </section>
  );
}
