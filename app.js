const DATA_URL = "data/conferences.csv";
const COUNTRY_BOUNDARIES_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

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
  countries: [],
  importanceMin: 1,
  importanceMax: 10,
  showAcronyms: false,
  selectionCollapsed: false,
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
const clearFiltersElement = document.querySelector("#clear-filters");
const advancedFilterElements = Array.from(document.querySelectorAll("[data-advanced-filter]"));
const fieldLegendElement = document.querySelector("#field-legend");
const fieldLegendToggleElement = document.querySelector("#field-legend-toggle");
const themeToggleElement = document.querySelector("#theme-toggle");
const acronymToggleElement = document.querySelector("#acronym-toggle");

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
    "Nederland",
    "Portugal",
    "Sweden",
    "UK",
    "United Kingdom",
    "Ελλάς",
  ]),
  "North America": new Set(["Canada", "United States", "USA"]),
  "Asia-Pacific": new Set([
    "Australia",
    "China",
    "中国",
    "Hong Kong SAR",
    "Korea",
    "South Korea",
    "Singapore",
    "Vietnam",
    "Việt Nam",
  ]),
  "Latin America": new Set(["Brazil", "Costa Rica"]),
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

const globeThemes = {
  light: {
    landColors: ["#a6b9ad", "#9bb0a8", "#b2bca5", "#9eafa1", "#acb6a2"],
    water: "#5c96aa",
    emissive: "#28586c",
    specular: "#2d5969",
    atmosphere: "#4f8da5",
    side: "rgba(42, 83, 98, 0.38)",
    border: "rgba(38, 70, 83, 0.78)",
  },
  dark: {
    landColors: ["#536b66", "#4a625f", "#5d6e5e", "#4c655e", "#566b5d"],
    water: "#254b5c",
    emissive: "#142f3d",
    specular: "#1b3c4b",
    atmosphere: "#356c82",
    side: "rgba(8, 27, 37, 0.58)",
    border: "rgba(135, 181, 183, 0.68)",
  },
};

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function currentGlobeTheme() {
  return globeThemes[isDarkTheme() ? "dark" : "light"];
}

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

function importanceAltitude(row) {
  const importance = Number(row.importance) || state.importanceMin;
  const range = state.importanceMax - state.importanceMin;
  if (range <= 0) return 0.012;
  const normalizedImportance = Math.max(0, Math.min(1, (importance - state.importanceMin) / range));
  return 0.012 + normalizedImportance * 0.14;
}

function markerColor(row) {
  return conferenceFieldColor(row);
}

function conferenceFieldColor(row) {
  return fieldColors[row.subfield] || "rgba(82, 98, 122, 0.78)";
}

