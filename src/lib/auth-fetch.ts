import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * 브라우저에 저장된 Supabase 세션(access_token)을 Authorization 헤더에 붙여 호출합니다.
 * API Route의 requireRole()이 이 토큰으로 사용자를 식별합니다.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let token: string | undefined;
  try {
    const supabase = getSupabaseClient();
    const sessionResult = (await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ])) as Awaited<ReturnType<typeof supabase.auth.getSession>> | null;
    token = sessionResult?.data.session?.access_token;
  } catch {
    /* Supabase 미설정 등 */
  }

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? "same-origin",
  });
}
