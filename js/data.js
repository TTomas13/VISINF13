(function exposeFlightData(global) {
  const routeKey = (origin, destination) => `${origin}|${destination}`;
  const numeric = (value) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };
  const optionalNumeric = (value) => value === undefined || value === "" ? null : numeric(value);

  async function loadData() {
    const [airportRows, monthlyRows, sampleRows, globalSampleRows, manifest] = await Promise.all([
      d3.csv("data/airports.csv"),
      d3.csv("data/route-monthly.csv"),
      d3.csv("data/flight-sample.csv"),
      d3.csv("data/flight-sample-all.csv"),
      d3.json("data/manifest.json"),
    ]);

    const airports = airportRows.map((row) => ({ code: row.code, city: row.city, state: row.state }));
    const airportByCode = new Map(airports.map((airport) => [airport.code, airport]));
    const routes = new Map();
    const cancellationCodes = manifest.cancellationCodes || [];

    for (const row of monthlyRows) {
      const key = routeKey(row.origin, row.destination);
      let route = routes.get(key);
      if (!route) {
        route = {
          origin: row.origin,
          destination: row.destination,
          months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, flights: 0, onTime: 0, delayed: 0, cancelled: 0 })),
          cancellationReasons: Object.fromEntries(cancellationCodes.map((code) => [code, 0])),
          sampleFlights: [],
          flights: 0,
          onTime: 0,
          delayed: 0,
          cancelled: 0,
        };
        routes.set(key, route);
      }

      const month = numeric(row.month);
      if (month < 1 || month > 12) continue;
      const monthly = route.months[month - 1];
      monthly.flights += numeric(row.flights);
      monthly.onTime += numeric(row.onTime);
      monthly.delayed += numeric(row.delayed);
      monthly.cancelled += numeric(row.cancelled);
      route.flights += numeric(row.flights);
      route.onTime += numeric(row.onTime);
      route.delayed += numeric(row.delayed);
      route.cancelled += numeric(row.cancelled);

      for (const code of cancellationCodes) {
        const count = numeric(row[`cancel_${code}`]);
        monthly[`cancel_${code}`] = (monthly[`cancel_${code}`] || 0) + count;
        route.cancellationReasons[code] += count;
      }
    }

    for (const row of sampleRows) {
      const route = routes.get(routeKey(row.origin, row.destination));
      if (!route) continue;
      route.sampleFlights.push({
        flightDate: row.flightDate,
        month: numeric(row.month),
        airline: row.airline,
        origin: row.origin,
        destination: row.destination,
        distance: optionalNumeric(row.distance),
        departureDelay: optionalNumeric(row.departureDelay),
        arrivalDelay: optionalNumeric(row.arrivalDelay),
        outcome: row.outcome,
        cancellationCode: row.cancellationCode,
      });
    }

    const globalSampleFlights = globalSampleRows.map((row) => ({
      origin: row.origin,
      destination: row.destination,
      flightDate: row.flightDate,
      month: numeric(row.month),
      airline: row.airline,
      distance: optionalNumeric(row.distance),
      departureDelay: optionalNumeric(row.departureDelay),
      arrivalDelay: optionalNumeric(row.arrivalDelay),
      outcome: row.outcome,
      cancellationCode: row.cancellationCode,
    }));

    return { airports, airportByCode, routes, manifest, cancellationCodes, globalSampleFlights, routeKey };
  }

  function getRoute(data, origin, destination) {
    if (!origin || !destination) return null;
    return data.routes.get(data.routeKey(origin, destination)) || null;
  }

  function getDestinations(data, origin) {
    if (!origin) return [];
    return [...data.routes.values()].filter((route) => route.origin === origin).map((route) => data.airportByCode.get(route.destination)).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
  }

  global.FlightData = { loadData, getRoute, getDestinations, routeKey };
})(window);