function countryLandColor(country) {
  const id = Number(country.id);
  const colors = currentGlobeTheme().landColors;
  return colors[Number.isFinite(id) ? id % colors.length : 0];
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

function spreadOverlappingMarkers(rows) {
  const coordinateGroups = new Map();

  rows.forEach((row) => {
    if (!hasCoordinates(row)) return;
    const key = `${Number(row.latitude).toFixed(3)},${Number(row.longitude).toFixed(3)}`;
    const group = coordinateGroups.get(key) || [];
    group.push(row);
    coordinateGroups.set(key, group);
  });

  coordinateGroups.forEach((group) => {
    group.forEach((row, index) => {
      row.markerLatitude = row.latitude;
      row.markerLongitude = row.longitude;

      if (group.length === 1) return;

      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      const offset = 0.55;
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      const latitudeOffset = Math.sin(angle) * offset;
      const longitudeOffset = (Math.cos(angle) * offset) / Math.max(0.25, Math.cos((latitude * Math.PI) / 180));

      row.markerLatitude = Math.max(-89.5, Math.min(89.5, latitude + latitudeOffset));
      row.markerLongitude = ((longitude + longitudeOffset + 540) % 360) - 180;
    });
  });

  return spreadLabelPositions(rows);
}

function markerDistance(first, second) {
  const latitude = Number(first.markerLatitude ?? first.latitude);
  const longitude = Number(first.markerLongitude ?? first.longitude);
  const otherLatitude = Number(second.markerLatitude ?? second.latitude);
  const otherLongitude = Number(second.markerLongitude ?? second.longitude);
  const latitudeDistance = latitude - otherLatitude;
  const longitudeDistance = (longitude - otherLongitude) * Math.cos((latitude * Math.PI) / 180);
  return Math.hypot(latitudeDistance, longitudeDistance);
}

function spreadLabelPositions(rows) {
  const coordinateRows = rows.filter(hasCoordinates);
  const placedLabels = [];
  const labelOffset = 1.05;
  const directions = [
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
  ];

  coordinateRows.forEach((row) => {
    const nearbyRows = coordinateRows.filter((candidate) => candidate !== row && markerDistance(row, candidate) < 4.2);
    const markerLatitude = Number(row.markerLatitude ?? row.latitude);
    const markerLongitude = Number(row.markerLongitude ?? row.longitude);

    if (!nearbyRows.length) {
      row.labelLatitude = markerLatitude;
      row.labelLongitude = ((markerLongitude + labelOffset + 540) % 360) - 180;
      placedLabels.push(row);
      return;
    }

    const candidates = directions.map(([latitudeDirection, longitudeDirection]) => {
      const latitude = Math.max(-89.5, Math.min(89.5, markerLatitude + latitudeDirection * labelOffset));
      const longitudeOffset = (longitudeDirection * labelOffset) / Math.max(0.25, Math.cos((markerLatitude * Math.PI) / 180));
      const longitude = ((markerLongitude + longitudeOffset + 540) % 360) - 180;
      return { latitude, longitude };
    });

    const bestCandidate = candidates.reduce((best, candidate) => {
      const nearbyDistance = nearbyRows.reduce((minimum, other) => {
        const distance = markerDistance(
          { markerLatitude: candidate.latitude, markerLongitude: candidate.longitude },
          other,
        );
        return Math.min(minimum, distance);
      }, Infinity);
      const placedDistance = placedLabels.reduce((minimum, other) => {
        const distance = markerDistance(
          { markerLatitude: candidate.latitude, markerLongitude: candidate.longitude },
          other,
        );
        return Math.min(minimum, distance);
      }, Infinity);
      const score = Math.min(nearbyDistance, placedDistance);
      return score > best.score ? { candidate, score } : best;
    }, { candidate: candidates[0], score: -Infinity }).candidate;

    row.labelLatitude = bestCandidate.latitude;
    row.labelLongitude = bestCandidate.longitude;
    placedLabels.push(row);
  });

  return rows;
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
  if (filters.deadlineStatus === "active" && !hasActiveSubmission(row)) return false;
  if (filters.deadlineStatus && filters.deadlineStatus !== "active" && row.deadline_status !== filters.deadlineStatus) return false;
  if (filters.month && (!row.eventStartDate || String(row.eventStartDate.getUTCMonth() + 1) !== filters.month)) return false;
  return true;
}

function hasActiveSubmission(row) {
  if (!row.deadlineDate) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return row.deadlineDate.getTime() >= today;
}

function matchesVisibleFields(row) {
  return !row.subfield || !state.hiddenFields.has(row.subfield);
}

function matchesTimelineType(row) {
  if (state.filter === "deadline") return Boolean(row.deadlineDate || row.deadline_status === "TBD");
  if (state.filter === "conference") return Boolean(row.eventStartDate || row.event_status === "TBD");
  return true;
}

function matchesSearchQuery(row) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;

  return [row.title, row.full_name, row.place, row.city, row.country, row.subfield, row.rank]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function visibleMarkerRows(rows) {
  return rows.filter(
    (row) =>
      hasCoordinates(row) &&
      matchesTimelineType(row) &&
      matchesAdvancedFilters(row) &&
      matchesVisibleFields(row) &&
      matchesSearchQuery(row),
  );
}

function labelRows(rows) {
  // globe.gl stores an internal Three.js object on each data item. Labels and
  // points are separate layers, so they must not share the same row objects.
  return rows.map((row) => ({ ...row }));
}

function normalizeRows(rows) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    year: Number(row.year),
    importance: Number(row.importance) || 1,
    latitude: row.latitude === "" ? null : Number(row.latitude),
    longitude: row.longitude === "" ? null : Number(row.longitude),
    deadlineDate: parseDate(row.deadline),
    eventStartDate: parseDate(row.event_start),
    eventEndDate: parseDate(row.event_end),
  }));

  return spreadOverlappingMarkers(normalizedRows);
}

