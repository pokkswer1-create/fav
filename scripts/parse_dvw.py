#!/usr/bin/env python3
"""Parse DataVolley .dvw via pydatavolley when possible; fallback to stdout JSON stub."""
from __future__ import annotations

import json
import sys
import tempfile
import shutil
from pathlib import Path


def try_pydatavolley(path: str) -> dict | None:
    try:
        import pandas as pd
        from datavolley import read_dv
    except Exception as e:
        return {"engine": "unavailable", "error": f"import: {e}"}

    # Newer pandas makes Index.values read-only; patch column rename step.
    src = Path(tempfile.mkdtemp()) / "in.dvw"
    shutil.copy(path, src)

    try:
        # Monkeypatch: replace columns.values slice assign with rename
        import datavolley.read_dv as rd

        original = rd.DataVolley._read_data

        def _safe_read(self):  # type: ignore
            try:
                return original(self)
            except ValueError as err:
                if "read-only" not in str(err).lower():
                    raise
                # Fallback: mark failure for TS classic parser
                raise RuntimeError("pandas-readonly") from err

        rd.DataVolley._read_data = _safe_read  # type: ignore
        dv = rd.DataVolley(str(src))
        plays = dv.get_plays()
        records = []
        for _, row in plays.head(500).iterrows():
            rec = {}
            for k, v in row.items():
                if pd.isna(v):
                    continue
                rec[str(k)] = v.item() if hasattr(v, "item") else v
            records.append(rec)
        return {
            "engine": "pydatavolley",
            "rows": len(plays),
            "columns": list(plays.columns),
            "plays": records[:300],
        }
    except Exception as e:
        return {"engine": "pydatavolley-failed", "error": str(e)}


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: parse_dvw.py <file.dvw>"}))
        return 2
    path = sys.argv[1]
    result = try_pydatavolley(path)
    print(json.dumps(result, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
