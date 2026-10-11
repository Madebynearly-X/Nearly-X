(() => {
  const statusMap = {
    New: "status-new",
    Contacted: "status-contacted",
    Qualified: "status-qualified",
    "Proposal sent": "status-proposal",
    Won: "status-won",
    Lost: "status-lost",
  };

  const statusNode = document.querySelector("#dashboard-status");
  const summaryNode = document.querySelector("#status-breakdown");
  const tableBody = document.querySelector("#lead-table-body");
  const statEls = {
    total: document.querySelector('[data-stat="total"]'),
    new: document.querySelector('[data-stat="new"]'),
    awaiting: document.querySelector('[data-stat="awaiting"]'),
    overdue: document.querySelector('[data-stat="overdue"]'),
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderStatusBreakdown(summary) {
    if (!summary || !summary.status_counts || Object.keys(summary.status_counts).length === 0) {
      summaryNode.innerHTML = '<div class="empty-state">No lead status data yet.</div>';
      return;
    }

    const statuses = Object.entries(summary.status_counts)
      .sort((a, b) => b[1] - a[1]);

    summaryNode.innerHTML = statuses.map(([status, count]) => `
      <article class="stat-card">
        <span class="stat-label">${escapeHtml(status)}</span>
        <strong class="stat-value">${escapeHtml(count)}</strong>
      </article>
    `).join("");
  }

  function renderRows(leads) {
    if (!Array.isArray(leads) || leads.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No live lead rows yet. Once the first enquiry arrives, it will appear here.</div></td></tr>';
      return;
    }

    tableBody.innerHTML = leads.slice(0, 12).map((lead) => {
      const status = lead.status || "New";
      const className = Object.prototype.hasOwnProperty.call(statusMap, status) ? statusMap[status] : "status-new";
      return `
        <tr>
          <td>${escapeHtml(lead.name || "Unnamed lead")}</td>
          <td>${escapeHtml(lead.business || "—")}</td>
          <td>${escapeHtml(lead.package || "Not sure")}</td>
          <td>${escapeHtml(lead.source || "website")}</td>
          <td><span class="status-pill ${className}">${escapeHtml(status)}</span></td>
          <td>${formatDate(lead.follow_up_date || lead.last_contacted)}</td>
          <td>${formatDate(lead.received_at)}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadDashboard() {
    if (window.location.protocol === "file:") {
      statusNode.textContent = "This dashboard must be viewed from the deployed Cloudflare Pages site so the /api/leads-summary endpoint exists.";
      statusNode.className = "empty-state";
      tableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Open this page from the Pages preview or production domain to load live lead data.</div></td></tr>';
      summaryNode.innerHTML = '<div class="empty-state">Live data is unavailable when the page is opened directly from disk.</div>';
      return;
    }

    try {
      const response = await fetch("/api/leads-summary", { headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      const isJsonResponse = contentType.includes("application/json");
      const result = isJsonResponse ? await response.json() : null;

      if (!response.ok || !result || result.success !== true) {
        const fallbackMessage = isJsonResponse
          ? (result && result.message) || "The lead dashboard is unavailable right now."
          : "The lead dashboard endpoint is not available on this deployment yet.";
        statusNode.textContent = fallbackMessage;
        statusNode.className = "empty-state";
        return;
      }

      const summary = result.summary || {};
      statEls.total.textContent = summary.total || 0;
      statEls.new.textContent = summary.new || 0;
      statEls.awaiting.textContent = summary.awaiting_response || 0;
      statEls.overdue.textContent = summary.overdue_follow_up || 0;

      renderStatusBreakdown(summary);
      renderRows(result.leads || []);
      statusNode.textContent = summary.generated_at ? `Dashboard refreshed ${formatDate(summary.generated_at)}` : "Live lead data is available.";
      statusNode.className = "empty-state";
    } catch (error) {
      statusNode.textContent = "The lead dashboard could not load right now. Please check the Google Sheets endpoint and Cloudflare settings.";
      statusNode.className = "empty-state";
      console.error(error);
    }
  }

  loadDashboard();
})();
