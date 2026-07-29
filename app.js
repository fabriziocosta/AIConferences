const DATA_URL = "data/conferences.csv";

const state = {
  conferences: [],
  events: [],
  filter: "all",
  query: "",
  advancedFilters: {
    area: "",
    rank: "",
    region: "",
    deadlineStatus: "",
    month: "",
  },
  hiddenFields: new Set(),
  activeId: null,
  globe: null,
};

const globeElement = document.querySelector("#globe");
const timelineElement = document.querySelector("#timeline");
const statusElement = document.querySelector("#status");
const selectionCardElement = document.querySelector("#selection-card");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const searchInput = document.querySelector("#search-input");
const headerStatsElement = document.querySelector("#header-stats");
const filterToggleElement = document.querySelector("#filter-toggle");
const filterMenuElement = document.querySelector("#filter-menu");
const advancedFilterElements = Array.from(document.querySelectorAll("[data-advanced-filter]"));
const fieldLegendElement = document.querySelector("#field-legend");
const fieldLegendToggleElement = document.querySelector("#field-legend-toggle");

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const summaryDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});

const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const longMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
});

const monthNameFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
});

const regionCountries = {
  Europe: new Set([
    "Austria",
    "Cyprus",
    "Denmark",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Netherlands",
    "Portugal",
    "Sweden",
    "UK",
    "United Kingdom",
  ]),
  "North America": new Set(["Canada", "United States", "USA"]),
  "Asia-Pacific": new Set(["Australia", "China", "Hong Kong SAR", "Korea", "Singapore", "Vietnam"]),
  "Latin America": new Set(["Brazil"]),
  Africa: new Set(["Morocco"]),
};

const fieldColors = {
  AI: "rgba(18, 63, 140, 0.92)",
  CV: "rgba(8, 168, 138, 0.92)",
  NLP: "rgba(244, 165, 28, 0.92)",
  DB: "rgba(239, 107, 69, 0.92)",
  DM: "rgba(129, 96, 230, 0.92)",
  IR: "rgba(48, 136, 168, 0.92)",
  RO: "rgba(213, 84, 122, 0.92)",
};

const fieldLabels = {
  AI: "AI / ML",
  CV: "Vision",
  NLP: "Language",
  DB: "Databases",
  DM: "Data mining",
  IR: "Retrieval",
  RO: "Robotics",
};

function parseDate(value) {
  if (!value || value.toUpperCase() === "TBD") return null;
  const dateOnly = value.includes(" ") ? value.split(" ")[0] : value;
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date, fallback = "TBD") {
  return date ? dateFormatter.format(date) : fallback;
}

function formatSummaryDate(date, fallback = "TBD") {
  return date ? summaryDateFormatter.format(date) : fallback;
}

