(function exposeScatterView(global) {
  function render(route, state, dataset) {
    const id = "scatter-chart";
    const container = document.getElementById(id);
    container.style.height = "";
    const nationalView = state.scatterX === "distance";
    if (!nationalView && !route) return FlightUI.showEmpty(id, "Waiting for a route", "Choose an origin and destination to compare departure and arrival delays.");
    const xValue = nationalView ? (flight) => flight.distance : (flight) => flight.departureDelay;
    const source = nationalView ? dataset.globalSampleFlights : route.sampleFlights;
    let points = source.filter((flight) => Number.isFinite(xValue(flight)) && Number.isFinite(flight.arrivalDelay));
    if (state.selectedMonth) points = points.filter((flight) => flight.month === state.selectedMonth);
    if (state.selectedOutcome) points = points.filter((flight) => flight.outcome === state.selectedOutcome);
    if (!points.length) return FlightUI.showEmpty(id, "No sampled flights match these selections", "Clear the selected month or outcome to see more observations.");

    container.replaceChildren();
    const width = Math.max(container.clientWidth, 300);
    const margin = { top: 20, right: 22, bottom: 48, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.min(174, width * 0.58);
    const height = innerHeight + margin.top + margin.bottom;
    const paddedDelayDomain = (extent) => {
      const low = Math.min(0, extent[0]);
      const high = Math.max(0, extent[1]);
      const padding = Math.max(5, (high - low) * 0.06);
      return [low - padding, high + padding];
    };
    const xExtent = d3.extent(points, xValue);
    const arrivalExtent = d3.extent(points, (flight) => flight.arrivalDelay);
    const sharedDelayExtent = [Math.min(xExtent[0], arrivalExtent[0]), Math.max(xExtent[1], arrivalExtent[1])];
    const sharedDelayDomain = paddedDelayDomain(sharedDelayExtent);
    const xDomain = state.scatterX === "distance"
      ? [0, Math.max(1, xExtent[1] * 1.06)]
      : sharedDelayDomain;
    const yDomain = nationalView ? paddedDelayDomain(arrivalExtent) : sharedDelayDomain;
    const x = d3.scaleLinear().domain(xDomain).nice().range([0, innerWidth]);
    const y = d3.scaleLinear().domain(yDomain).nice().range([innerHeight, 0]);
    const xLabel = state.scatterX === "distance" ? "Travel distance (miles)" : "Departure delay (minutes)";
    const xDescription = state.scatterX === "distance" ? "travel distance" : "departure delay";
    container.style.height = `${height}px`;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", `${xDescription} plotted against arrival delay, in minutes`);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    plot.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
    plot.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(",.0f")));
    plot.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",.0f")));
    plot.append("text").attr("class", "axis-label").attr("x", innerWidth / 2).attr("y", innerHeight + 39).attr("text-anchor", "middle").text(xLabel);
    plot.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("x", -innerHeight / 2).attr("y", -43).attr("text-anchor", "middle").text("Arrival delay (minutes)");

    plot.selectAll("circle.scatter-point").data(points).join("circle")
      .attr("class", (flight) => `scatter-point${state.selectedFlight === flight ? " is-selected" : ""}`)
      .attr("cx", (flight) => x(xValue(flight))).attr("cy", (flight) => y(flight.arrivalDelay)).attr("r", 4)
      .attr("fill", (flight) => FlightConfig.outcomeColors[flight.outcome] || "#7991a2")
      .on("pointerenter", (event, flight) => {
        const date = flight.flightDate || "Flight";
        const routeFields = nationalView ? [["Route", `${flight.origin} → ${flight.destination}`]] : [];
        FlightUI.showTooltip(event, `${date} | ${flight.airline || "Unknown airline"}`, [...routeFields, ["Outcome", flight.outcome], ["Departure delay", flight.departureDelay === null ? "N/A" : `${FlightUI.formatNumber(flight.departureDelay)} min`], ["Arrival delay", flight.arrivalDelay === null ? "N/A" : `${FlightUI.formatNumber(flight.arrivalDelay)} min`], ["Distance", flight.distance === null ? "N/A" : `${FlightUI.formatNumber(flight.distance)} mi`]]);
      })
      .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip)
      .on("click", (_event, flight) => FlightState.setSelectedFlight(flight));
  }

  global.ScatterView = { render };
})(window);
