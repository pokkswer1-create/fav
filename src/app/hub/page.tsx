import { permanentRedirect } from "next/navigation";

/** 예전 주소 호환: 관리 허브는 루트 `/` 로 통합되었습니다. */
export default function HubLegacyRedirect() {
  permanentRedirect("/");
}
