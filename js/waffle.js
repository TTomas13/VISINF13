(function exposeWaffle(global) {
  function allocateCells(categories, total, cellCount) {
    const portions = categories.map((category) => {
      const exact = category.value / total * cellCount;
      return { ...category, cells: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let remaining = cellCount - d3.sum(portions, (item) => item.cells);
    const ranked = [...portions].sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; index < remaining; index += 1) ranked[index % ranked.length].cells += 1;
    const cells = portions.flatMap((category) => Array.from({ length: category.cells }, () => category));
    return cells.slice(0, cellCount);
  }

  function render(route, state) {
    const id = "waffle-chart";
    if (!route) return FlightUI.showEmpty(id, "Waiting for a route", "Cancellation codes will be grouped here.");
    if (!route.cancelled) return FlightUI.showEmpty(id, "No cancellations on this route", "This route has no cancelled flights in the 2025 data.");

    const categories = Object.entries(route.cancellationReasons)
      .map(([code, value]) => ({ code, label: `${FlightConfig.cancellationLabels[code] || "Code"} (${code})`, value, color: FlightConfig.cancellationColors[code] || FlightConfig.cancellationPalette[0] }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const knownTotal = d3.sum(categories, (item) => item.value);
    if (!knownTotal) return FlightUI.showEmpty(id, "Cancellation codes were not recorded", `${FlightUI.formatNumber(route.cancelled)} cancelled flights have no reason code in the source data.`);

    const container = document.getElementById(id);
    container.replaceChildren();
    const width = Math.max(container.clientWidth, 340);
    const height = 242;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", "Cancellation reason waffle chart");
    const cols = 10;
    const rows = 10;
    const gap = 3;
    const square = Math.min(17, (height - 54 - gap * (rows - 1)) / rows, (width * .44 - gap * (cols - 1)) / cols);
    const gridWidth = cols * square + (cols - 1) * gap;
    const gridHeight = rows * square + (rows - 1) * gap;
    const gridX = 10;
    const gridY = (height - gridHeight) / 2;
    const cells = allocateCells(categories, knownTotal, cols * rows).map((category, index) => ({ ...category, index }));

    svg.selectAll("rect.waffle-cell").data(cells).join("rect")
      .attr("class", (cell) => `waffle-cell${state.selectedCancellationReason === cell.code ? " is-selected" : ""}`)
      .attr("x", (cell) => gridX + cell.index % cols * (square + gap))
      .attr("y", (cell) => gridY + Math.floor(cell.index / cols) * (square + gap))
      .attr("width", square).attr("height", square).attr("rx", 2)
      .attr("fill", (cell) => cell.color)
      .attr("opacity", (cell) => state.selectedCancellationReason && state.selectedCancellationReason !== cell.code ? .23 : .92)
      .on("pointerenter", (event, cell) => FlightUI.showTooltip(event, cell.label, [["Cancelled flights", FlightUI.formatNumber(cell.value)], ["Share of coded cancellations", FlightUI.formatPercent(cell.value, knownTotal)]]))
      .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip)
      .on("click", (_event, cell) => FlightState.setSelectedCancellationReason(cell.code));

    const legendX = gridX + gridWidth + 22;
    const legendY = Math.max(28, gridY + 11);
    svg.append("text").attr("class", "chart-label-muted").attr("x", gridX).attr("y", 17).text("100 CELLS · SHARE OF CODES PRESENT");
    const legend = svg.selectAll("g.waffle-legend").data(categories).join("g").attr("class", "waffle-legend")
      .attr("transform", (_item, index) => `translate(${legendX},${legendY + index * 38})`)
      .style("cursor", "pointer")
      .on("pointerenter", (event, item) => FlightUI.showTooltip(event, item.label, [["Cancelled flights", FlightUI.formatNumber(item.value)], ["Share", FlightUI.formatPercent(item.value, knownTotal)]]))
      .on("pointermove", FlightUI.moveTooltip).on("pointerleave", FlightUI.hideTooltip)
      .on("click", (_event, item) => FlightState.setSelectedCancellationReason(item.code));
    legend.append("circle").attr("r", 4).attr("cx", 0).attr("cy", 0).attr("fill", (item) => item.color);
    legend.append("text").attr("class", "chart-label").attr("x", 10).attr("y", -2).attr("font-weight", 700).text((item) => item.label);
    legend.append("text").attr("class", "chart-label-muted").attr("x", 10).attr("y", 11).text((item) => `${FlightUI.formatNumber(item.value)} · ${FlightUI.formatPercent(item.value, knownTotal)}`);

    const missingCodes = route.cancelled - knownTotal;
    if (missingCodes > 0) svg.append("text").attr("class", "chart-label-muted").attr("x", legendX).attr("y", Math.min(height - 13, legendY + categories.length * 38 + 4)).text(`${FlightUI.formatNumber(missingCodes)} without a code`);
  }

  global.WaffleView = { render };
})(window);
