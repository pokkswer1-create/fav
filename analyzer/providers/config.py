from __future__ import annotations

import os


def _truthy(name: str) -> bool:
    return str(os.getenv(name, "")).strip().lower() in {"1", "true", "yes", "y", "on"}


def kis_app_key() -> str:
    return str(os.getenv("KIS_APP_KEY", "")).strip()


def kis_app_secret() -> str:
    return str(os.getenv("KIS_APP_SECRET", "")).strip()


def kis_configured() -> bool:
    return bool(kis_app_key() and kis_app_secret())


def kis_use_mock() -> bool:
    return _truthy("KIS_USE_MOCK")


def kis_base_url() -> str:
    if kis_use_mock():
        return "https://openapivts.koreainvestment.com:29443"
    return "https://openapi.koreainvestment.com:9443"


def dart_api_key() -> str:
    return str(os.getenv("DART_API_KEY", "")).strip()


def dart_configured() -> bool:
    return len(dart_api_key()) >= 20


def krx_service_key() -> str:
    return str(os.getenv("KRX_SERVICE_KEY", "") or os.getenv("DATA_GO_KR_SERVICE_KEY", "")).strip()


def krx_configured() -> bool:
    return bool(krx_service_key())
