import { NextRequest, NextResponse } from "next/server";

/** Toss Payments 등 연동 전 플레이스홀더 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hasToss = Boolean(process.env.TOSS_PAYMENTS_SECRET_KEY);
    if (!hasToss) {
      return NextResponse.json({
        ok: true,
        integrated: false,
        message:
          "온라인 결제(토스페이먼츠) 연동 전입니다. 신청서는 저장되었으며, 결제는 학원으로 문의해 주세요.",
        applicationId: body.applicationId ?? null,
        applicationType: body.applicationType ?? null,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        integrated: true,
        message: "토스 클라이언트 키가 설정된 경우 결제위젯 연동을 완성해 주세요.",
      },
      { status: 501 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