function formatEventRange(start, end, fallback = "Date TBD") {
  if (!start) return fallback;
  if (!end || end.getTime() === start.getTime()) return longDateFormatter.format(start);

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const endMonth = end.getUTCMonth();

  if (startYear === endYear && startMonth === endMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${longMonthFormatter.format(start)} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${start.getUTCDate()} ${longMonthFormatter.format(start)}–${end.getUTCDate()} ${longMonthFormatter.format(end)} ${startYear}`;
  }
  return `${longDateFormatter.format(start)}–${longDateFormatter.format(end)}`;
}

function importanceRadius(row) {
  const importance = Number(row.importance) || 1;
  return 0.18 + importance * 0.055;
}

function markerColor(row) {
  if (row.id === state.activeId) {
    return "rgba(239, 107, 69, 1)";
  }
  if (state.filter === "deadline") return "rgba(239, 107, 69, 0.92)";
  if (state.filter === "conference") return "rgba(8, 168, 138, 0.92)";

  return fieldColors[row.subfield] || "rgba(82, 98, 122, 0.78)";
}

function conferenceFieldColor(row) {
  return fieldColors[row.subfield] || "rgba(82, 98, 122, 0.78)";
}

function rankLabel(rank) {
  return rank && rank !== "N" ? `${rank}-ranked` : "Not ranked";
}

function markerColorDate(row) {
  if (state.filter === "deadline") {
    return row.deadlineDate || row.eventStartDate;
  }
  return row.eventStartDate || row.deadlineDate;
}

function hasCoordinates(row) {
  return Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude));
}

function regionFor(row) {
  const country = (row.country || "").trim();
  return Object.entries(regionCountries).find(([, countries]) => countries.has(country))?.[0] || "Other";
}

function matchesAdvancedFilters(row) {
  const filters = state.advancedFilters;
  if (filters.area && row.subfield !== filters.area) return false;
  if (filters.rank && row.rank !== filters.rank) return false;
  if (filters.region && regionFor(row) !== filters.region) return false;
  if (filters.deadlineStatus && row.deadline_status !== filters.deadlineStatus) return false;
  if (filters.month && (!row.eventStartDate || String(row.eventStartDate.getUTCMonth() + 1) !== filters.month)) return false;
  return true;
}

function matchesVisibleFields(row) {
  return !row.subfield || !state.hiddenFields.has(row.subfield);
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    ...row,
    year: Number(row.year),
    importance: Number(row.importance) || 1,
    latitude: row.latitude === "" ? null : Number(row.latitude),
    longitude: row.longitude === "" ? null : Number(row.longitude),
    deadlineDate: parseDate(row.deadline),
    eventStartDate: parseDate(row.event_start),
    eventEndDate: parseDate(row.event_end),
  }));
}

function buildEvents(rows) {
  const events = [];

  rows.forEach((row) => {
    if (row.deadlineDate || row.deadline_status === "TBD") {
      const displayDeadlineDate = row.deadlineDate
        ? new Date(Date.UTC(row.year, row.deadlineDate.getUTCMonth(), row.deadlineDate.getUTCDate()))
        : new Date(`${row.year}-12-31T00:00:00Z`);
      events.push({
        id: `${row.id}-deadline`,
        type: "deadline",
        sortDate: displayDeadlineDate,
        displayDate: row.deadlineDate
          ? formatDate(displayDeadlineDate)
          : "TBD",
        actualDate: row.deadlineDate ? formatDate(row.deadlineDate) : "",
        label: "Submission",
        conference: row,
      });
    }

    if (row.eventStartDate || row.event_status === "TBD") {
      events.push({
        id: `${row.id}-conference`,
        type: "conference",
        sortDate: row.eventStartDate || new Date(`${row.year}-12-31T00:00:00Z`),
        displayDate: row.eventStartDate
          ? `${formatDate(row.eventStartDate)}${row.eventEndDate && row.eventEndDate.getTime() !== row.eventStartDate.getTime() ? ` - ${formatDate(row.eventEndDate)}` : ""}`
          : "TBD",
        label: "Conference",
        conference: row,
      });
    }
  });

  return events.sort((a, b) => a.sortDate - b.sortDate || b.conference.importance - a.conference.importance);
}

function setStatus(message, isHidden = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-hidden", isHidden);
}

function renderHeaderStats(rows) {
  const countries = new Set(rows.map((row) => row.country).filter(Boolean));
  const ranked = rows.filter((row) => row.rank === "A").length;
  const now = new Date();
  const nextDeadline = rows
    .filter((row) => row.deadlineDate && row.deadlineDate >= now)
    .sort((a, b) => a.deadlineDate - b.deadlineDate)[0];

  headerStatsElement.innerHTML = `
    <span>${rows.length} conferences</span>
    <span aria-hidden="true">·</span>
    <span>${countries.size} countries</span>
    <span aria-hidden="true">·</span>
    <span>${ranked} A-ranked</span>
    <span aria-hidden="true">·</span>
    <span>Next deadline: ${nextDeadline ? `${nextDeadline.title}, ${formatSummaryDate(nextDeadline.deadlineDate)}` : "TBD"}</span>
  `;
}

function renderFieldLegend(rows) {
  const fields = [...new Set(rows.map((row) => row.subfield).filter(Boolean))];
  const orderedFields = Object.keys(fieldColors).filter((field) => fields.includes(field));

  fieldLegendElement.innerHTML = orderedFields
    .map(
      (field) => {
        const isVisible = !state.hiddenFields.has(field);
        return `
        <button class="field-legend-item${isVisible ? "" : " is-off"}" type="button" data-field-toggle="${field}" aria-pressed="${isVisible}" aria-label="${isVisible ? "Hide" : "Show"} ${fieldLabels[field] || field} conferences">
          <span class="field-legend-swatch" style="background: ${conferenceFieldColor({ subfield: field })}" aria-hidden="true"></span>
          <strong>${field}</strong>
          <span>${fieldLabels[field] || field}</span>
        </button>
      `;
      },
    )
    .join("");
}

function focusConference(row) {
  if (!row) return;
  state.activeId = row.id;
  renderSelection(row);
  refreshGlobeMarkers();
  if (hasCoordinates(row) && state.globe) {
    state.globe.pointOfView(
      {
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        altitude: Number(row.importance) >= 9 ? 1.35 : 1.55,
      },
      1100,
    );
  }
  renderTimeline();
}

function refreshGlobeMarkers() {
  if (!state.globe) return;
  state.globe
    .pointColor(markerColor)
    .pointsData(state.conferences.filter((row) => hasCoordinates(row) && matchesAdvancedFilters(row) && matchesVisibleFields(row)));
}

function renderSelection(row) {
  const score = Math.round(Number(row.importance) || 1);
  const scoreDots = Array.from({ length: 10 }, (_, index) => `<i class="${index < score ? "is-filled" : ""}"></i>`).join("");
  const imageStyle = row.image_url
    ? ` style="background-image: linear-gradient(rgba(55, 150, 230, 0.1), rgba(55, 150, 230, 0.3)), url('${row.image_url}')"`
    : "";
  const eventRange = formatEventRange(row.eventStartDate, row.eventEndDate, row.date_text || "Date TBD");
  const deadline = row.deadlineDate ? longDateFormatter.format(row.deadlineDate) : row.deadline_status === "TBD" ? "TBD" : "Not listed";
  const location = row.city && row.country ? `${row.city}, ${row.country}` : row.place || "Location TBD";
  const rank = row.rank && row.rank !== "N" ? `${row.rank}-ranked` : "Not ranked";

  selectionCardElement.innerHTML = `
    <div class="selection-art" aria-hidden="true"${imageStyle}></div>
    <div class="selection-content">
      <div class="selection-title-row">
        <h3>${row.title} ${row.year}</h3>
      </div>
      <p class="selection-full-name">${row.full_name || "Conference details"}</p>
      <div class="selection-meta">
        <div class="selection-event-group">
          <strong class="selection-event">${eventRange}</strong>
          <span class="selection-location">${location}</span>
        </div>
        <div class="selection-deadline">
          <span>Submission deadline</span>
          <strong>${deadline}</strong>
        </div>
      </div>
      <div class="selection-footer">
        <div class="selection-secondary-row">
          <span>${rank}</span>
          <span class="pill">${row.subfield || "AI/ML"}</span>
          <span class="score-summary">
            <span>Importance</span>
            <span class="score-dots" aria-hidden="true">${scoreDots}</span>
            <strong>${row.importance}/10</strong>
          </span>
          ${row.link ? `<a class="conference-link icon-link" href="${row.link}" target="_blank" rel="noreferrer" aria-label="Visit website" title="Visit website"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg></a>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderGlobe(rows) {
  const points = rows.filter(hasCoordinates);
  const globe = Globe()(globeElement)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("//unpkg.com/three-globe/example/img/earth-day.jpg")
    .showAtmosphere(true)
    .atmosphereColor("#78b7e5")
    .atmosphereAltitude(0.17)
    .pointLat((row) => row.latitude)
    .pointLng((row) => row.longitude)
    .pointAltitude((row) => 0.018 + row.importance * 0.006)
    .pointRadius(importanceRadius)
    .pointColor(markerColor)
    .pointsMerge(false)
    .pointsData(points)
    .pointLabel(
      (row) => `
        <div class="marker-tooltip">
          <strong>${row.title} ${row.year}</strong><br>
          ${row.place}<br>
          Importance ${row.importance}/10
        </div>
      `,
    )
    .onPointClick(focusConference);

  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.42;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 180;
  controls.maxDistance = 520;

  const material = globe.globeMaterial();
  material.transparent = false;
  material.opacity = 1;
  material.color.set("#c6d7e6");
  material.emissive.set("#123b68");
  material.emissiveIntensity = 0.18;
  material.specular.set("#183f68");
  material.shininess = 8;

  globe.pointOfView({ lat: 18, lng: 30, altitude: 3.1 }, 0);
  state.globe = globe;
  resizeGlobe();
  window.addEventListener("resize", resizeGlobe);
}

function resizeGlobe() {
  if (!state.globe) return;
  const { width, height } = globeElement.getBoundingClientRect();
  state.globe.width(width).height(height);
}

function filteredEvents() {
  const query = state.query.trim().toLowerCase();
  return state.events.filter((event) => {
    if (state.filter !== "all" && event.type !== state.filter) return false;

    const row = event.conference;
    if (!matchesVisibleFields(row)) return false;
    if (!matchesAdvancedFilters(row)) return false;
    if (!query) return true;

    return [row.title, row.full_name, row.place, row.city, row.country, row.subfield, row.rank]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
}

function eventHasExactDate(event) {
  return event.type === "deadline" ? Boolean(event.conference.deadlineDate) : Boolean(event.conference.eventStartDate);
}

function monthAxisPosition(date) {
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return ((date.getUTCDate() - 1) / Math.max(1, daysInMonth - 1)) * 100;
}

function renderMonthAxis(monthEvents) {
  const markers = monthEvents
    .filter(eventHasExactDate)
    .map((event) => {
      const row = event.conference;
      const date = event.type === "deadline" ? row.deadlineDate : row.eventStartDate;
      return `<span class="axis-dot axis-dot-${event.type}" style="left: ${monthAxisPosition(date)}%" title="${event.label}: ${row.title} · ${event.displayDate}" role="img" aria-label="${event.label}: ${row.title} · ${event.displayDate}"></span>`;
    })
    .join("");

  return `
    <div class="month-axis" aria-hidden="true">
      <div class="month-axis-track">
        <span class="month-axis-line"></span>
        ${markers}
      </div>
    </div>
  `;
}

function renderTimeline() {
  const events = filteredEvents();
  timelineElement.innerHTML = "";

  if (!events.length) {
    timelineElement.innerHTML = `<div class="empty-state">No timeline entries match the current view.</div>`;
    return;
  }

  let currentMonth = "";
  let group = null;

  events.forEach((event) => {
    const monthKey = monthFormatter.format(event.sortDate);
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      group = document.createElement("section");
      group.className = "month-group";
      group.dataset.monthKey = monthKey;
      const monthEvents = events.filter((event) => monthFormatter.format(event.sortDate) === monthKey);
      group.innerHTML = `
        <div class="month-label-row">
          <h3 class="month-label">${monthKey}</h3>
          ${renderMonthAxis(monthEvents)}
        </div>
      `;
      timelineElement.appendChild(group);
    }

    const row = event.conference;
    const item = document.createElement("button");
    item.type = "button";
    item.className = `timeline-item event-${event.type}${state.activeId === row.id ? " is-active" : ""}`;
    item.dataset.conferenceId = row.id;
    item.innerHTML = `
      <span class="event-mark" aria-hidden="true"></span>
      <span class="event-body">
        <span class="event-kicker">
          <span class="event-kind">
            <span class="event-type-swatch" style="background: ${conferenceFieldColor(row)}" aria-hidden="true"></span>
            <span>${event.label}</span>
          </span>
          <span class="event-date">${event.displayDate}</span>
        </span>
        <span class="event-title">
          <span class="event-heading">
            <strong>${row.title}</strong>
            <span class="event-year">${row.year}</span>
          </span>
          <span class="event-secondary">
            <span class="event-rank" title="${rankLabel(row.rank)}">${row.rank || "N"}</span>
            <span class="event-field" title="${fieldLabels[row.subfield] || row.subfield || "AI/ML"}">${row.subfield || "AI/ML"}</span>
          </span>
        </span>
        <span class="event-place event-full-name">${row.full_name || "Conference details"}</span>
        ${event.actualDate && event.actualDate !== event.displayDate ? `<span class="event-place">Actual deadline: ${event.actualDate}</span>` : ""}
      </span>
    `;
    item.addEventListener("click", () => focusConference(row));
    group.appendChild(item);
  });
}

function scrollTimelineToCurrentMonth() {
  const currentMonthKey = monthFormatter.format(new Date());
  const currentMonthGroup = Array.from(timelineElement.querySelectorAll(".month-group")).find(
    (group) => group.dataset.monthKey === currentMonthKey,
  );

  if (!currentMonthGroup) return;

  timelineElement.scrollTop = Math.max(0, currentMonthGroup.offsetTop - timelineElement.offsetTop - 8);
}

function populateSelect(select, values, allLabel, formatValue = (value) => value) {
  select.innerHTML = `<option value="">${allLabel}</option>`;
  values.forEach((value) => {
    select.insertAdjacentHTML("beforeend", `<option value="${value}">${formatValue(value)}</option>`);
  });
}

function populateAdvancedFilters(rows) {
  const areas = [...new Set(rows.map((row) => row.subfield).filter(Boolean))].sort();
  const rankings = [...new Set(rows.map((row) => row.rank).filter(Boolean))].sort();
  const deadlineStatuses = [...new Set(rows.map((row) => row.deadline_status).filter(Boolean))].sort();
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1));

  populateSelect(document.querySelector("#area-filter"), areas, "All areas");
  populateSelect(document.querySelector("#rank-filter"), rankings, "All rankings");
  populateSelect(document.querySelector("#deadline-status-filter"), deadlineStatuses, "All statuses", (value) => value === "TBD" ? "TBD" : "Known");
  populateSelect(document.querySelector("#month-filter"), months, "All months", (value) => monthNameFormatter.format(new Date(Date.UTC(2026, Number(value) - 1, 1))));
}

function setupFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      filterButtons.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === button);
      });
      refreshGlobeMarkers();
      renderTimeline();
    });
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    renderTimeline();
  });

  filterToggleElement.addEventListener("click", () => {
    const isOpen = filterMenuElement.hidden;
    filterMenuElement.hidden = !isOpen;
    filterToggleElement.setAttribute("aria-expanded", String(isOpen));
    filterToggleElement.classList.toggle("is-active", isOpen);
  });

  advancedFilterElements.forEach((select) => {
    select.addEventListener("change", () => {
      state.advancedFilters[select.dataset.advancedFilter] = select.value;
      refreshGlobeMarkers();
      renderTimeline();
    });
  });

  fieldLegendToggleElement.addEventListener("click", () => {
    const isOpen = fieldLegendElement.hidden;
    fieldLegendElement.hidden = !isOpen;
    fieldLegendToggleElement.setAttribute("aria-expanded", String(isOpen));
    fieldLegendToggleElement.querySelector("span").textContent = isOpen ? "Hide legend" : "Show legend";
    fieldLegendToggleElement.classList.toggle("is-active", isOpen);
  });

  fieldLegendElement.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-field-toggle]");
    if (!toggle) return;

    const field = toggle.dataset.fieldToggle;
    if (state.hiddenFields.has(field)) {
      state.hiddenFields.delete(field);
    } else {
      state.hiddenFields.add(field);
    }

    renderFieldLegend(state.conferences);
    fieldLegendElement.querySelector(`[data-field-toggle="${field}"]`)?.focus();
    refreshGlobeMarkers();
    renderTimeline();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || filterMenuElement.hidden) return;
    filterMenuElement.hidden = true;
    filterToggleElement.setAttribute("aria-expanded", "false");
    filterToggleElement.classList.remove("is-active");
    filterToggleElement.focus();
  });
}

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  }
  const csvText = await response.text();
  return normalizeRows(parseCsv(csvText));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

async function init() {
  setupFilters();

  try {
    const rows = await loadData();
    state.conferences = rows;
    state.events = buildEvents(rows);
    populateAdvancedFilters(rows);
    renderHeaderStats(rows);
    renderFieldLegend(rows);
    const initialSelection = rows.find((row) => row.title === "NeurIPS") || rows[0];
    if (initialSelection) {
      state.activeId = initialSelection.id;
      renderSelection(initialSelection);
    }
    renderTimeline();
    scrollTimelineToCurrentMonth();
    try {
      renderGlobe(rows);
      setStatus(`${rows.length} conference editions loaded.`, true);
    } catch (globeError) {
      console.error(globeError);
      setStatus("Timeline loaded. Globe rendering requires WebGL support in this browser.");
    }
  } catch (error) {
    console.error(error);
    timelineElement.innerHTML = `<div class="empty-state">Conference data could not be loaded. Run a local static server from this folder so the browser can fetch <code>${DATA_URL}</code>.</div>`;
    setStatus("Data load failed. Use: python3 -m http.server 8000");
  }
}

init();
