(function exposeAreaView(global) {
  function render(route, state) {
    const id = "area-chart";
    if (!route) return FlightUI.showEmpty(id, "Waiting for a route", "Monthly disruptions will appear here.");
    const container = document.getElementById(id);
    container.replaceChildren();
    const width = Math.max(container.clientWidth, 360);
    const height = 242;
    const margin = { top: 32, right: 17, bottom: 39, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const data = route.months;
    const maxValue = d3.max(data, (item) => item.delayed + item.cancelled) || 1;
    const x = d3.scalePoint().domain(d3.range(1, 13)).range([0, innerWidth]).padding(.4);
    const y = d3.scaleLinear().domain([0, maxValue * 1.12]).nice().range([innerHeight, 0]);
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", "Monthly area chart of delayed and cancelled flights");
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const stacked = d3.stack().keys(["delayed", "cancelled"])(data);
    const fill = d3.scaleOrdinal().domain(["delayed", "cancelled"]).range([FlightConfig.outcomeColors.Delayed, FlightConfig.outcomeColors.Cancelled]);
    const area = d3.area().x((item) => x(item.data.month)).y0((item) => y(item[0])).y1((item) => y(item[1])).curve(d3.curveMonotoneX);

    plot.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(4).tickSize(-innerWidth).tickFormat(""));
    plot.selectAll("rect.month-hit").data(data).join("rect").attr("class", (item) => `month-hit${state.selectedMonth === item.month ? " is-selected" : ""}`)
      .attr("x", (item) => x(item.month) - innerWidth / 24).attr("y", 0).attr("width", innerWidth / 12).attr("height", innerHeight)
      .on("pointerenter", (event, item) => FlightUI.showTooltip(event, FlightConfig.months[item.month - 1], [["Flights", FlightUI.formatNumber(item.flights)], ["Delayed", FlightUI.formatNumber(item.delayed)], ["Cancelled", FlightUI.formatNumber(item.cancelled)]]))
      .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip)
      .on("click", (_event, item) => FlightState.setSelectedMonth(item.month));
    plot.selectAll("path.area-layer").data(stacked).join("path").attr("class", "area-layer")
      .attr("d", area).attr("fill", (series) => fill(series.key)).attr("fill-opacity", .65).attr("stroke", (series) => fill(series.key)).attr("stroke-width", 1.2).attr("pointer-events", "none");
    plot.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat((month) => FlightConfig.months[month - 1]));
    plot.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")));

    const legend = svg.append("g").attr("transform", `translate(${margin.left},14)`);
    [["Delayed", FlightConfig.outcomeColors.Delayed], ["Cancelled", FlightConfig.outcomeColors.Cancelled]].forEach(([label, color], index) => {
      const item = legend.append("g").attr("transform", `translate(${index * 86},0)`);
      item.append("circle").attr("r", 4).attr("cy", 0).attr("fill", color);
      item.append("text").attr("class", "chart-label-muted").attr("x", 9).attr("y", 3).text(label);
    });
    if (state.selectedMonth) {
      svg.append("text").attr("x", width - 14).attr("y", 17).attr("text-anchor", "end").attr("class", "chart-label-muted").text(`${FlightConfig.months[state.selectedMonth - 1]} selected · click again to clear`);
    }
  }

  global.AreaView = { render };
})(window);
