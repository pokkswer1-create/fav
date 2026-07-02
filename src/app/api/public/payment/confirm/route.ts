import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await request.json();
    return NextResponse.json({
      ok: true,
      message: "결제 확인 API는 토스 연동 시 paymentKey·orderId 검증 로직을 추가합니다.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
