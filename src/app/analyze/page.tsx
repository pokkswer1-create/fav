import { Suspense } from "react";
import { AnalysisWorkbench } from "@/components/AnalysisWorkbench";

export default function AnalyzePage() {
  return (
    <div className="page-shell">
      <Suspense fallback={<p className="status-line">분석 로딩…</p>}>
        <AnalysisWorkbench />
      </Suspense>
    </div>
  );
}
