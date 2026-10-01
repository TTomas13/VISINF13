# Flight Disruptions 2025

A modular, local-first prototype for exploring one origin–destination route. The frontend uses HTML, CSS, plain JavaScript, and a vendored D3 v7 build. It has no framework, build step, or runtime internet dependency.

## Run the dashboard

Open this folder in VS Code and start `index.html` with Live Server. The browser loads the compact CSV files in `data/`; do not open the page with `file://` because browsers block local data requests from that origin.

The project includes compact data files generated from the provided 1.14 GB flight CSV, so the ready-to-run dashboard does not need a preprocessing step. To regenerate them after changing the source dataset:

```powershell
python prepare_data.py "data/flight_delays_2025_reduced.csv" --output data
```

The source file in the provided folder is named `flight_delays_2025_reduced.csv`; the originally specified `flight_delays_2025.csv` is not present. Keep the source file in `data/` when regenerating the summaries.

## What the data preparation does

`prepare_data.py` reads the full source CSV one row at a time and writes:

- `data/airports.csv` — unique airports and names derived from the source.
- `data/route-monthly.csv` — exact route-by-month flight, outcome, and cancellation-code counts.
- `data/flight-sample.csv` - up to 180 uniformly reservoir-sampled real flights per route for the route-level delay scatterplot.
- `data/flight-sample-all.csv` - a uniform 12,000-flight sample across all airports for the travel-distance scatterplot.
- `data/manifest.json` - source row counts, available cancellation codes, and sampling metadata.

Outcome classification is centralized in the preparer: `Cancelled == 1` is **Cancelled**; otherwise arrival delay of at least 15 minutes is **Delayed**; all remaining flights are **On time**. Route and monthly counts use every valid source row. The delay scatterplot samples up to 180 flights per route. The travel-distance scatterplot samples up to 12,000 flights uniformly across the full dataset, without route filtering; clicking a month in the area chart filters that national sample. Cancelled flights and rows without the required chart values are excluded. The browser loads only compact local CSVs.

## Architecture

- `index.html` — dashboard layout, route search, map area, four chart areas, and flight details.
- `css/style.css` — shared visual system and responsive dashboard layout.
- `js/config.js` — semantic outcome colors and month labels.
- `js/state.js` — shared origin/destination, scatterplot x-axis, outcome, cancellation reason, month, and flight selection.
- `js/data.js` — loads compact CSVs with D3 and assembles reusable route records.
- `js/search.js` — dataset-driven airport search and route validation.
- `js/map.js` — map integration point and shared selection logic.
- `js/sankey.js`, `js/waffle.js`, `js/area.js`, `js/scatter.js` — independent D3 chart modules.
- `js/interactions.js` — shared formatting, empty states, and tooltips.
- `js/main.js` — startup and state-to-view updates.

Search selects a single shared route. Sankey outcome clicks filter the scatterplot, waffle reason clicks focus the cancelled flow, and area month clicks filter the scatterplot. Clicking a scatter point shows the sampled flight details.

## Map data

The flight CSV includes airport codes, cities, and states but no coordinates. `data/us-airports.geojson` adds airport locations from the [FAA 28-Day NASR APT CSV](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-10-01/) effective 2026-10-01 and state outlines from the [U.S. Census Bureau 2025 cartographic boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html) at 1:5,000,000 scale. The map uses flight-data airport codes, and the territory airports appear in inset maps.

Clicking a map point first selects the origin; available destinations are then highlighted. Clear the route to choose a different origin.
