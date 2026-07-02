import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerWithAuth(authorizationHeader?: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 값을 확인해주세요."
    );
  }

  const headers: Record<string, string> = {};
  if (authorizationHeader) {
    headers.Authorization = authorizationHeader;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers },
  });
}

