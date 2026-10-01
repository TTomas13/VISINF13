(function exposeRouteSearch(global) {
  let dataset = null;
  const originInput = document.getElementById("origin-search");
  const destinationInput = document.getElementById("destination-search");
  const originOptions = document.getElementById("airport-options");
  const destinationOptions = document.getElementById("destination-options");
  const routeError = document.getElementById("route-error");

  function airportLabel(airport) {
    return `${airport.code} — ${airport.city}${airport.state ? `, ${airport.state}` : ""}`;
  }

  function fillOptions(list, airports) {
    list.replaceChildren();
    for (const airport of airports) {
      const option = document.createElement("option");
      option.value = airportLabel(airport);
      option.label = airport.code;
      list.append(option);
    }
  }

  function resolveAirport(value, options) {
    const query = value.trim();
    if (!query) return { airport: null, error: null };
    const normalized = query.toLocaleLowerCase();
    const airportList = options || dataset.airports;
    const codeMatch = normalized.match(/\b([a-z0-9]{3,4})\b/);
    if (codeMatch) {
      const byCode = airportList.find((airport) => airport.code.toLocaleLowerCase() === codeMatch[1]);
      if (byCode) return { airport: byCode, error: null };
    }

    const matches = airportList.filter((airport) => `${airport.city} ${airport.state}`.toLocaleLowerCase().includes(normalized));
    if (matches.length === 1) return { airport: matches[0], error: null };
    if (matches.length > 1) return { airport: null, error: `More than one airport matches “${query}”. Choose an airport code from the list.` };
    return { airport: null, error: `No airport found for “${query}”. Choose an airport from the dataset list.` };
  }

  function setError(message = "") {
    routeError.textContent = message;
    routeError.hidden = !message;
  }

  function routeIsAvailable(origin, destination) {
    return dataset.routes.has(dataset.routeKey(origin, destination));
  }

  function renderRoute(state) {
    const origin = dataset?.airportByCode.get(state.origin);
    const destination = dataset?.airportByCode.get(state.destination);
    originInput.value = origin ? airportLabel(origin) : "";
    destinationInput.value = destination ? airportLabel(destination) : "";
    const routeText = document.getElementById("selected-route");
    const metaText = document.getElementById("route-summary-meta");
    const resetButton = document.getElementById("reset-route");
    const complete = origin && destination;
    routeText.textContent = complete ? `${origin.code}  →  ${destination.code}` : "Select an origin and destination";
    metaText.textContent = complete ? `${origin.city} → ${destination.city}` : "The search options come from the flight dataset.";
    resetButton.disabled = !state.origin && !state.destination;
    document.querySelectorAll(".axis-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.axis === state.scatterX);
      button.disabled = button.dataset.axis === "departureDelay" && !complete;
    });
    if (state.origin) {
      const validDestinations = FlightData.getDestinations(dataset, state.origin);
      fillOptions(destinationOptions, validDestinations);
      destinationInput.disabled = false;
      destinationInput.placeholder = "Search code or city";
    } else {
      fillOptions(destinationOptions, dataset.airports);
      destinationInput.disabled = true;
      destinationInput.placeholder = "Choose an origin first";
    }
  }

  function handleOriginChange() {
    setError("");
    const result = resolveAirport(originInput.value, dataset.airports);
    if (result.error) return setError(result.error);
    if (!result.airport) {
      FlightState.setRoute(null, null);
      return;
    }
    const currentState = FlightState.getState();
    const keepDestination = currentState.destination && routeIsAvailable(result.airport.code, currentState.destination) ? currentState.destination : null;
    FlightState.setRoute(result.airport.code, keepDestination);
  }

  function handleDestinationChange() {
    setError("");
    const state = FlightState.getState();
    if (!state.origin) return setError("Choose an origin airport first.");
    const result = resolveAirport(destinationInput.value, FlightData.getDestinations(dataset, state.origin));
    if (result.error) return setError(result.error);
    if (!result.airport) {
      FlightState.setRoute(state.origin, null);
      return;
    }
    if (!routeIsAvailable(state.origin, result.airport.code)) {
      return setError(`No flights from ${state.origin} to ${result.airport.code} appear in this dataset.`);
    }
    FlightState.setRoute(state.origin, result.airport.code);
  }

  function initSearch(data) {
    dataset = data;
    fillOptions(originOptions, data.airports);
    fillOptions(destinationOptions, data.airports);
    originInput.disabled = false;
    destinationInput.disabled = false;
    originInput.addEventListener("change", handleOriginChange);
    destinationInput.addEventListener("change", handleDestinationChange);
    originInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); originInput.blur(); } });
    destinationInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); destinationInput.blur(); } });
    document.getElementById("reset-route").addEventListener("click", () => { setError(""); FlightState.clearRoute(); });
    document.querySelectorAll(".axis-button").forEach((button) => button.addEventListener("click", () => FlightState.setScatterX(button.dataset.axis)));
    FlightState.subscribe(renderRoute);
  }

  global.FlightSearch = { initSearch, resolveAirport };
})(window);
