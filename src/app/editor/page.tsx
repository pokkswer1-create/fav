import { Suspense } from "react";
import { VideoEditorWorkbench } from "@/components/VideoEditorWorkbench";

export default function EditorPage() {
  return (
    <div className="page-shell">
      <Suspense fallback={<p className="status-line">편집기 로딩…</p>}>
        <VideoEditorWorkbench />
      </Suspense>
    </div>
  );
}
