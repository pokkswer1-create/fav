"use client";

import { MainNav } from "@/components/main-nav";
import { TestModeBanner } from "@/components/test-mode-banner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 학부모 공개 페이지(/parents)에서는 관리자 네비·테스트 배너를 숨긴다.
 * 첫 페인트까지는 항상 네비를 그려 서버 HTML과 클라이언트 hydration이 맞도록 한다
 * (usePathname()이 서버에서 null/불일치일 때 생기는 hydration 오류 방지).
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/auth";
  const parentsPublic =
    pathname === "/parents" || (pathname?.startsWith("/parents/") ?? false);
  const announcementPublic = pathname?.startsWith("/announcements/") ?? false;
  const isPublicPage = isAuthPage || parentsPublic || announcementPublic;

  useEffect(() => {
    if (isPublicPage) {
      return;
    }
    let cancelled = false;
    const client = getSupabaseClient();
    void client.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const session = data.session;
      const hasSession = Boolean(session);
      if (!hasSession) {
        router.replace("/auth");
        return;
      }
      const token = session?.access_token;
      if (token) {
        const res = await fetch("/api/auth/access-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            await client.auth.signOut();
            router.replace("/auth");
          }
          return;
        }
        if (json.approvalStatus !== "APPROVED") {
          await client.auth.signOut();
          router.replace("/auth");
          return;
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isPublicPage, router]);

  const hideStaffChrome = parentsPublic || isAuthPage;

  if (hideStaffChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <TestModeBanner />
      <MainNav />
      {children}
    </>
  );
}
