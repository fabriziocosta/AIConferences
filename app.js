const DATA_URL = "data/conferences.csv";

const state = {
  conferences: [],
  events: [],
  filter: "all",
  query: "",
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

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseDate(value) {
  if (!value || value.toUpperCase() === "TBD") return null;
  const dateOnly = value.includes(" ") ? value.split(" ")[0] : value;
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date, fallback = "TBD") {
  return date ? dateFormatter.format(date) : fallback;
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

  const fieldColors = {
    AI: "rgba(18, 63, 140, 0.92)",
    CV: "rgba(8, 168, 138, 0.92)",
    NLP: "rgba(244, 165, 28, 0.92)",
    DB: "rgba(239, 107, 69, 0.92)",
    DM: "rgba(129, 96, 230, 0.92)",
    IR: "rgba(48, 136, 168, 0.92)",
    RO: "rgba(213, 84, 122, 0.92)",
  };
  return fieldColors[row.subfield] || "rgba(82, 98, 122, 0.78)";
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
    <div>
      <dt>Conferences</dt>
      <dd>${rows.length}</dd>
    </div>
    <div>
      <dt>Countries</dt>
      <dd>${countries.size}</dd>
    </div>
    <div>
      <dt>A-ranked</dt>
      <dd>${ranked}</dd>
    </div>
    <div>
      <dt>Next deadline</dt>
      <dd>${nextDeadline ? `${nextDeadline.title} · ${formatDate(nextDeadline.deadlineDate)}` : "TBD"}</dd>
    </div>
  `;
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
    .pointsData(state.conferences.filter(hasCoordinates));
}

function renderSelection(row) {
  const score = Math.round(Number(row.importance) || 1);
  const scoreDots = Array.from({ length: 10 }, (_, index) => `<i class="${index < score ? "is-filled" : ""}"></i>`).join("");
  const imageStyle = row.image_url
    ? ` style="background-image: linear-gradient(rgba(55, 150, 230, 0.1), rgba(55, 150, 230, 0.3)), url('${row.image_url}')"`
    : "";
  const eventRange = row.eventStartDate
    ? `${formatDate(row.eventStartDate)}${row.eventEndDate && row.eventEndDate.getTime() !== row.eventStartDate.getTime() ? ` - ${formatDate(row.eventEndDate)}` : ""}`
    : row.date_text || "Date TBD";
  const deadline = row.deadlineDate ? formatDate(row.deadlineDate) : row.deadline_status === "TBD" ? "TBD" : "Not listed";
  const rank = row.rank && row.rank !== "N" ? `${row.rank}-ranked` : "Not ranked";

  selectionCardElement.innerHTML = `
    <div class="selection-art" aria-hidden="true"${imageStyle}></div>
    <div class="selection-content">
      <div class="selection-title-row">
        <h3>${row.title} ${row.year}</h3>
        <span class="pill">${row.subfield || "AI/ML"}</span>
      </div>
      <p class="selection-full-name">${row.full_name || "Conference details"}</p>
      <div class="selection-meta">
        <span>${eventRange}</span>
        <span>${row.place || "Location TBD"}</span>
        <span>${rank} · ${row.country || "Country TBD"}</span>
        <span>Deadline: ${deadline}</span>
        ${row.link ? `<span class="url-row"><a class="conference-link" href="${row.link}" target="_blank" rel="noreferrer">Open conference site</a></span>` : ""}
      </div>
      <div class="score-row">
        <span>Importance Score</span>
        <span class="score-dots" aria-hidden="true">${scoreDots}</span>
        <strong>${row.importance}/10</strong>
      </div>
    </div>
  `;
}

function renderGlobe(rows) {
  const points = rows.filter(hasCoordinates);
  const globe = Globe()(globeElement)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
    .showAtmosphere(true)
    .atmosphereColor("#ffffff")
    .atmosphereAltitude(0.24)
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

  globe.pointOfView({ lat: 18, lng: 30, altitude: 2.28 }, 0);
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
    if (!query) return true;

    const row = event.conference;
    return [row.title, row.full_name, row.place, row.city, row.country, row.subfield, row.rank]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
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
      group.innerHTML = `<h3 class="month-label">${monthKey}</h3>`;
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
          <span>${event.label}</span>
          <span class="event-date">${event.displayDate}</span>
        </span>
        <span class="event-title">
          <strong>${row.title}</strong>
          <span>${row.year}</span>
        </span>
        <span class="event-place">${row.place || "Location TBD"} · ${row.subfield || "AI/ML"} · ${row.rank || "N"}</span>
        ${event.actualDate && event.actualDate !== event.displayDate ? `<span class="event-place">Actual deadline: ${event.actualDate}</span>` : ""}
        <span class="event-importance" aria-hidden="true">
          <span style="width: ${Math.max(10, row.importance * 10)}%"></span>
        </span>
      </span>
    `;
    item.addEventListener("click", () => focusConference(row));
    group.appendChild(item);
  });
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
    renderHeaderStats(rows);
    const initialSelection = rows.find((row) => row.title === "NeurIPS") || rows[0];
    if (initialSelection) {
      state.activeId = initialSelection.id;
      renderSelection(initialSelection);
    }
    renderTimeline();
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
