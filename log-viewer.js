const DEFAULT_LOG_PATH = "./log/LOG000.CSV";
const NUMERIC_COLUMNS = new Set([
  "seq",
  "time_ms",
  "roll",
  "pitch",
  "lvol",
  "rvol",
  "bus_v",
  "current_ma",
]);

const elements = {
  fileInput: document.querySelector("#csvFileInput"),
  loadDefaultButton: document.querySelector("#loadDefaultButton"),
  sourceLabel: document.querySelector("#sourceLabel"),
  status: document.querySelector("#logStatus"),
  rowCount: document.querySelector("#rowCount"),
  duration: document.querySelector("#durationValue"),
  modeSummary: document.querySelector("#modeSummary"),
  faultSummary: document.querySelector("#faultSummary"),
  busSummary: document.querySelector("#busSummary"),
  currentSummary: document.querySelector("#currentSummary"),
  rollSummary: document.querySelector("#rollSummary"),
  pitchSummary: document.querySelector("#pitchSummary"),
  audioSummary: document.querySelector("#audioSummary"),
  searchInput: document.querySelector("#searchInput"),
  modeFilter: document.querySelector("#modeFilter"),
  faultFilter: document.querySelector("#faultFilter"),
  tableHead: document.querySelector("#logTableHead"),
  tableBody: document.querySelector("#logTableBody"),
  tableMeta: document.querySelector("#tableMeta"),
  attitudeCanvas: document.querySelector("#attitudeCanvas"),
  powerCanvas: document.querySelector("#powerCanvas"),
  attitudeLabel: document.querySelector("#attitudeLabel"),
  powerLabel: document.querySelector("#powerLabel"),
};

let logData = { headers: [], rows: [], source: "" };
let filters = { search: "", mode: "all", fault: "all" };

elements.fileInput.addEventListener("change", handleFileSelected);
elements.loadDefaultButton.addEventListener("click", () => loadDefaultLog());
elements.searchInput.addEventListener("input", () => {
  filters.search = elements.searchInput.value.trim().toLowerCase();
  render();
});
elements.modeFilter.addEventListener("change", () => {
  filters.mode = elements.modeFilter.value;
  render();
});
elements.faultFilter.addEventListener("change", () => {
  filters.fault = elements.faultFilter.value;
  render();
});
window.addEventListener("resize", () => drawCharts(getFilteredRows()));

loadDefaultLog();

async function loadDefaultLog() {
  setStatus("Loading existing log...");
  try {
    const response = await fetch(DEFAULT_LOG_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    loadCsvText(await response.text(), "log/LOG000.CSV");
  } catch (error) {
    setStatus(`Unable to load log/LOG000.CSV. Upload a CSV file instead. ${error.message}`);
  }
}

async function handleFileSelected(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    loadCsvText(await file.text(), file.name);
  } catch (error) {
    setStatus(`Unable to read CSV file. ${error.message}`);
  }
}

function loadCsvText(text, source) {
  const parsed = parseCsv(text);
  if (!parsed.rows.length) {
    setStatus("CSV loaded, but no data rows were found.");
    return;
  }

  logData = { ...parsed, source };
  filters = { search: "", mode: "all", fault: "all" };
  elements.searchInput.value = "";
  elements.sourceLabel.textContent = source;
  setStatus(`Loaded ${parsed.rows.length.toLocaleString()} rows from ${source}.`);
  syncFilterOptions();
  render();
}

function parseCsv(text) {
  const records = parseCsvRecords(text).filter((record) => record.some((cell) => cell.trim() !== ""));
  const headers = records.shift()?.map((header) => header.trim()) ?? [];
  const rows = records.map((record, index) => {
    const row = {};
    headers.forEach((header, columnIndex) => {
      const raw = record[columnIndex]?.trim() ?? "";
      row[header] = NUMERIC_COLUMNS.has(header) ? toNumber(raw) : raw;
    });
    row.__index = index + 1;
    row.__raw = headers.map((header) => row[header]).join(" ").toLowerCase();
    return row;
  });
  return { headers, rows };
}

