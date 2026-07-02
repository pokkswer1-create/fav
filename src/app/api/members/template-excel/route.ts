import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import * as XLSX from "xlsx";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  try {
    const today = new Date().toISOString().slice(0, 10);
    // 회원관리 화면 테이블 헤더(이름·소속 반·연락처·기본 수강료·할인·최종 수강료·상태)와 맞춘 한글 컬럼 + 가입·학부모·영문 호환
    const rows = [
      {
        이름: "김민수",
        "소속 반": "유소년 A반",
        연락처: "010-1234-5678",
        학년: "초5",
        "기본 수강료": 180000,
        "할인 유형": "none",
        "할인 값": 0,
        "최종 수강료": 180000,
        상태: "active",
        "학부모 이름": "김학부모",
        "학부모 연락처": "010-8765-4321",
        "부 연락처": "010-1111-2222",
        "모 연락처": "010-3333-4444",
        가입일: today,
      },
      {
        이름: "이서준",
        "소속 반": "성인",
        연락처: "",
        학년: "",
        "기본 수강료": 170000,
        "할인 유형": "none",
        "할인 값": 0,
        "최종 수강료": 170000,
        상태: "active",
        "학부모 이름": "본인",
        "학부모 연락처": "",
        "부 연락처": "010-4025-2959",
        "모 연락처": "",
        가입일: today,
      },
    ];
    const guideRows = [
      { field: "이름", required: "Y", description: "회원관리 목록의 이름과 동일" },
      { field: "소속 반", required: "N", description: "시스템에 등록된 반 이름과 일치하면 자동 수강 등록" },
      { field: "연락처", required: "N", description: "비우면 부/모/학부모 연락처 중 하나로 대체" },
      { field: "학년", required: "N", description: "비우면 성인으로 저장 (유아·초등 등 입력 권장)" },
      { field: "기본 수강료", required: "N", description: "월 기본 수강료(숫자). 영문 monthlyFee와 동일" },
      { field: "할인 유형", required: "N", description: "none | amount | percent (또는 금액/퍼센트 한글)" },
      { field: "할인 값", required: "N", description: "원 단위 금액 또는 퍼센트 숫자" },
      { field: "최종 수강료", required: "N", description: "비우면 기본 수강료·할인으로 자동 계산" },
      { field: "상태", required: "N", description: "active | paused | withdrawn (기본 active)" },
      { field: "학부모 이름", required: "N", description: "" },
      { field: "학부모 연락처", required: "N", description: "" },
      { field: "부 연락처", required: "N", description: "성인 회원 등 본인 번호를 넣는 경우가 많음" },
      { field: "모 연락처", required: "N", description: "" },
      { field: "가입일", required: "N", description: "YYYY-MM-DD (기본 오늘)" },
      { field: "(호환)", required: "-", description: "기존 영문 헤더(name, phone, className, …)도 그대로 사용 가능" },
    ];

    const wb = XLSX.utils.book_new();
    const dataWs = XLSX.utils.json_to_sheet(rows);
    const guideWs = XLSX.utils.json_to_sheet(guideRows);
    XLSX.utils.book_append_sheet(wb, dataWs, "members_template");
    XLSX.utils.book_append_sheet(wb, guideWs, "guide");
    const fileBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="members-template.xlsx"; filename*=UTF-8\'\'%ED%9A%8C%EC%9B%90-%EC%9D%BC%EA%B4%84%EB%93%B1%EB%A1%9D-%ED%85%9C%ED%94%8C%EB%A6%BF.xlsx',
      },
    });
  } catch (error) {
    console.error("Failed to generate Excel template:", error);
    return NextResponse.json(
      { error: "엑셀 템플릿 파일 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}

