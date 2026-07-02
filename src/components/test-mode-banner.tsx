/** NEXT_PUBLIC_BYPASS_AUTH=true 일 때만 표시 (빌드 시 값이 박힘) */
export function TestModeBanner() {
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH !== "true") {
    return null;
  }
  return (
    <div className="border-b border-amber-700 bg-amber-400 px-3 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
      테스트 모드: 로그인 없이 관리 기능이 열려 있습니다. 공개·실서비스에서는 반드시{" "}
      <code className="rounded bg-amber-200/80 px-1">NEXT_PUBLIC_BYPASS_AUTH</code> 를 끄거나{" "}
      <code className="rounded bg-amber-200/80 px-1">false</code> 로 재배포하세요.
    </div>
  );
}
