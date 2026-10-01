(function exposeAirportMap(global) {
  const container = document.getElementById("airport-map");
  let data = null;
  let resizeObserver = null;
  let resizeTimer = 0;

  function render(state) {
    const prompt = document.getElementById("map-selection-prompt");
    document.getElementById("map-clear-route").disabled = !state.origin && !state.destination;
    if (state.origin && state.destination) {
      prompt.textContent = `Route ${state.origin} to ${state.destination}. Click a highlighted destination to change it, or clear the route to choose a new origin.`;
    } else if (state.origin) {
      const count = FlightData.getDestinations(data, state.origin).length;
      prompt.textContent = `Origin ${state.origin} selected. ${count} available destinations are highlighted.`;
    } else {
      prompt.textContent = "Click an airport to choose the origin.";
    }
    if (!data?.manifest.geographyAvailable) {
      container.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "map-empty";
      const icon = document.createElement("span");
      icon.className = "map-empty-icon";
      icon.textContent = "Map";
      const heading = document.createElement("strong");
      heading.textContent = "Airport coordinates are not available";
      const description = document.createElement("p");
      description.textContent = "Add local airport coordinates to enable geographic selection. The airport search still works without the map.";
      empty.append(icon, heading, description);
      if (state.origin && state.destination) {
        const selected = document.createElement("span");
        selected.className = "map-route-current";
        selected.textContent = `${state.origin} to ${state.destination}`;
        empty.append(selected);
      }
      container.append(empty);
      return;
    }
    if (!data.airportGeography) {
      container.replaceChildren();
      const loading = document.createElement("div");
      loading.className = "loading-state";
      const spinner = document.createElement("span");
      spinner.className = "loader";
      const message = document.createElement("span");
      message.textContent = "Loading airport map...";
      loading.append(spinner, message);
      container.append(loading);
      return;
    }
    container.querySelectorAll(".map-empty, .loading-state").forEach((element) => element.remove());
    renderGeoJson(state);
  }

  function renderGeoJson(state) {
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 250);
    const features = data.airportGeography.features || [];
    const airports = features.filter((feature) => feature.geometry?.type === "Point" && feature.properties?.code);
    const stateFeatures = features.filter((feature) => feature.geometry?.type !== "Point");
    const stateGeometry = { type: "FeatureCollection", features: stateFeatures };
    const projection = d3.geoAlbersUsa().fitExtent([[42, 40], [Math.max(220, width - 160), height - 44]], stateGeometry);
    const path = d3.geoPath(projection);
    const airportFlightCounts = new Map(data.airports.map((airport) => [airport.code, 0]));
    for (const route of data.routes.values()) {
      airportFlightCounts.set(route.origin, (airportFlightCounts.get(route.origin) || 0) + route.flights);
    }
    const maximumAirportFlights = d3.max(airportFlightCounts.values()) || 1;
    const trafficColor = d3.scaleSequential(d3.interpolateRgbBasis(["#8fa9b8", "#72aab9", "#e1a04b", "#bb4d49"]))
      .domain([0, Math.sqrt(maximumAirportFlights)]);
    const airportColor = (feature) => trafficColor(Math.sqrt(airportFlightCounts.get(feature.properties.code) || 0));
    const svg = d3.select(container).selectAll("svg").data([null]).join("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Map of airports in the United States and territories");

    svg.selectAll("path.state-shape")
      .data(stateFeatures)
      .join("path")
      .attr("class", "state-shape")
      .attr("d", path)
      .attr("fill", "#fffdfa")
      .attr("stroke", "#c9bdb5")
      .attr("stroke-width", 0.8)
      .attr("pointer-events", "none");

    const pointLayer = svg.selectAll("g.main-airports").data([null]).join("g").attr("class", "main-airports");
    const mainAirports = airports.filter((feature) => projection(feature.geometry.coordinates));
    const availableDestinations = new Set(FlightData.getDestinations(data, state.origin).map((airport) => airport.code));
    drawAirportPoints(pointLayer.selectAll("circle.airport-point").data(mainAirports, (feature) => feature.properties.code).join("circle"), state, availableDestinations, (feature) => projection(feature.geometry.coordinates), airportColor, airportFlightCounts);

    const territoryGroups = [
      { key: "caribbean", label: "Caribbean: PR / VI", airports: airports.filter((feature) => ["PR", "VI"].includes(feature.properties.state)) },
      { key: "pacific-north", label: "Guam / N. Mariana Is.", airports: airports.filter((feature) => feature.properties.state === "TT" && feature.properties.code !== "PPG") },
      { key: "pacific-south", label: "American Samoa", airports: airports.filter((feature) => feature.properties.code === "PPG") },
    ].filter((group) => group.airports.length);
    const boxWidth = Math.min(124, Math.max(100, width * 0.3));
    const boxHeight = 48;
    const boxGap = 5;
    const firstY = height - 16 - territoryGroups.length * boxHeight - (territoryGroups.length - 1) * boxGap;
    const insetLayer = svg.selectAll("g.airport-insets").data([null]).join("g").attr("class", "airport-insets");
    const insets = insetLayer.selectAll("g.airport-inset").data(territoryGroups, (group) => group.key).join("g").attr("class", "airport-inset");
    insets.each(function (group, index) {
      const x0 = width - boxWidth - 8;
      const y0 = firstY + index * (boxHeight + boxGap);
      const innerExtent = [[x0 + 6, y0 + 17], [x0 + boxWidth - 6, y0 + boxHeight - 5]];
      const insetProjection = group.airports.length > 1
        ? d3.geoMercator().fitExtent(innerExtent, { type: "FeatureCollection", features: group.airports })
        : null;
      const inset = d3.select(this);
      inset.selectAll("rect.map-inset-frame").data([group]).join("rect")
        .attr("class", "map-inset-frame").attr("x", x0).attr("y", y0).attr("width", boxWidth).attr("height", boxHeight).attr("rx", 5);
      inset.selectAll("text.map-inset-label").data([group]).join("text")
        .attr("class", "map-inset-label").attr("x", x0 + 6).attr("y", y0 + 11).text(group.label);
      const points = inset.selectAll("circle.airport-point").data(group.airports, (feature) => feature.properties.code).join("circle");
      drawAirportPoints(points, state, availableDestinations, (feature) => insetProjection
        ? insetProjection(feature.geometry.coordinates)
        : [x0 + boxWidth / 2, y0 + 31], airportColor, airportFlightCounts);
    });
  }

  function drawAirportPoints(selection, state, availableDestinations, position, airportColor, airportFlightCounts) {
    selection
      .attr("class", (feature) => {
        const code = feature.properties.code;
        const isUnavailable = Boolean(state.origin && code !== state.origin && !availableDestinations.has(code));
        return `airport-point${code === state.origin ? " is-origin" : ""}${code === state.destination ? " is-destination" : ""}${state.origin && code !== state.origin && availableDestinations.has(code) ? " is-available-destination" : ""}${isUnavailable ? " is-unavailable" : ""}`;
      })
      .attr("cx", (feature) => position(feature)?.[0] ?? -100)
      .attr("cy", (feature) => position(feature)?.[1] ?? -100)
      .style("fill", (feature) => {
        if (feature.properties.code === state.origin) return "#397ba0";
        if (state.origin && availableDestinations.has(feature.properties.code)) return "#8fa9b8";
        return airportColor(feature);
      })
      .attr("r", (feature) => [state.origin, state.destination].includes(feature.properties.code) ? 5 : availableDestinations.has(feature.properties.code) && state.origin ? 3.5 : 2.8)
      .on("pointerenter", (event, feature) => FlightUI.showTooltip(event, feature.properties.code, [["Airport", feature.properties.city || feature.properties.code], ["State", feature.properties.state || "N/A"], ["Departures", FlightUI.formatNumber(airportFlightCounts.get(feature.properties.code) || 0)]]))
      .on("pointermove", FlightUI.moveTooltip)
      .on("pointerleave", FlightUI.hideTooltip)
      .on("click", (_event, feature) => {
        const current = FlightState.getState();
        const code = feature.properties.code;
        if (!current.origin) {
          FlightState.setRoute(code, null);
        } else if (code !== current.origin && availableDestinations.has(code)) {
          FlightState.setRoute(current.origin, code);
        }
      });
  }

  function initAirportMap(dataset) {
    data = dataset;
    document.getElementById("map-clear-route").addEventListener("click", () => FlightState.clearRoute());
    if (global.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        global.clearTimeout(resizeTimer);
        resizeTimer = global.setTimeout(() => render(FlightState.getState()), 80);
      });
      resizeObserver.observe(container);
    } else {
      global.addEventListener("resize", () => render(FlightState.getState()));
    }
    FlightState.subscribe(render);
    if (dataset.manifest.geographyAvailable) {
      d3.json("data/us-airports.geojson").then((geoJson) => {
        data.airportGeography = geoJson;
        render(FlightState.getState());
      }).catch(() => {
        data.manifest.geographyAvailable = false;
        render(FlightState.getState());
      });
    }
  }

  global.FlightMap = { initAirportMap };
})(window);
