(function exposeConfig(global) {
  const outcomeColors = {
    "On time": "#39927d",
    Delayed: "#e5a13b",
    Cancelled: "#d76564",
  };
  const cancellationPalette = ["#447da0", "#d18b3f", "#8878ad", "#4d9b8b", "#c66b65", "#7390b8"];
  const cancellationColors = Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((code, index) => [code, cancellationPalette[index % cancellationPalette.length]]));
  const cancellationLabels = { A: "Air carrier", B: "Weather", C: "National Aviation System", D: "Security" };
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  global.FlightConfig = { outcomeColors, cancellationColors, cancellationPalette, cancellationLabels, months };
})(window);
