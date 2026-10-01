(function exposeSankey(global) {
  const colors = FlightConfig.outcomeColors;

  function render(route, state, data) {
    const id = "sankey-chart";
    if (!route) return FlightUI.showEmpty(id, "Select a route to begin", "Outcomes will appear here.");
    if (!route.flights) return FlightUI.showEmpty(id, "No flights for this route", "Choose an origin and destination with flights in the dataset.");

    const container = document.getElementById(id);
    container.replaceChildren();
    const width = Math.max(container.clientWidth, 360);
    const height = 242;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", `Flight outcome flow for ${route.origin} to ${route.destination}`);
    const outcomes = [
      { name: "On time", value: route.onTime },
      { name: "Delayed", value: route.delayed },
      { name: "Cancelled", value: route.cancelled },
    ];
    const flowScale = d3.scaleLinear().domain([0, route.flights]).range([1.5, 43]);
    const origin = data.airportByCode.get(route.origin);
    const destination = data.airportByCode.get(route.destination);
    const sourceX = 27;
    const destinationX = Math.max(width * .44, 220);
    const outcomeX = width - 125;
    const nodeWidth = 13;
    const sourceY = height / 2;
    const outcomeY = [55, 121, 187];
    const link = d3.linkHorizontal().x((point) => point.x).y((point) => point.y);

    svg.append("text").attr("class", "chart-label-muted").attr("x", sourceX - 4).attr("y", 18).text("ORIGIN");
    svg.append("text").attr("class", "chart-label-muted").attr("x", destinationX - 4).attr("y", 18).text("DESTINATION");
    svg.append("text").attr("class", "chart-label-muted").attr("x", outcomeX - 4).attr("y", 18).text("OUTCOME");

    const sourceTargetLink = svg.append("path")
      .attr("class", "sankey-link")
      .attr("d", link({ source: { x: sourceX + nodeWidth, y: sourceY }, target: { x: destinationX, y: sourceY } }))
      .attr("stroke", "#7894a6")
      .attr("stroke-width", flowScale(route.flights));
    sourceTargetLink
      .on("pointerenter", (event) => FlightUI.showTooltip(event, `${route.origin} → ${route.destination}`, [["Flights", FlightUI.formatNumber(route.flights)], ["Route share", "100%"]]))
      .on("pointermove", FlightUI.moveTooltip)
      .on("pointerleave", FlightUI.hideTooltip);

    const flows = svg.selectAll("path.outcome-flow").data(outcomes).join("path")
      .attr("class", (item) => `sankey-link outcome-flow${state.selectedOutcome === item.name ? " is-selected" : ""}`)
      .attr("d", (item, index) => link({ source: { x: destinationX + nodeWidth, y: sourceY }, target: { x: outcomeX, y: outcomeY[index] } }))
      .attr("stroke", (item) => colors[item.name])
      .attr("stroke-width", (item) => item.value ? flowScale(item.value) : 0)
      .attr("opacity", (item) => state.selectedOutcome && state.selectedOutcome !== item.name ? .13 : 1)
      .style("cursor", "pointer");
    flows
      .on("pointerenter", (event, item) => {
        d3.select(event.currentTarget).attr("stroke-opacity", .85);
        FlightUI.showTooltip(event, item.name, [["Flights", FlightUI.formatNumber(item.value)], ["Of route", FlightUI.formatPercent(item.value, route.flights)]]);
      })
      .on("pointermove", FlightUI.moveTooltip)
      .on("pointerleave", (event) => { d3.select(event.currentTarget).attr("stroke-opacity", .25); FlightUI.hideTooltip(); })
      .on("click", (_event, item) => FlightState.setSelectedOutcome(item.name));

    const nodeData = [
      { code: route.origin, city: origin?.city || "Origin", x: sourceX, y: sourceY - 27, h: 54, fill: "#37749a", total: route.flights },
      { code: route.destination, city: destination?.city || "Destination", x: destinationX, y: sourceY - 27, h: 54, fill: "#64879c", total: route.flights },
    ];
    svg.selectAll("g.sankey-node").data(nodeData).join("g").attr("class", "sankey-node")
      .each(function (node) {
        const group = d3.select(this);
        group.append("rect").attr("x", node.x).attr("y", node.y).attr("width", nodeWidth).attr("height", node.h).attr("rx", 3).attr("fill", node.fill);
        group.append("text").attr("x", node.x + nodeWidth / 2).attr("y", node.y + node.h + 16).attr("text-anchor", "middle").attr("font-weight", 700).text(node.code);
        group.append("text").attr("x", node.x + nodeWidth / 2).attr("y", node.y + node.h + 29).attr("text-anchor", "middle").text(node.total ? `${FlightUI.formatNumber(node.total)} flights` : "0 flights");
        group.on("pointerenter", (event) => FlightUI.showTooltip(event, `${node.code} · ${node.city}`, [["Flights on route", FlightUI.formatNumber(node.total)]]))
          .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip);
      });

    const outcomeNodes = svg.selectAll("g.outcome-node").data(outcomes).join("g").attr("class", "sankey-node outcome-node")
      .style("cursor", "pointer")
      .on("click", (_event, item) => FlightState.setSelectedOutcome(item.name))
      .on("pointerenter", (event, item) => FlightUI.showTooltip(event, item.name, [["Flights", FlightUI.formatNumber(item.value)], ["Of route", FlightUI.formatPercent(item.value, route.flights)]]))
      .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip);
    outcomeNodes.each(function (item, index) {
      const group = d3.select(this);
      group.append("rect").attr("x", outcomeX).attr("y", outcomeY[index] - 17).attr("width", nodeWidth).attr("height", 34).attr("rx", 3).attr("fill", colors[item.name]).attr("opacity", item.value ? 1 : .26);
      group.append("text").attr("x", outcomeX + 21).attr("y", outcomeY[index] - 2).attr("font-weight", 700).attr("fill", colors[item.name]).text(item.name);
      group.append("text").attr("x", outcomeX + 21).attr("y", outcomeY[index] + 12).text(`${FlightUI.formatNumber(item.value)} · ${FlightUI.formatPercent(item.value, route.flights)}`);
      if (state.selectedOutcome && state.selectedOutcome !== item.name) group.attr("opacity", .4);
      if (state.selectedOutcome === item.name) group.attr("opacity", 1);
    });

    if (state.selectedCancellationReason) {
      svg.append("text").attr("x", width - 15).attr("y", height - 9).attr("text-anchor", "end").attr("fill", "#8f7072").attr("font-size", 8).text(`Cancellation code ${state.selectedCancellationReason} highlighted`);
    }
  }

  global.SankeyView = { render };
})(window);
