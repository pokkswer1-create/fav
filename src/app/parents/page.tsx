import { ParentSiteHome } from "@/components/parent-site/ParentSiteHome";
import { defaultSiteBranding, mergeSiteBranding } from "@/lib/parent-site/defaults";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  let title = `${defaultSiteBranding.title} | 학부모 안내`;
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("academy_settings")
      .select("setting_value")
      .eq("setting_key", "site_branding")
      .maybeSingle();
    if (data?.setting_value != null) {
      const b = mergeSiteBranding(data.setting_value);
      title = `${b.title} | 학부모 안내`;
    }
  } catch {
    /* env/DB 없으면 기본 제목 */
  }
  return {
    title,
    description: "체험·정규·대표팀·보강 신청, 공지 및 수강료 안내",
  };
}

export default function ParentsPage() {
  return <ParentSiteHome />;
}
