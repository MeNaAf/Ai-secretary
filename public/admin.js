// All dynamic values are inserted with textContent, never innerHTML.
const $ = (id) => document.getElementById(id);
const fmt = (v) => (v ? new Date(v).toLocaleString() : "—");

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (cls) node.className = cls;
  return node;
}
function badge(text, cls) { return el("span", text, "badge " + (cls || "")); }

function fill(table, headers, rows, emptyText) {
  table.replaceChildren();
  const head = el("tr");
  headers.forEach((h) => head.append(el("th", h)));
  table.append(head);
  if (!rows.length) {
    const tr = el("tr"); const td = el("td", emptyText); td.colSpan = headers.length; tr.append(td); table.append(tr);
    return;
  }
  rows.forEach((cells) => {
    const tr = el("tr");
    cells.forEach((c) => { const td = el("td"); if (c instanceof Node) td.append(c); else td.textContent = c ?? "—"; tr.append(td); });
    table.append(tr);
  });
}

function card(label, value) {
  const c = el("div", null, "card"); c.append(el("span", label, "muted"), el("b", value)); return c;
}

async function retry(id) {
  const res = await fetch("/api/admin/calendar/retry", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  if (!res.ok) $("msg").textContent = "Retry failed: " + ((await res.json().catch(() => ({}))).error || res.status);
  load();
}

async function load() {
  const res = await fetch("/api/admin/calendar", { credentials: "same-origin" });
  if (res.status === 401) { $("msg").textContent = "Please sign in at / first, then reload this page."; return; }
  if (res.status === 403) { $("msg").textContent = "Your account is not listed in AI_SECRETARY_ADMIN_EMAILS."; return; }
  if (!res.ok) { $("msg").textContent = "Could not load dashboard (" + res.status + ")."; return; }
  const d = await res.json();

  const warnings = [];
  if (!d.config.webhookSecretConfigured) warnings.push("APEX_WEBHOOK_SECRET is not set — inbound updates are rejected.");
  if (!d.config.alertWebhookConfigured) warnings.push("APEX_ALERT_WEBHOOK_URL is not set (or not https in production) — alerts are queued but not sent.");
  $("msg").textContent = warnings.length ? warnings.join(" ") : "Configuration looks complete.";

  const lastOk = d.providers.map((p) => p.lastSuccessAt).filter(Boolean).sort().pop();
  const counts = d.notificationCounts || {};
  $("cards").replaceChildren(
    card("Last successful update", fmt(lastOk)),
    card("Alerts sent", counts.sent || 0),
    card("Alerts pending", counts.pending || 0),
    card("Alerts failed / dead", (counts.failed || 0) + (counts.dead || 0)),
  );

  fill($("providers"), ["Source", "Data", "Status", "Events received", "Last success", "Last error"],
    d.providers.map((p) => [p.source, badge(p.isDemo ? "DEMO" : "LIVE", p.isDemo ? "demo" : "ok"),
      badge(p.lastError && (!p.lastSuccessAt || p.lastErrorAt > p.lastSuccessAt) ? "Erroring" : "Connected", p.lastError && (!p.lastSuccessAt || p.lastErrorAt > p.lastSuccessAt) ? "bad" : "ok"),
      p.eventsReceived, fmt(p.lastSuccessAt), p.lastError ? p.lastError + " (" + fmt(p.lastErrorAt) + ")" : "—"]),
    "No provider has sent data yet.");

  fill($("failed"), ["Event", "Type", "Status", "Attempts", "Next attempt", "Error", ""],
    d.failedNotifications.map((n) => {
      const b = el("button", "Retry"); b.addEventListener("click", () => retry(n.id));
      return [n.payload.event.name, n.changeType, badge(n.status, "bad"), n.attempts, fmt(n.nextAttemptAt), n.lastError, b];
    }), "No failed notifications.");

  fill($("changes"), ["Detected", "Type", "Event", "Data", "Changes", "Alert status"],
    d.recentChanges.map((n) => [fmt(n.payload.detected_at), n.changeType === "new_event" ? "New" : "Updated", n.payload.event.name,
      badge(n.payload.data_status.toUpperCase(), n.payload.data_status === "demo" ? "demo" : "ok"),
      Object.entries(n.payload.changes).map(([k, v]) => k + ": " + (v.from ?? "—") + " → " + (v.to ?? "—")).join("; ") || "—", n.status]),
    "No changes detected yet.");

  fill($("events"), ["Time", "Event", "Country", "Impact", "Forecast", "Previous", "Actual", "Source", "Data"],
    d.events.map((e) => [fmt(e.eventTime), e.name, e.country, e.impact, e.forecast, e.previous, e.actual, e.source,
      badge(e.isDemo ? "DEMO" : "LIVE", e.isDemo ? "demo" : "ok")]),
    "No events stored yet.");
}
load();
setInterval(load, 30000);
