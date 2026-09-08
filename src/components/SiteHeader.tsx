import Image from "next/image";
import Link from "next/link";

export function WingLogo({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/fav-wing-logo.png"
      alt="FAV 마젠타 날개 로고"
      width={size}
      height={size}
      priority
      className="object-contain"
    />
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand-lockup">
        <WingLogo size={36} />
        <span className="brand-word">FAV</span>
      </Link>
      <nav className="site-nav">
        <Link href="/analyze">전력분석</Link>
        <Link href="/editor">영상편집</Link>
      </nav>
    </header>
  );
}
