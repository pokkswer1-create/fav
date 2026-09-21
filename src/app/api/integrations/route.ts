import { NextResponse } from "next/server";
import { isRoboflowConfigured, roboflowModelId } from "@/lib/roboflow";
import { requireApiKey } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Integration health for Roboflow / FIVB / DVW tooling. */
export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    integrations: {
      roboflow: {
        configured: isRoboflowConfigured(),
        model: roboflowModelId(),
      },
      fivbVis: {
        configured: true,
        endpoint: "https://www.fivb.org/Vis2009/XmlRequest.asmx",
      },
      pydatavolley: {
        script: "scripts/parse_dvw.py",
        note: "DVW upload uses TS parser + optional pydatavolley enrichment",
      },
    },
  });
}
