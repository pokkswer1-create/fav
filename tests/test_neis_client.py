from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from neis.client import NeisClient, NeisError
from neis.oma import OMA_ELEMENTARY, dismissal_for_periods, period_end_time
from neis.schedule import GradeDaySummary, summarize_grade_day


class FakeResponse:
    def __init__(self, payload: dict, status: int = 200):
        self._payload = payload
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self._payload).encode("utf-8")


class NeisClientTests(unittest.TestCase):
    def test_school_info_parses_rows(self):
        payload = {
            "schoolInfo": [
                {
                    "head": [
                        {"list_total_count": 1},
                        {"RESULT": {"CODE": "INFO-000", "MESSAGE": "ok"}},
                    ]
                },
                {
                    "row": [
                        {
                            "ATPT_OFCDC_SC_CODE": "J10",
                            "SD_SCHUL_CODE": "7621080",
                            "SCHUL_NM": "오마초등학교",
                            "SCHUL_KND_SC_NM": "초등학교",
                        }
                    ]
                },
            ]
        }
        client = NeisClient(api_key="test-key")
        with patch("neis.client.urlopen", return_value=FakeResponse(payload)):
            rows = client.school_info(school_name="오마초등학교", office_code="J10")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["SCHUL_NM"], "오마초등학교")

    def test_empty_result_returns_empty_list(self):
        payload = {"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}
        client = NeisClient()
        with patch("neis.client.urlopen", return_value=FakeResponse(payload)):
            rows = client.els_timetable(
                office_code="J10",
                school_code="7621080",
                ymd="20261102",
                grade="1",
                class_name="1",
            )
        self.assertEqual(rows, [])

    def test_error_result_raises(self):
        payload = {"RESULT": {"CODE": "ERROR-290", "MESSAGE": "인증키가 유효하지 않습니다."}}
        client = NeisClient(api_key="bad")
        with patch("neis.client.urlopen", return_value=FakeResponse(payload)):
            with self.assertRaises(NeisError):
                client.school_info(school_name="오마초등학교")


class OmaScheduleTests(unittest.TestCase):
    def test_period_end_times(self):
        self.assertEqual(period_end_time(4), "12:10")
        self.assertEqual(period_end_time(5), "13:40")
        self.assertEqual(period_end_time(6), "14:30")

    def test_dismissal_after_lunch_note_for_4th_period(self):
        info = dismissal_for_periods(4)
        self.assertEqual(info["class_end"], "12:10")
        self.assertEqual(info["after_lunch"], "13:00")

    def test_oma_school_codes(self):
        self.assertEqual(OMA_ELEMENTARY.office_code, "J10")
        self.assertEqual(OMA_ELEMENTARY.school_code, "7621080")


class SummarizeTests(unittest.TestCase):
    def test_summarize_grade_day_groups_by_class(self):
        rows = [
            {"GRADE": "1", "CLASS_NM": "1", "PERIO": "1", "ITRT_CNTNT": "국어"},
            {"GRADE": "1", "CLASS_NM": "1", "PERIO": "2", "ITRT_CNTNT": "수학"},
            {"GRADE": "1", "CLASS_NM": "1", "PERIO": "3", "ITRT_CNTNT": "체육"},
            {"GRADE": "1", "CLASS_NM": "1", "PERIO": "4", "ITRT_CNTNT": "음악"},
            {"GRADE": "1", "CLASS_NM": "2", "PERIO": "1", "ITRT_CNTNT": "국어"},
            {"GRADE": "1", "CLASS_NM": "2", "PERIO": "2", "ITRT_CNTNT": "수학"},
            {"GRADE": "1", "CLASS_NM": "2", "PERIO": "3", "ITRT_CNTNT": "미술"},
            {"GRADE": "1", "CLASS_NM": "2", "PERIO": "4", "ITRT_CNTNT": "음악"},
        ]
        summary = summarize_grade_day(rows, grade=1, ymd="20261102")
        self.assertIsInstance(summary, GradeDaySummary)
        self.assertEqual(summary.last_period, 4)
        self.assertEqual(summary.class_end, "12:10")
        self.assertEqual(sorted(summary.by_class.keys()), ["1", "2"])


if __name__ == "__main__":
    unittest.main()
