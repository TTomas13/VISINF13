(function exposeFlightUI(global) {
  const integerFormat = new Intl.NumberFormat("en-US");
  const tooltip = document.getElementById("chart-tooltip");

  function formatNumber(value) {
    return integerFormat.format(value || 0);
  }

  function formatPercent(value, total) {
    return total ? `${(value / total * 100).toFixed(1)}%` : "0%";
  }

  function formatClock(minutes) {
    if (minutes === null || minutes === undefined || !Number.isFinite(+minutes)) return "—";
    const rounded = Math.max(0, Math.round(+minutes));
    const hour = Math.floor(rounded / 60) % 24;
    const minute = rounded % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function showTooltip(event, title, rows) {
    tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong>${rows.map(([label, value]) => `<span>${escapeHtml(label)} · ${escapeHtml(value)}</span>`).join("")}`;
    tooltip.setAttribute("aria-hidden", "false");
    tooltip.classList.add("is-visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const left = Math.min(event.clientX + 13, window.innerWidth - tooltip.offsetWidth - 12);
    const top = Math.min(event.clientY + 13, window.innerHeight - tooltip.offsetHeight - 12);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function showEmpty(containerId, title, message) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "·";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const description = document.createElement("span");
    description.textContent = message;
    empty.append(icon, heading, description);
    container.append(empty);
  }

  global.FlightUI = { formatNumber, formatPercent, formatClock, escapeHtml, showTooltip, moveTooltip, hideTooltip, showEmpty };
})(window);
