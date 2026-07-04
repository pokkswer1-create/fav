#!/usr/bin/env python3
"""Create the FAV application form on Tally via API.

Usage:
  TALLY_API_KEY=tly-xxx python3 scripts/create_tally_fav_form.py

Optional:
  TALLY_WEBHOOK_URL=https://your-site/api/webhooks/tally-application
  TALLY_WEBHOOK_SECRET=your-secret
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from typing import Any


def uid() -> str:
    return str(uuid.uuid4())


class Builder:
    def __init__(self) -> None:
        self.blocks: list[dict[str, Any]] = []
        self.trial_block_uuids: list[str] = []
        self.regular_block_uuids: list[str] = []
        self.lesson_type_group: str | None = None
        self.trial_option_uuid: str | None = None
        self.regular_option_uuid: str | None = None

    def _track_trial(self, block: dict[str, Any]) -> None:
        self.trial_block_uuids.append(block["uuid"])

    def _track_regular(self, block: dict[str, Any]) -> None:
        self.regular_block_uuids.append(block["uuid"])

    def form_title(self, title: str) -> None:
        self.blocks.append(
            {
                "uuid": uid(),
                "type": "FORM_TITLE",
                "groupUuid": uid(),
                "groupType": "TEXT",
                "payload": {"html": title, "title": title},
            }
        )

    def text(self, html: str, *, hidden: bool = False, section: str | None = None) -> None:
        block = {
            "uuid": uid(),
            "type": "TEXT",
            "groupUuid": uid(),
            "groupType": "TEXT",
            "payload": {"html": html, **({"isHidden": True} if hidden else {})},
        }
        if section == "trial":
            self._track_trial(block)
        elif section == "regular":
            self._track_regular(block)
        self.blocks.append(block)

    def page_break(self) -> None:
        self.blocks.append(
            {
                "uuid": uid(),
                "type": "PAGE_BREAK",
                "groupUuid": uid(),
                "groupType": "PAGE_BREAK",
                "payload": {},
            }
        )

    def input_text(self, label: str, *, required: bool = False, section: str | None = None) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        field = {
            "uuid": uid(),
            "type": "INPUT_TEXT",
            "groupUuid": uid(),
            "groupType": "INPUT_TEXT",
            "payload": {"isRequired": required, "placeholder": "", "isHidden": section is not None},
        }
        if section == "trial":
            self._track_trial(title)
            self._track_trial(field)
        elif section == "regular":
            self._track_regular(title)
            self._track_regular(field)
        self.blocks.extend([title, field])

    def input_phone(self, label: str, *, required: bool = False, section: str | None = None) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        field = {
            "uuid": uid(),
            "type": "INPUT_PHONE_NUMBER",
            "groupUuid": uid(),
            "groupType": "INPUT_PHONE_NUMBER",
            "payload": {"isRequired": required, "isHidden": section is not None},
        }
        if section == "trial":
            self._track_trial(title)
            self._track_trial(field)
        elif section == "regular":
            self._track_regular(title)
            self._track_regular(field)
        self.blocks.extend([title, field])

    def input_date(self, label: str, *, required: bool = False, section: str | None = None) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        field = {
            "uuid": uid(),
            "type": "INPUT_DATE",
            "groupUuid": uid(),
            "groupType": "INPUT_DATE",
            "payload": {"isRequired": required, "isHidden": section is not None},
        }
        if section == "trial":
            self._track_trial(title)
            self._track_trial(field)
        elif section == "regular":
            self._track_regular(title)
            self._track_regular(field)
        self.blocks.extend([title, field])

    def multiple_choice(
        self,
        label: str,
        options: list[str],
        *,
        required: bool = False,
        section: str | None = None,
        store_lesson_type: bool = False,
    ) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        mc_group = uid()
        option_blocks: list[dict[str, Any]] = []
        for i, text in enumerate(options):
            opt_uuid = uid()
            option_blocks.append(
                {
                    "uuid": opt_uuid,
                    "type": "MULTIPLE_CHOICE_OPTION",
                    "groupUuid": mc_group,
                    "groupType": "MULTIPLE_CHOICE",
                    "payload": {
                        "index": i,
                        "isFirst": i == 0,
                        "isLast": i == len(options) - 1,
                        "text": text,
                        "isRequired": required and i == 0,
                        "isHidden": section is not None,
                    },
                }
            )
            if store_lesson_type:
                if "체험" in text:
                    self.trial_option_uuid = opt_uuid
                if "정규" in text:
                    self.regular_option_uuid = opt_uuid
        if store_lesson_type:
            self.lesson_type_group = mc_group
        tracked = [title, *option_blocks]
        if section == "trial":
            for b in tracked:
                self._track_trial(b)
        elif section == "regular":
            for b in tracked:
                self._track_regular(b)
        self.blocks.append(title)
        self.blocks.extend(option_blocks)

    def checkboxes(
        self,
        label: str,
        options: list[str],
        *,
        required: bool = False,
        section: str | None = None,
    ) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        cb_group = uid()
        option_blocks: list[dict[str, Any]] = []
        for i, text in enumerate(options):
            option_blocks.append(
                {
                    "uuid": uid(),
                    "type": "CHECKBOX",
                    "groupUuid": cb_group,
                    "groupType": "CHECKBOXES",
                    "payload": {
                        "index": i,
                        "isFirst": i == 0,
                        "isLast": i == len(options) - 1,
                        "text": text,
                        "isRequired": required and i == 0,
                        "isHidden": section is not None,
                    },
                }
            )
        tracked = [title, *option_blocks]
        if section == "trial":
            for b in tracked:
                self._track_trial(b)
        elif section == "regular":
            for b in tracked:
                self._track_regular(b)
        self.blocks.append(title)
        self.blocks.extend(option_blocks)

    def signature(self, label: str, *, required: bool = False, section: str | None = None) -> None:
        title = {
            "uuid": uid(),
            "type": "TITLE",
            "groupUuid": uid(),
            "groupType": "QUESTION",
            "payload": {"html": label},
        }
        field = {
            "uuid": uid(),
            "type": "SIGNATURE",
            "groupUuid": uid(),
            "groupType": "SIGNATURE",
            "payload": {
                "isRequired": required,
                "label": "아래에 서명해 주세요",
                "isHidden": section is not None,
            },
        }
        tracked = [title, field]
        if section == "trial":
            for block in tracked:
                self._track_trial(block)
        elif section == "regular":
            for block in tracked:
                self._track_regular(block)
        self.blocks.extend(tracked)

    def conditional_logic(self) -> None:
        if not self.lesson_type_group or not self.trial_option_uuid or not self.regular_option_uuid:
            return

        def logic(option_uuid: str, show_uuids: list[str]) -> dict[str, Any]:
            return {
                "uuid": uid(),
                "type": "CONDITIONAL_LOGIC",
                "groupUuid": uid(),
                "groupType": "CONDITIONAL_LOGIC",
                "payload": {
                    "logicalOperator": "AND",
                    "conditionals": [
                        {
                            "uuid": uid(),
                            "type": "SINGLE",
                            "payload": {
                                "field": {
                                    "uuid": self.lesson_type_group,
                                    "type": "INPUT_FIELD",
                                    "questionType": "MULTIPLE_CHOICE",
                                    "blockGroupUuid": self.lesson_type_group,
                                    "title": "🏐 수업 형태",
                                },
                                "comparison": "IS",
                                "value": option_uuid,
                            },
                        }
                    ],
                    "actions": [
                        {
                            "uuid": uid(),
                            "type": "SHOW_BLOCKS",
                            "payload": {"showBlocks": show_uuids},
                        }
                    ],
                },
            }

        if self.trial_block_uuids:
            self.blocks.append(logic(self.trial_option_uuid, self.trial_block_uuids))
        if self.regular_block_uuids:
            self.blocks.append(logic(self.regular_option_uuid, self.regular_block_uuids))


INTRO_BLOCKS = [
    """<b>🏐 FAV 스포츠 배구전문센터</b><br>
