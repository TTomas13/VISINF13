(function exposeFlightState(global) {
  const listeners = new Set();
  let state = {
    origin: null,
    destination: null,
    scatterX: "departureDelay",
    selectedOutcome: null,
    selectedCancellationReason: null,
    selectedMonth: null,
    selectedFlight: null,
  };

  function notify() {
    for (const listener of listeners) listener(state);
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  function update(patch) {
    state = { ...state, ...patch };
    notify();
  }

  function setRoute(origin, destination) {
    if (origin && destination && origin === destination) return false;
    const changed = state.origin !== origin || state.destination !== destination;
    if (changed) update({ origin, destination, selectedOutcome: null, selectedCancellationReason: null, selectedMonth: null, selectedFlight: null });
    return true;
  }

  function clearRoute() {
    update({ origin: null, destination: null, selectedOutcome: null, selectedCancellationReason: null, selectedMonth: null, selectedFlight: null });
  }

  function setScatterX(scatterX) {
    if (scatterX !== "departureDelay" && scatterX !== "distance") return;
    if (state.scatterX !== scatterX) update({ scatterX, selectedFlight: null });
  }

  function setSelectedOutcome(outcome) {
    update({ selectedOutcome: state.selectedOutcome === outcome ? null : outcome, selectedFlight: null });
  }

  function setSelectedCancellationReason(reason) {
    update({ selectedCancellationReason: state.selectedCancellationReason === reason ? null : reason, selectedFlight: null });
  }

  function setSelectedMonth(month) {
    update({ selectedMonth: state.selectedMonth === month ? null : month, selectedFlight: null });
  }

  function setSelectedFlight(flight) {
    update({ selectedFlight: flight });
  }

  global.FlightState = { getState, subscribe, setRoute, clearRoute, setScatterX, setSelectedOutcome, setSelectedCancellationReason, setSelectedMonth, setSelectedFlight };
})(window);
