import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL 값을 확인해주세요."
    );
  }
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 필요합니다. Vercel 환경변수에 추가한 뒤 재배포하세요."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
