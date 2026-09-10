import { Suspense } from "react";
import { LibraryWorkbench } from "@/components/LibraryWorkbench";

export default function LibraryPage() {
  return (
    <div className="page-shell">
      <Suspense fallback={<p className="status-line">보관함 로딩…</p>}>
        <LibraryWorkbench />
      </Suspense>
    </div>
  );
}
