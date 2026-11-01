from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

NEIS_BASE = "https://open.neis.go.kr/hub"


class NeisError(RuntimeError):
    """Raised when NEIS returns an error payload."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


class NeisClient:
    """Thin sync client for open.neis.go.kr.

    `NEIS_API_KEY` is optional. Without a key NEIS caps sample responses at 5
    rows, so timetable helpers fetch class-by-class when needed.
    """

    def __init__(self, api_key: str | None = None, timeout: float = 30.0):
        self.api_key = api_key if api_key is not None else os.getenv("NEIS_API_KEY") or None
        self.timeout = timeout

    def _get(self, service: str, **params: Any) -> list[dict[str, Any]]:
        query: dict[str, Any] = {
            "Type": "json",
            "pIndex": 1,
            "pSize": 1000,
            **{k: v for k, v in params.items() if v is not None and v != ""},
        }
        if self.api_key:
            query["KEY"] = self.api_key

        url = f"{NEIS_BASE}/{service}?{urlencode(query)}"
        req = Request(url, headers={"User-Agent": "fav-neis-client/1.0"})
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except HTTPError as exc:
            raise NeisError("HTTP", f"HTTP {exc.code}") from exc
        except URLError as exc:
            raise NeisError("NETWORK", str(exc.reason)) from exc

        if "RESULT" in payload:
            result = payload["RESULT"]
            code = result.get("CODE", "")
            message = result.get("MESSAGE", "")
            if code == "INFO-200":
                return []
            raise NeisError(code, message)

        block = payload.get(service)
        if not block:
            raise NeisError("PARSE", f"missing service block: {service}")

        head = block[0].get("head", [])
        for item in head:
            if "RESULT" in item:
                result = item["RESULT"]
                code = result.get("CODE", "")
                message = result.get("MESSAGE", "")
                if code == "INFO-200":
                    return []
                if code and not str(code).startswith("INFO-"):
                    raise NeisError(code, message)

        if len(block) < 2 or "row" not in block[1]:
            return []
        return list(block[1]["row"])

    def school_info(
        self,
        *,
        school_name: str | None = None,
        office_code: str | None = None,
        school_code: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._get(
            "schoolInfo",
            SCHUL_NM=school_name,
            ATPT_OFCDC_SC_CODE=office_code,
            SD_SCHUL_CODE=school_code,
        )

    def class_info(
        self,
        *,
        office_code: str,
        school_code: str,
        year: str | int,
        grade: str | int | None = None,
    ) -> list[dict[str, Any]]:
        return self._get(
            "classInfo",
            ATPT_OFCDC_SC_CODE=office_code,
            SD_SCHUL_CODE=school_code,
            AY=str(year),
            GRADE=str(grade) if grade is not None else None,
        )

    def meal(
        self,
        *,
        office_code: str,
        school_code: str,
        ymd: str,
    ) -> list[dict[str, Any]]:
        return self._get(
            "mealServiceDietInfo",
            ATPT_OFCDC_SC_CODE=office_code,
            SD_SCHUL_CODE=school_code,
            MLSV_YMD=ymd,
        )

    def school_schedule(
        self,
        *,
        office_code: str,
        school_code: str,
        ymd: str | None = None,
        from_ymd: str | None = None,
        to_ymd: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._get(
            "SchoolSchedule",
            ATPT_OFCDC_SC_CODE=office_code,
            SD_SCHUL_CODE=school_code,
            AA_YMD=ymd,
            AA_FROM_YMD=from_ymd,
            AA_TO_YMD=to_ymd,
        )

    def els_timetable(
        self,
        *,
        office_code: str,
        school_code: str,
        ymd: str,
        grade: str | int | None = None,
        class_name: str | int | None = None,
        year: str | int | None = None,
        semester: str | int | None = None,
    ) -> list[dict[str, Any]]:
        if year is None:
            year = int(ymd[:4])
        if semester is None:
            month = int(ymd[4:6])
            semester = 1 if month <= 7 else 2
        return self._get(
            "elsTimetable",
            ATPT_OFCDC_SC_CODE=office_code,
            SD_SCHUL_CODE=school_code,
            AY=str(year),
            SEM=str(semester),
            ALL_TI_YMD=ymd,
            GRADE=str(grade) if grade is not None else None,
            CLASS_NM=str(class_name) if class_name is not None else None,
        )

    def els_timetable_by_grade(
        self,
        *,
        office_code: str,
        school_code: str,
        ymd: str,
        grade: str | int,
        year: str | int | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch every class for a grade.

        Without an API key, a bare grade query is truncated. Querying each
        class individually returns the full day.
        """
        classes = self.class_info(
            office_code=office_code,
            school_code=school_code,
            year=year or int(ymd[:4]),
            grade=grade,
        )
        class_names = sorted(
            {row["CLASS_NM"] for row in classes if row.get("CLASS_NM")},
            key=lambda value: int(value) if str(value).isdigit() else str(value),
        )
        if not class_names:
            # Fall back to a direct grade query when classInfo is empty.
            return self.els_timetable(
                office_code=office_code,
                school_code=school_code,
                ymd=ymd,
                grade=grade,
                year=year,
            )

        rows: list[dict[str, Any]] = []
        for class_name in class_names:
            rows.extend(
                self.els_timetable(
                    office_code=office_code,
                    school_code=school_code,
                    ymd=ymd,
                    grade=grade,
                    class_name=class_name,
                    year=year,
                )
            )
        return rows
