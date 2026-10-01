"""Build compact, real-data CSVs for the browser from the large source file.

The flight-level source is over 1 GB. Aggregating it once keeps the browser
responsive while preserving exact route/month counts and real sampled flights.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import Counter
from pathlib import Path

MAX_SCATTER_POINTS_PER_ROUTE = 180
MAX_GLOBAL_SCATTER_POINTS = 12_000
PROGRESS_EVERY = 250_000


def number(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    try:
        result = float(value)
    except ValueError:
        return None
    return result if result == result else None



def city_name(value: str | None, state: str | None) -> str:
    name = (value or "").strip()
    state_code = (state or "").strip()
    suffix = f", {state_code}" if state_code else ""
    return name[:-len(suffix)] if suffix and name.endswith(suffix) else name


def build_summary(source: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    airports: dict[str, tuple[str, str]] = {}
    routes: dict[tuple[str, str], dict] = {}
    codes: set[str] = set()
    skipped = 0
    row_count = 0
    rng = random.Random(2025)
    global_rng = random.Random(2026)
    global_samples: list[tuple[str, ...]] = []
    global_sample_seen = 0
    started = time.monotonic()

    with source.open("r", encoding="utf-8-sig", newline="", buffering=1024 * 1024) as file:
        reader = csv.DictReader(file)
        expected = {"Origin", "Dest", "Month", "Cancelled", "DepDelay", "ArrDelay", "FlightDate"}
        missing = expected.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

        for row in reader:
            row_count += 1
            origin = (row.get("Origin") or "").strip().upper()
            destination = (row.get("Dest") or "").strip().upper()
            month_value = number(row.get("Month"))
            month = int(month_value) if month_value is not None else 0
            if not origin or not destination or not 1 <= month <= 12:
                skipped += 1
                continue

            origin_state = (row.get("OriginState") or "").strip()
            destination_state = (row.get("DestState") or "").strip()
            airports[origin] = (city_name(row.get("OriginCityName"), origin_state), origin_state)
            airports[destination] = (city_name(row.get("DestCityName"), destination_state), destination_state)

            key = (origin, destination)
            route = routes.get(key)
            if route is None:
                route = {
                    "months": [[0, 0, 0, 0, Counter()] for _ in range(12)],
                    "samples": [],
                    "sample_seen": 0,
                }
                routes[key] = route

            cancelled = (number(row.get("Cancelled")) or 0) >= 0.5
            arrival_delay = number(row.get("ArrDelay"))
            outcome = "Cancelled" if cancelled else "Delayed" if arrival_delay is not None and arrival_delay >= 15 else "On time"
            aggregate = route["months"][month - 1]
            aggregate[0] += 1
            aggregate[1 if outcome == "On time" else 2 if outcome == "Delayed" else 3] += 1

            cancellation_code = (row.get("CancellationCode") or "").strip()
            if cancelled and cancellation_code:
                codes.add(cancellation_code)
                aggregate[4][cancellation_code] += 1

            departure_delay = number(row.get("DepDelay"))
            arrival_delay = number(row.get("ArrDelay"))
            distance = number(row.get("Distance"))
            if not cancelled and departure_delay is not None and arrival_delay is not None:
                route["sample_seen"] += 1
                point = (
                    (row.get("FlightDate") or "").strip(),
                    str(month),
                    (row.get("Reporting_Airline") or "").strip(),
                    "" if distance is None else f"{distance:g}",
                    f"{departure_delay:g}",
                    f"{arrival_delay:g}",
                    outcome,
                    cancellation_code,
                )
                samples = route["samples"]
                if len(samples) < MAX_SCATTER_POINTS_PER_ROUTE:
                    samples.append(point)
                else:
                    index = rng.randrange(route["sample_seen"])
                    if index < MAX_SCATTER_POINTS_PER_ROUTE:
                        samples[index] = point

            if not cancelled and arrival_delay is not None and distance is not None:
                global_sample_seen += 1
                global_point = (
                    origin,
                    destination,
                    (row.get("FlightDate") or "").strip(),
                    str(month),
                    (row.get("Reporting_Airline") or "").strip(),
                    f"{distance:g}",
                    "" if departure_delay is None else f"{departure_delay:g}",
                    f"{arrival_delay:g}",
                    outcome,
                    cancellation_code,
                )
                if len(global_samples) < MAX_GLOBAL_SCATTER_POINTS:
                    global_samples.append(global_point)
                else:
                    index = global_rng.randrange(global_sample_seen)
                    if index < MAX_GLOBAL_SCATTER_POINTS:
                        global_samples[index] = global_point

            if row_count % PROGRESS_EVERY == 0:
                elapsed = time.monotonic() - started
                print(f"Processed {row_count:,} rows · {len(routes):,} routes · {elapsed:.1f}s", flush=True)

    sorted_codes = sorted(codes)
    airport_path = output / "airports.csv"
    with airport_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["code", "city", "state"])
        for code, (city, state) in sorted(airports.items()):
            writer.writerow([code, city, state])

    monthly_path = output / "route-monthly.csv"
    with monthly_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["origin", "destination", "month", "flights", "onTime", "delayed", "cancelled", *[f"cancel_{code}" for code in sorted_codes]])
        for (origin, destination), route in sorted(routes.items()):
            for month, values in enumerate(route["months"], start=1):
                flights, on_time, delayed, cancelled, reasons = values
                if flights == 0:
                    continue
                writer.writerow([origin, destination, month, flights, on_time, delayed, cancelled, *[reasons.get(code, 0) for code in sorted_codes]])

    sample_path = output / "flight-sample.csv"
    with sample_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["origin", "destination", "flightDate", "month", "airline", "distance", "departureDelay", "arrivalDelay", "outcome", "cancellationCode"])
        for (origin, destination), route in sorted(routes.items()):
            for date, month, airline, distance, departure_delay, arrival_delay, outcome, code in route["samples"]:
                writer.writerow([origin, destination, date, month, airline, distance, departure_delay, arrival_delay, outcome, code])

    global_sample_path = output / "flight-sample-all.csv"
    with global_sample_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["origin", "destination", "flightDate", "month", "airline", "distance", "departureDelay", "arrivalDelay", "outcome", "cancellationCode"])
        writer.writerows(global_samples)

    elapsed = time.monotonic() - started
    old_manifest_path = output / "manifest.json"
    old_manifest = json.loads(old_manifest_path.read_text(encoding="utf-8")) if old_manifest_path.exists() else {}
    manifest = {
        "source": source.name,
        "sourceRows": row_count,
        "skippedRows": skipped,
        "airportCount": len(airports),
        "routeCount": len(routes),
        "cancellationCodes": sorted_codes,
        "scatterSamplePerRoute": MAX_SCATTER_POINTS_PER_ROUTE,
        "globalScatterSampleSize": len(global_samples),
        "globalScatterCandidateFlights": global_sample_seen,
        "geographyAvailable": (output / "us-airports.geojson").is_file(),
        "geographyBoundarySource": "U.S. Census Bureau 2025 Cartographic Boundary, 1:5,000,000",
        "preprocessingSeconds": round(elapsed, 1),
    }
    if old_manifest.get("geographySource"):
        manifest["geographySource"] = old_manifest["geographySource"]
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize the flight CSV for the visualization prototype.")
    parser.add_argument("source", type=Path, help="Path to the original flight-level CSV")
    parser.add_argument("--output", type=Path, default=Path("data"), help="Directory for compact browser datasets")
    args = parser.parse_args()
    build_summary(args.source, args.output)


if __name__ == "__main__":
    main()