function parseCsvRecords(text) {
  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function syncFilterOptions() {
  fillSelect(elements.modeFilter, uniqueValues("mode"), "All modes");
  fillSelect(elements.faultFilter, uniqueValues("fault"), "All faults");
}

function fillSelect(select, values, label) {
  select.replaceChildren(new Option(label, "all"));
  values.forEach((value) => select.append(new Option(value, value)));
  select.value = "all";
}

function uniqueValues(key) {
  return [...new Set(logData.rows.map((row) => row[key]).filter(Boolean))]
    .sort((left, right) => String(left).localeCompare(String(right)));
}

function render() {
  const rows = getFilteredRows();
  renderSummary(getStats(logData.rows));
  renderTable(rows);
  drawCharts(rows);
}

function getFilteredRows() {
  return logData.rows.filter((row) => {
    if (filters.mode !== "all" && row.mode !== filters.mode) return false;
    if (filters.fault !== "all" && row.fault !== filters.fault) return false;
    if (filters.search && !row.__raw.includes(filters.search)) return false;
    return true;
  });
}

function getStats(rows) {
  const firstTime = rows[0]?.time_ms;
  const lastTime = rows.at(-1)?.time_ms;
  const durationMs = Number.isFinite(firstTime) && Number.isFinite(lastTime)
    ? Math.max(0, lastTime - firstTime)
    : null;
  return {
    count: rows.length,
    durationMs,
    modeCounts: countBy(rows, "mode"),
    faultRows: rows.filter((row) => row.fault && row.fault !== "0x00"),
    bus: range(rows, "bus_v"),
    current: range(rows, "current_ma"),
    roll: range(rows, "roll"),
    pitch: range(rows, "pitch"),
    audioOnRows: rows.filter((row) => row.audio_rail === "ON").length,
  };
}

function renderSummary(stats) {
  elements.rowCount.textContent = stats.count.toLocaleString();
  elements.duration.textContent = stats.durationMs === null ? "--" : `${(stats.durationMs / 1000).toFixed(2)} s`;
  elements.modeSummary.textContent = formatCounts(stats.modeCounts);
  elements.faultSummary.textContent = stats.faultRows.length ? `${stats.faultRows.length} rows` : "None";
  elements.faultSummary.dataset.state = stats.faultRows.length ? "fail" : "pass";
  elements.busSummary.textContent = formatRange(stats.bus, "V", 3);
  elements.currentSummary.textContent = formatRange(stats.current, "mA", 2);
  elements.rollSummary.textContent = formatRange(stats.roll, "deg", 1);
  elements.pitchSummary.textContent = formatRange(stats.pitch, "deg", 1);
  elements.audioSummary.textContent = stats.count ? `${stats.audioOnRows}/${stats.count} ON` : "--";
}

function renderTable(rows) {
  elements.tableHead.replaceChildren();
  elements.tableBody.replaceChildren();

  const headRow = document.createElement("tr");
  logData.headers.forEach((header) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    headRow.append(th);
  });
  elements.tableHead.append(headRow);

  const visibleRows = rows.slice(0, 300);
  const fragment = document.createDocumentFragment();
  visibleRows.forEach((row) => {
    const tr = document.createElement("tr");
    logData.headers.forEach((header) => {
      const td = document.createElement("td");
      td.textContent = formatCell(row[header]);
      if (header === "fault" && row[header] && row[header] !== "0x00") td.dataset.state = "fail";
      tr.append(td);
    });
    fragment.append(tr);
  });
  elements.tableBody.append(fragment);

  const capped = rows.length > visibleRows.length ? `, showing first ${visibleRows.length}` : "";
  elements.tableMeta.textContent = `${rows.length.toLocaleString()} matching rows${capped}`;
}

function drawCharts(rows) {
  drawLineChart(elements.attitudeCanvas, rows, [
    { key: "roll", color: "#f46d75" },
    { key: "pitch", color: "#8edbff" },
  ]);
  drawLineChart(elements.powerCanvas, rows, [
    { key: "bus_v", color: "#8edbff" },
    { key: "current_ma", color: "#f5a14b" },
  ]);
  elements.attitudeLabel.textContent = rows.length ? "Roll / Pitch" : "No rows";
  elements.powerLabel.textContent = rows.length ? "Bus Voltage / Current" : "No rows";
}

function drawLineChart(canvas, rows, series) {
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  context.scale(scale, scale);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 18, right: 18, bottom: 24, left: 42 };
  context.fillStyle = "#0c1013";
  context.fillRect(0, 0, width, height);

  const values = series.flatMap((line) => rows.map((row) => row[line.key]).filter(Number.isFinite));
  if (rows.length < 2 || !values.length) {
    drawEmptyChart(context, width, height);
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;
  drawGrid(context, width, height, padding, yMin, yMax);

  series.forEach((line) => {
    context.beginPath();
    context.strokeStyle = line.color;
    context.lineWidth = 2;
    rows.forEach((row, index) => {
      const value = row[line.key];
      if (!Number.isFinite(value)) return;
      const x = padding.left + (index / (rows.length - 1)) * (width - padding.left - padding.right);
      const y = height - padding.bottom - ((value - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });
}

function drawGrid(context, width, height, padding, min, max) {
  context.strokeStyle = "rgba(154, 168, 178, 0.2)";
  context.fillStyle = "#9aa8b2";
  context.font = "12px Segoe UI, sans-serif";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = padding.top + ratio * (height - padding.top - padding.bottom);
    const value = max - ratio * (max - min);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(value.toFixed(1), 8, y + 4);
  }
}

function drawEmptyChart(context, width, height) {
  context.fillStyle = "#9aa8b2";
  context.font = "13px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText("Load a CSV to draw this chart", width / 2, height / 2);
  context.textAlign = "start";
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] || "--";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function range(rows, key) {
  const values = rows.map((row) => row[key]).filter(Number.isFinite);
  if (!values.length) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([value, count]) => `${value} ${count}`).join(", ") : "--";
}

function formatRange(rangeValue, unit, digits) {
  if (!rangeValue) return "--";
  return `${rangeValue.min.toFixed(digits)} to ${rangeValue.max.toFixed(digits)} ${unit}`;
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return value;
}

function setStatus(message) {
  elements.status.textContent = message;
}
