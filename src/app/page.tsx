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
          포인트 스카우트 타임스탬프로 어긋남 없는 컷을 만들고, 전력분석·하이라이트·보관함까지
          이어서 씁니다.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/scout">
            스카우트 시작
          </Link>
          <Link className="btn ghost" href="/bench">
            벤치 모드
          </Link>
          <Link className="btn ghost" href="/analyze">
            전력분석
          </Link>
          <Link className="btn ghost" href="/editor">
            영상 편집
          </Link>
        </div>
      </div>
    </section>
  );
}
