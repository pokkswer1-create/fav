import { Suspense } from "react";
import { BenchWorkbench } from "@/components/BenchWorkbench";

export default function BenchPage() {
  return (
    <div className="page-shell">
      <Suspense fallback={<p className="status-line">벤치 로딩…</p>}>
        <BenchWorkbench />
      </Suspense>
    </div>
  );
}
