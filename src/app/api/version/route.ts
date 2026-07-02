import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    vercelGitCommitSha:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_GITHUB_COMMIT_SHA ??
      null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    now: new Date().toISOString(),
  });
}

