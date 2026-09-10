import { Suspense } from "react";
import { ScoutWorkbench } from "@/components/ScoutWorkbench";

export default function ScoutPage() {
  return (
    <div className="page-shell">
      <Suspense fallback={<p className="status-line">스카우트 로딩…</p>}>
        <ScoutWorkbench />
      </Suspense>
    </div>
  );
}