function buildEvents(rows) {
  const events = [];

  rows.forEach((row) => {
    if (row.deadlineDate || row.deadline_status === "TBD") {
      const displayDeadlineDate = row.deadlineDate
        ? row.deadlineDate
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
  state.selectionCollapsed = false;
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
  const markerRows = visibleMarkerRows(state.conferences);
  // Rebind both layers from an empty collection first. globe.gl diffs point
  // objects by identity, and the same row objects are reused between filter
  // changes; explicitly clearing the layers prevents stale cylinders or
  // labels from remaining visible after a filter narrows the collection.
  state.globe.pointColor(markerColor).pointsData([]).labelsData([]);
  state.globe
    .pointsData(markerRows)
    .labelsData(state.showAcronyms ? labelRows(markerRows) : []);
}

function renderSelection(row) {
  const score = Math.round(Number(row.importance) || 1);
  const scoreDots = Array.from({ length: 10 }, (_, index) => `<i class="${index < score ? "is-filled" : ""}"></i>`).join("");
  const eventRange = formatEventRange(row.eventStartDate, row.eventEndDate, row.date_text || "Date TBD");
  const deadline = row.deadlineDate ? longDateFormatter.format(row.deadlineDate) : row.deadline_status === "TBD" ? "TBD" : "Not listed";
  const location = row.city && row.country ? `${row.city}, ${row.country}` : row.place || "Location TBD";
  const rank = row.rank && row.rank !== "N" ? `${row.rank}-ranked` : "Not ranked";

  selectionCardElement.innerHTML = `
    <div class="selection-art${row.image_url ? " has-image" : ""}" aria-hidden="true">${row.image_url ? `<img src="${row.image_url}" alt="" />` : ""}</div>
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
    <button class="selection-toggle" type="button" aria-expanded="true" aria-label="Collapse conference details" title="Collapse conference details">
      <svg class="selection-caret" aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  `;
  updateSelectionCardState();
}

function updateSelectionCardState() {
  selectionCardElement.classList.toggle("is-collapsed", state.selectionCollapsed);
  const toggle = selectionCardElement.querySelector(".selection-toggle");
  if (!toggle) return;

  const isExpanded = !state.selectionCollapsed;
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Expand"} conference details`);
  toggle.title = `${isExpanded ? "Collapse" : "Expand"} conference details`;
}

function applyGlobeTheme() {
  if (!state.globe) return;

  const theme = currentGlobeTheme();
  const material = state.globe.globeMaterial();
  material.color.set(theme.water);
  material.emissive.set(theme.emissive);
  material.emissiveIntensity = isDarkTheme() ? 0.08 : 0.1;
  material.specular.set(theme.specular);
  material.shininess = 4;

  state.globe
    .atmosphereColor(theme.atmosphere)
    .polygonCapColor(countryLandColor)
    .polygonSideColor(() => theme.side)
    .polygonStrokeColor(() => theme.border)
    .polygonsData(state.countries);
}

function renderGlobe(rows, countries) {
  const points = visibleMarkerRows(rows);
  const labels = state.showAcronyms ? labelRows(points) : [];
  const globe = Globe()(globeElement)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl(null)
    .showAtmosphere(true)
    .atmosphereColor(currentGlobeTheme().atmosphere)
    .atmosphereAltitude(0.09)
    .polygonsData(countries)
    .polygonAltitude(0.006)
    .polygonCapColor(countryLandColor)
    .polygonSideColor(() => currentGlobeTheme().side)
    .polygonStrokeColor(() => currentGlobeTheme().border)
    .polygonCapCurvatureResolution(0.45)
    .polygonsTransitionDuration(0)
    .labelsData(labels)
    .labelLat((row) => row.labelLatitude ?? row.markerLatitude ?? row.latitude)
    .labelLng((row) => row.labelLongitude ?? row.markerLongitude ?? row.longitude)
    .labelText((row) => row.title)
    .labelColor(() => "#071a2b")
    .labelAltitude((row) => importanceAltitude(row) + 0.028)
    .labelSize(0.48)
    .labelResolution(2)
    .labelIncludeDot(false)
    .labelsTransitionDuration(0)
    .pointLat((row) => row.markerLatitude ?? row.latitude)
    .pointLng((row) => row.markerLongitude ?? row.longitude)
    .pointAltitude(importanceAltitude)
    .pointRadius(0.44)
    .pointColor(markerColor)
    .pointsMerge(false)
    .pointsTransitionDuration(0)
    .pointsData(points)
    .pointLabel(
      (row) => `
        <div class="marker-tooltip">
          <strong>${row.title}</strong>
          <span>${row.year}</span>
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

  globe.pointOfView({ lat: 18, lng: 30, altitude: 3.1 }, 0);
  state.globe = globe;
  applyGlobeTheme();
  resizeGlobe();
  window.addEventListener("resize", resizeGlobe);
}

function resizeGlobe() {
  if (!state.globe) return;
  const { width, height } = globeElement.getBoundingClientRect();
  state.globe.width(width).height(height);
}

function filteredEvents() {
  const activeDeadlineView = state.advancedFilters.deadlineStatus === "active" && state.filter === "all";
  return state.events.filter((event) => {
    if (state.filter !== "all" && event.type !== state.filter) return false;
    if (activeDeadlineView && event.type !== "deadline") return false;

    const row = event.conference;
    if (!matchesVisibleFields(row)) return false;
    if (!matchesAdvancedFilters(row)) return false;
    return matchesSearchQuery(row);
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

function renderTimeline({ resetScroll = false } = {}) {
  const events = filteredEvents();
  if (resetScroll) timelineElement.scrollTop = 0;
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
  const deadlineStatusSelect = document.querySelector("#deadline-status-filter");
  populateSelect(deadlineStatusSelect, deadlineStatuses, "All statuses", (value) => value === "TBD" ? "TBD" : "Known");
  deadlineStatusSelect.querySelector("option").insertAdjacentHTML("afterend", `<option value="active">Active</option>`);
  populateSelect(document.querySelector("#month-filter"), months, "All months", (value) => monthNameFormatter.format(new Date(Date.UTC(2026, Number(value) - 1, 1))));
}

function setTheme(theme, persist = true) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  const isDark = nextTheme === "dark";
  document.documentElement.dataset.theme = nextTheme;
  themeToggleElement.setAttribute("aria-pressed", String(isDark));
  themeToggleElement.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggleElement.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  themeToggleElement.querySelector(".theme-toggle-label").textContent = isDark ? "Light" : "Dark";
  applyGlobeTheme();

  if (persist) {
    try {
      localStorage.setItem("ai-conference-globe-theme", nextTheme);
    } catch (error) {
      console.warn("Theme preference could not be saved.", error);
    }
  }
}

function setupTheme() {
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem("ai-conference-globe-theme") || "";
  } catch (error) {
    console.warn("Theme preference could not be read.", error);
  }

  const preferredTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(preferredTheme, false);
  themeToggleElement.addEventListener("click", () => setTheme(isDarkTheme() ? "light" : "dark"));
}

function setAcronymVisibility(isVisible) {
  state.showAcronyms = isVisible;
  acronymToggleElement.setAttribute("aria-pressed", String(isVisible));
  acronymToggleElement.setAttribute("aria-label", `${isVisible ? "Hide" : "Show"} conference names on the globe`);
  acronymToggleElement.title = `${isVisible ? "Hide" : "Show"} conference names on the globe`;
  acronymToggleElement.querySelector("span").textContent = `${isVisible ? "Hide" : "Show"} names`;
  acronymToggleElement.classList.toggle("is-active", isVisible);
  refreshGlobeMarkers();
}

function setupAcronymToggle() {
  acronymToggleElement.addEventListener("click", () => setAcronymVisibility(!state.showAcronyms));
}

function clearAllFilters() {
  state.filter = "all";
  state.query = "";
  state.advancedFilters = {
    area: "",
    rank: "",
    region: "",
    deadlineStatus: "",
    month: "",
  };
  state.hiddenFields.clear();

  searchInput.value = "";
  filterButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.filter === "all"));
  advancedFilterElements.forEach((select) => {
    select.value = "";
  });

  renderFieldLegend(state.conferences);
  refreshGlobeMarkers();
  renderTimeline({ resetScroll: true });
}

function setupFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      filterButtons.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === button);
      });
      refreshGlobeMarkers();
      renderTimeline({ resetScroll: true });
    });
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    refreshGlobeMarkers();
    renderTimeline({ resetScroll: true });
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
      renderTimeline({ resetScroll: true });
    });
  });

  clearFiltersElement.addEventListener("click", clearAllFilters);

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
    renderTimeline({ resetScroll: true });
  });

  selectionCardElement.addEventListener("click", (event) => {
    if (!event.target.closest(".selection-toggle")) return;
    state.selectionCollapsed = !state.selectionCollapsed;
    updateSelectionCardState();
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

async function loadCountryBoundaries() {
  const response = await fetch(COUNTRY_BOUNDARIES_URL);
  if (!response.ok) {
    throw new Error(`Could not load country boundaries: ${response.status}`);
  }

  const topology = await response.json();
  return window.topojson.feature(topology, topology.objects.countries).features;
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
  setupTheme();
  setupAcronymToggle();
  setupFilters();

  try {
    const rows = await loadData();
    let countries = [];
    try {
      countries = await loadCountryBoundaries();
    } catch (boundaryError) {
      console.warn(boundaryError);
    }

    state.conferences = rows;
    state.countries = countries;
    const importanceValues = rows.map((row) => Number(row.importance)).filter(Number.isFinite);
    state.importanceMin = Math.min(...importanceValues);
    state.importanceMax = Math.max(...importanceValues);
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
      renderGlobe(rows, countries);
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
