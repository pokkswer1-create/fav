"use client";

import { QRCodeSVG } from "qrcode.react";

const projectName = "학원 관리 시스템";

export default function SmsGatewayPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">SMS 게이트웨이 설정</h1>
        <p className="text-sm text-rose-500">
          NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되어 있지 않아
          QR 코드를 생성할 수 없습니다. Vercel 환경 변수 또는 .env.local 을 확인해 주세요.
        </p>
      </main>
    );
  }

  const config = {
    type: "sms_gateway_config",
    supabaseUrl,
    supabaseKey,
    projectName,
    deviceName: "원장님폰-1",
  };

  const qrText = JSON.stringify(config);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">SMS 게이트웨이 (안드로이드 폰 연동)</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          아래 QR 코드를 안드로이드 앱에서 스캔하면 Supabase 프로젝트 정보와 학원 이름이 자동으로
          설정되도록 사용할 수 있습니다. 이 QR에는 Supabase 공개 키가 포함되므로{" "}
          <span className="font-semibold">내부 관리자 화면에서만 사용</span>해 주세요.
        </p>
      </header>

      <section className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center dark:border-zinc-800">
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <QRCodeSVG value={qrText} size={220} includeMargin />
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          안드로이드 앱에서 &quot;QR로 설정 불러오기&quot; 메뉴를 열고 이 코드를 스캔하세요.
        </p>
      </section>

      <section className="space-y-2 rounded-xl border p-4 text-xs leading-relaxed dark:border-zinc-800">
        <p className="font-semibold">QR에 인코딩되는 설정 값 (개발자 참고용)</p>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-[11px] text-zinc-100">
          {JSON.stringify(config, null, 2)}
        </pre>
      </section>
    </main>
  );
}

