#!/usr/bin/env python3
"""Q12 oracle: OpenTimelineIO reads Yamakan OTIO JSON at rate 705600000."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import opentimelineio as otio

RATE = 705_600_000


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/evidence/qualification/otio-fixture.otio")
    raw = path.read_text(encoding="utf-8")
    timeline = otio.adapters.read_from_string(raw, adapter_name="otio_json")
    assert timeline is not None, "OTIO failed to read the fixture"
    ranges = []
    for track in timeline.tracks:
        for item in track:
            sr = item.source_range
            assert sr is not None
            assert sr.start_time.rate == RATE or abs(sr.start_time.rate - RATE) < 1e-6
            assert sr.duration.rate == RATE or abs(sr.duration.rate - RATE) < 1e-6
            ranges.append(
                {
                    "name": item.name,
                    "schema": item.schema_name(),
                    "start": int(sr.start_time.value),
                    "duration": int(sr.duration.value),
                    "rate": float(sr.duration.rate),
                }
            )
    out = {
        "qualification": "Q12",
        "module": "M16",
        "task": "W13",
        "opentimelineio": getattr(otio, "__version__", "unknown"),
        "rate": RATE,
        "ranges": ranges,
        "passed": True,
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
