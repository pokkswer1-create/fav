"""NEIS(나이스) 교육정보 개방 API 클라이언트."""

from .client import NeisClient, NeisError
from .oma import OMA_ELEMENTARY, dismissal_for_periods, period_end_time
from .schedule import GradeDaySummary, summarize_grade_day

__all__ = [
    "NeisClient",
    "NeisError",
    "OMA_ELEMENTARY",
    "dismissal_for_periods",
    "period_end_time",
    "GradeDaySummary",
    "summarize_grade_day",
]
