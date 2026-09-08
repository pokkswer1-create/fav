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
          배구 경기 기록을 전력분석 리포트로 바꾸고, 킬·블로킹·에이스 구간을 하이라이트 영상으로
          붙입니다.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/analyze">
            전력분석 시작
          </Link>
          <Link className="btn ghost" href="/editor">
            영상 편집하기
          </Link>
        </div>
      </div>
    </section>
  );
}
