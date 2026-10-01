(function startFlightVisualization(global) {
  const status = document.getElementById("dataset-status");
  const badge = status.closest(".data-badge");
  let dataset = null;
  let lastState = null;
  let resizeTimer = 0;

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function updateRouteMetrics(route) {
    const values = route ? [route.flights, route.onTime, route.delayed, route.cancelled] : null;
    ["metric-flights", "metric-ontime", "metric-delayed", "metric-cancelled"].forEach((id, index) => {
      setText(id, values ? FlightUI.formatNumber(values[index]) : "—");
    });
    if (route) {
      document.getElementById("metric-ontime").title = `${FlightUI.formatPercent(route.onTime, route.flights)} of flights`;
      document.getElementById("metric-delayed").title = `${FlightUI.formatPercent(route.delayed, route.flights)} of flights`;
      document.getElementById("metric-cancelled").title = `${FlightUI.formatPercent(route.cancelled, route.flights)} of flights`;
    }
  }

  function updateVisualizations(state = FlightState.getState()) {
    if (!dataset) return;
    lastState = state;
    const route = FlightData.getRoute(dataset, state.origin, state.destination);
    updateRouteMetrics(route);
    SankeyView.render(route, state, dataset);
    WaffleView.render(route, state);
    AreaView.render(route, state);
    ScatterView.render(route, state, dataset);
    if (state.scatterX === "distance") {
      const visibleFlights = dataset.globalSampleFlights.filter((flight) =>
        (!state.selectedMonth || flight.month === state.selectedMonth)
        && (!state.selectedOutcome || flight.outcome === state.selectedOutcome)).length;
      const selectedOutcome = state.selectedOutcome ? ` · ${state.selectedOutcome.toLowerCase()} flights` : "";
      const selectedMonth = state.selectedMonth ? ` · ${FlightConfig.months[state.selectedMonth - 1]}` : "";
      setText("scatter-note", `All airports · ${FlightUI.formatNumber(visibleFlights)} sampled flights${selectedOutcome}${selectedMonth}. Click a month in the area chart to filter.`);
    } else if (route) {
      const selectedMonth = state.selectedMonth ? ` · ${FlightConfig.months[state.selectedMonth - 1]} filter` : "";
      setText("scatter-note", `Showing ${FlightUI.formatNumber(route.sampleFlights.length)} sampled real flights for this route${selectedMonth}.`);
    } else {
      setText("scatter-note", "Choose a route to compare departure delay with arrival delay.");
    }
  }

  function handleLoadError(error) {
    badge.classList.add("is-error");
    status.textContent = "Data could not be loaded";
    document.getElementById("route-error").hidden = false;
    document.getElementById("route-error").textContent = "Could not load the prepared flight CSVs. Run the project with a local server and keep the data/ files in place.";
    FlightUI.showEmpty("sankey-chart", "Prepared data not found", "Use the local project server and confirm the generated data files are present.");
    FlightUI.showEmpty("waffle-chart", "Prepared data not found", "The source flight CSV is preprocessed into local compact CSVs.");
    FlightUI.showEmpty("area-chart", "Prepared data not found", "Run prepare_data.py once to regenerate the route summaries.");
    FlightUI.showEmpty("scatter-chart", "Prepared data not found", "Run prepare_data.py once to regenerate the flight sample.");
    console.error("Flight data loading failed", error);
  }

  async function initialize() {
    try {
      dataset = await FlightData.loadData();
      FlightSearch.initSearch(dataset);
      FlightMap.initAirportMap(dataset);
      badge.classList.add("is-ready");
      status.textContent = `${FlightUI.formatNumber(dataset.manifest.sourceRows)} flights · ${FlightUI.formatNumber(dataset.manifest.routeCount)} routes`;
      document.querySelector(".metric-note").lastElementChild.textContent = `${FlightUI.formatNumber(dataset.airports.length)} airports · route linked views`;
      FlightState.subscribe(updateVisualizations);
      updateVisualizations(FlightState.getState());
    } catch (error) {
      handleLoadError(error);
    }
  }

  global.addEventListener("resize", () => {
    global.clearTimeout(resizeTimer);
    resizeTimer = global.setTimeout(() => { if (lastState) updateVisualizations(lastState); }, 140);
  });

  initialize();
})(window);