📍 경기 고양시 일산서구 송포백송길 70-1""",
    """<b>✅ 필수 확인</b><br>
• 👟 실내화 필수 (외부 신발 착용 시 입장 불가)<br>
• 🍱 음식 반입 금지 · 🧤 분실물 2주 보관<br>
• 💬 등록 시 클래스 단톡방 초대 · 📢 공지: 단톡/카카오/SNS<br>
• 💳 매월 20~25일 선결제""",
    """<b>💰 수업료 요약</b> (월 기준)<br>
• ⏱️ 50분 — 11 / 17 / 20만원 (주1·23·45회)<br>
• ⏰ 90분 — 16 / 29 / 39 / 49만원 (주1~4회)<br>
• 🏆 대표팀 21만원 · 👨‍🎓 성인 주2회 16만원""",
    """<b>🔄 보강</b> — 당월만 가능, 다음 달 이월 불가<br>
<i>상세 환불·보강 규정은 신청서 하단에서 확인·동의해 주세요.</i>""",
]

TRIAL_CLASSES = [
    "⏱️ 50분 클래스 20,000 원",
    "⏰ 90분 클래스 40,000 원",
    "👨‍🎓 성인 클래스  40,000 원",
]

WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

REGULAR_CLASSES = [
    "50분 수업 유아반 (6세-10세) |평일 월 1부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 월 2부 17시 30분 타임",
    "50분 수업 유아반 (6세-10세) |평일 화 1부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 화 2부 17시 30분 타임",
    "50분 수업 유아반 (6세-10세) |평일 수 1부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 수 2부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 목 1부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 목 2부 16시 40분 타임",
    "50분 수업 유아반  (6세-10세) |평일 금 1부 16시 40분 타임",
    "50분 수업 유아반 (6세-10세) |평일 금 2부 16시 40분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 평일 월 여자 유소년 18시 20분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 평일 화 통합유소년(남/녀 통합) 18시 20분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 평일 수 여자 유소년 18시 20분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 평일 목  통합유소년(남/녀 통합) 18시 20분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 평일 금 여자 유소년 18시 20분 타임",
    "90분 수업 유소년 (11세-19세) |  2부 평일 월  통합유소년(남/녀 통합) 20시 00분 타임",
    "90분 수업 유소년 (11세-19세) |  2부 평일 수  통합유소년(남/녀 통합) 20시 00분 타임",
    "90분 수업 유소년 (11세-19세) |  2부 평일 금  통합유소년(남/녀 통합) 20시 00분 타임",
    "90분 수업 유소년 (11세-19세) |  토요일 여자 유소년 14시 00분 타임",
    "90분 수업 유소년 (11세-19세) |  토요일 남자 유소년 19시 40분 타임",
    "90분 수업 유소년 (11세-19세) |  1부 일요일 남자 유소년 15시 50분 타임 (초등 고학년이 많음)",
    "90분 수업 유소년 (11세-19세) |  2부 일요일 남자 유소년 17시 25분 타임 (중,고등학생이 많음)",
    "90분 수업 유소년 (11세-19세) |  일요일 여자 유소년 12시 10분 타임",
    "⏰ 150분 TRYOUT PREP  100,000원",
    "150분 수업 TRYOUT PREP 토요일 9:30분 타임",
    "150분 수업 TRYOUT PREP 일요일 19:00분 타임",
    "성인 110분 수업 평일 화, 목 19:50-21:40",
    "신규 50분 타임 4명이상 시간 개설",
    "신규 90분 타임 4명이상 시간 개설",
]

PATH_OPTIONS = ["인스타", "네이버 카페", "네이버 블로그", "당근 마켓", "지인", "지도"]
PAYMENT_OPTIONS = [
    "비대면 (카카오톡으로 결제선생을 통해 보내드리겠습니다.)",
    "계좌이체 (카카오뱅크 3333-08-7666406 김강선 (에프에이브이 스포츠 (FAV스포츠))",
    "현장 결제(카드/현금)",
]

REFUND_HTML = """📝 환불 규정<br><br>
규정을 기반으로 센터 운영이 이루어지고 있습니다. 후에 혼돈이 생기시지 않도록 보강 및 환불 내용을 꼭 숙지해주시기 바랍니다.<br><br>
<b>환불 계산 기준</b><br>
50분 클래스: 환불 시 1회당 30,000원으로 계산 (10% 위약금 공제 후 환불)<br>
90분 클래스 / 성인반: 환불 시 1회당 40,000원으로 계산 (10% 위약금 공제 후 환불)<br>
월 등록 시 할인 적용, 환불 시에는 정상가 기준"""

MAKEUP_HTML = """🔄 보강 규정<br><br>
⏱️ 50분 클래스: 주 1회 ➔ 월 1회 보강 / 주 2~3회 ➔ 월 3회 보강 / 주 5회 ➔ 보강 불가<br>
⏰ 90분 클래스: 주 1회 ➔ 월 1회 보강 / 주 2회 ➔ 월 2회 보강 / 주 3회 ➔ 월 3회 보강 / 주 4회 ➔ 월 4회 보강<br>
🏆 대표팀: 보강 불가 / 👨‍🎓 성인: 보강 불가<br><br>
❗ 보강은 당월에서만 가능하며, 다음 달로 이월이 불가능합니다."""


def build_form() -> Builder:
    b = Builder()
    b.form_title("26년 FAV 수업 신청서")
    for intro in INTRO_BLOCKS:
        b.text(intro)

    b.multiple_choice(
        "👶 대상자 연령",
        ["6세 - 10세", "11세 - 13세", "14세 - 19세", "성인"],
        required=True,
    )
    b.input_text("🏷️ 수강생 이름", required=True)
    b.input_text("🎓 수강생 학년·나이·생년월일", required=True)
    b.input_phone("📱 수강생 전화번호", required=True)
    b.input_text("🏫 학교 이름")
    b.input_text("🏠 주소", required=True)
    b.input_text("👨‍👩‍👧 부모님 성함")
    b.input_phone("📞 부모님 전화번호")
    b.multiple_choice(
        "🏐 수업 형태",
        ["✨ 체험수업(Trial Class)", "📚 정규수업(Regular Class)"],
        required=True,
        store_lesson_type=True,
    )

    b.page_break()
    b.text("<b>✨ 체험수업 신청</b>", section="trial")
    b.input_date("📆 체험 희망 날짜", required=True, section="trial")
    b.multiple_choice("📅 체험 희망 요일", WEEKDAYS, required=True, section="trial")
    b.multiple_choice("🏐 체험 희망 반", REGULAR_CLASSES, required=True, section="trial")
    b.text(
        "체험 수업 후 당일 정규레슨반 등록 시, 등록비에서 체험 수업 비용을 제외하고 결제 진행을 도와드립니다.",
        section="trial",
    )
    b.checkboxes("💳 입금 확인", ["입금했습니다."], section="trial")
    b.text(
        "개인정보 수집·이용 동의: 이름, 전화번호, 생년월일, 주소 등 신청 처리에 필요한 정보를 수집합니다.",
        section="trial",
    )
    b.checkboxes("✅ 개인정보 수집·이용 동의", ["동의합니다."], required=True, section="trial")
    b.signature("✍️ 서명", required=True, section="trial")

    b.page_break()
    b.text("<b>📚 정규수업 신청</b><br>아래에서 원하시는 클래스를 모두 선택해 주세요.", section="regular")
    b.checkboxes(
        "🏐 정규 클래스 선택 (원하시는 횟수만큼)",
        REGULAR_CLASSES,
        required=True,
        section="regular",
    )
    b.multiple_choice("📝 신청 경로", PATH_OPTIONS, section="regular")
    b.multiple_choice("💳 결제방법", PAYMENT_OPTIONS, required=True, section="regular")
    b.text(REFUND_HTML, section="regular")
    b.checkboxes("📝 환불 규정 동의", ["동의합니다."], required=True, section="regular")
    b.text(MAKEUP_HTML, section="regular")
    b.checkboxes("🔄 보강 규정 동의", ["동의합니다."], required=True, section="regular")
    b.signature("✍️ 서명", required=True, section="regular")

    b.conditional_logic()
    return b


def tally_request(method: str, path: str, api_key: str, payload: dict | None = None) -> dict:
    cmd = [
        "curl",
        "-sS",
        "-X",
        method,
        f"https://api.tally.so{path}",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-H",
        "Content-Type: application/json",
    ]
    if payload is not None:
        cmd.extend(["-d", json.dumps(payload, ensure_ascii=False)])
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout or "{}")
    if "message" in data and "id" not in data and "items" not in data and method != "DELETE":
        raise RuntimeError(data.get("message") or result.stdout)
    return data


def main() -> int:
    api_key = os.environ.get("TALLY_API_KEY", "").strip()
    if not api_key:
        print("Set TALLY_API_KEY environment variable.", file=sys.stderr)
        return 1

    builder = build_form()
    payload = {
        "status": "PUBLISHED",
        "name": "26년 FAV 수업 신청서",
        "blocks": builder.blocks,
    }

    form_id = os.environ.get("TALLY_FORM_ID", "").strip()
    if form_id:
        print(f"Updating Tally form {form_id}...")
        tally_request("PATCH", f"/forms/{form_id}", api_key, payload)
    else:
        print("Creating Tally form...")
        created = tally_request("POST", "/forms", api_key, payload)
        form_id = created["id"]

    public_url = f"https://tally.so/r/{form_id}"
    edit_url = f"https://tally.so/forms/{form_id}/edit"

    webhook_url = os.environ.get(
        "TALLY_WEBHOOK_URL", "https://fav.vercel.app/api/webhooks/tally-application"
    ).strip()
    webhook_secret = os.environ.get("TALLY_WEBHOOK_SECRET", "").strip()
    if not webhook_secret:
        webhook_secret = "fav-tally-wh-7Kp2mN9xQ4vR8sT6wJ3hL5n"

    if webhook_url:
        existing = tally_request("GET", "/webhooks", api_key)
        hook_items = existing.get("webhooks", existing.get("items", []))
        already = any(
            item.get("formId") == form_id and item.get("url") == webhook_url
            for item in hook_items
        )
        if already:
            print("Webhook already configured.")
        else:
            print("Creating webhook...")
            hook_payload: dict[str, Any] = {
                "formId": form_id,
                "url": webhook_url,
                "eventTypes": ["FORM_RESPONSE"],
                "signingSecret": webhook_secret,
            }
            tally_request("POST", "/webhooks", api_key, hook_payload)
            print(f"TALLY_WEBHOOK_SECRET={webhook_secret}")
            print("→ Vercel 환경변수에 위 시크릿을 등록하세요.")

    print("\n✅ Tally form ready!")
    print(f"Public URL : {public_url}")
    print(f"Edit URL   : {edit_url}")
    print(f"Form ID    : {form_id}")
    if webhook_url:
        print(f"Webhook    : {webhook_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
