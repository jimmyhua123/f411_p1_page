import { DEMO_SUMMARY_FIELDS, isDemoSummaryComplete, parseDemoSummaryEntry, parseTelLine } from "./telemetry-utils.js";

const BAUD_RATE = 115200;
const LOG_LIMIT = 4000;
const PWR_SAMPLE_PERIOD_MS = 100;
const SCOPE_SAMPLE_LIMIT = 240;
const SCOPE_PADDING = {
  top: 22,
  right: 18,
  bottom: 24,
  left: 46,
};

const elements = {
  connectButton: document.querySelector("#connectButton"),
  demoButton: document.querySelector("#demoButton"),
  status: document.querySelector("#connectionStatus"),
  bus: document.querySelector("#busValue"),
  current: document.querySelector("#currentValue"),
  power: document.querySelector("#powerValue"),
  avg: document.querySelector("#avgValue"),
  min: document.querySelector("#minValue"),
  max: document.querySelector("#maxValue"),
  sample: document.querySelector("#sampleValue"),
  modeBadge: document.querySelector("#modeBadge"),
  lastUpdated: document.querySelector("#lastUpdatedValue"),
  busScopeCanvas: document.querySelector("#busScopeCanvas"),
  currentScopeCanvas: document.querySelector("#currentScopeCanvas"),
  scopeScaleLabel: document.querySelector("#scopeScaleLabel"),
  busScopeLabel: document.querySelector("#busScopeLabel"),
  currentScopeLabel: document.querySelector("#currentScopeLabel"),
  demoSummaryBadge: document.querySelector("#demoSummaryBadge"),
  demoSummaryUpdated: document.querySelector("#demoSummaryUpdated"),
  demoSummaryValues: new Map(
    [...document.querySelectorAll("[data-summary-key]")].map((element) => [
      element.dataset.summaryKey,
      element,
    ]),
  ),
  rawLog: document.querySelector("#rawLog"),
};

const scopeCanvases = {
  bus: elements.busScopeCanvas?.getContext("2d"),
  current: elements.currentScopeCanvas?.getContext("2d"),
};
const scopeSamples = [];

let port;
let reader;
let keepReading = false;
let demoTimer;
let demoSummaryActive = false;
let demoSummary = {};
let lastFrame = {
  mode: "--",
  bus: undefined,
  current: undefined,
  power: undefined,
  avg: undefined,
  min: undefined,
  max: undefined,
  n: 0,
};

function parsePowerLine(line) {
  if (line.startsWith("TEL,")) {
    return parseCombinedTelemetryLine(line);
  }

  if (line.startsWith("PWR,")) {
    return parseKeyValuePayload(line.slice(4));
  }

  if (line.startsWith("[INA219]")) {
    return parseLegacyIna219Line(line.slice("[INA219]".length).trim());
  }

  return null;
}

function parseCombinedTelemetryLine(line) {
  const values = parseTelLine(line);
  if (!values) return null;

  return normalizeFrame({
    mode: values.mode,
    bus: values.busV,
    current: values.currentMa,
    power: values.powerMw,
    avg: values.currentMa,
    min: values.currentMa,
    max: values.currentMa,
    n: lastFrame.n + 1,
  });
}

function parseKeyValuePayload(payload) {
  const values = {};

  for (const part of payload.split(",")) {
    const [key, value] = part.split("=");
    if (!key || value === undefined) continue;
    values[key.trim()] = value.trim();
  }

  const frame = {
    mode: values.mode || lastFrame.mode,
    bus: readNumber(values.bus),
    current: readNumber(values.current),
    power: readNumber(values.power),
    avg: readNumber(values.avg),
    min: readNumber(values.min),
    max: readNumber(values.max),
    n: readNumber(values.n),
  };

  if (!Number.isFinite(frame.bus) || !Number.isFinite(frame.current)) return null;
  return normalizeFrame(frame);
}

function parseLegacyIna219Line(payload) {
  const values = {};

  for (const part of payload.split(/\s+/)) {
    const [key, rawValue] = part.split("=");
    if (!key || rawValue === undefined) continue;
    values[key.trim()] = rawValue.trim();
  }

  const current = readNumber(values.current);
  const frame = {
    mode: "INA219",
    bus: readNumber(values.bus) / 1000,
    current,
    power: readNumber(values.power),
    avg: current,
    min: current,
    max: current,
    n: 1,
  };

  if (!Number.isFinite(frame.bus) || !Number.isFinite(frame.current)) return null;
  return normalizeFrame(frame);
}

function normalizeFrame(frame) {
  const current = frame.current;
  return {
    mode: String(frame.mode || "--").toUpperCase(),
    bus: frame.bus,
    current,
    power: Number.isFinite(frame.power) ? frame.power : 0,
    avg: Number.isFinite(frame.avg) ? frame.avg : current,
    min: Number.isFinite(frame.min) ? frame.min : current,
    max: Number.isFinite(frame.max) ? frame.max : current,
    n: Number.isFinite(frame.n) ? frame.n : 0,
  };
}

function readNumber(value) {
  if (value === undefined) return Number.NaN;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function updateView(frame) {
  const previousFrame = lastFrame;
  lastFrame = frame;

  elements.bus.textContent = `${frame.bus.toFixed(3)} V`;
  elements.current.textContent = `${frame.current.toFixed(2)} mA`;
  elements.power.textContent = `${frame.power.toFixed(1)} mW`;
  elements.avg.textContent = `${frame.avg.toFixed(2)} mA`;
  elements.min.textContent = `${frame.min.toFixed(2)} mA`;
  elements.max.textContent = `${frame.max.toFixed(2)} mA`;
  elements.sample.textContent = frame.n.toFixed(0);
  elements.modeBadge.textContent = formatMode(frame.mode);
  elements.lastUpdated.textContent = `最後更新 ${new Date().toLocaleTimeString("zh-TW", { hour12: false })}`;

  updateScope(frame, previousFrame);

}

function appendRawLine(line) {
  elements.rawLog.value = `${line}\n${elements.rawLog.value}`.slice(0, LOG_LIMIT);
}

function updateScope(frame, previousFrame) {
  if (!scopeCanvases.bus && !scopeCanvases.current) return;

  if (shouldResetScope(frame, previousFrame)) {
    scopeSamples.length = 0;
  }

  scopeSamples.push({
    bus: frame.bus,
    current: frame.current,
    time: performance.now(),
  });

  if (scopeSamples.length > SCOPE_SAMPLE_LIMIT) {
    scopeSamples.splice(0, scopeSamples.length - SCOPE_SAMPLE_LIMIT);
  }

  drawScope();
}

function drawScope() {
  drawScopeCanvas({
    context: scopeCanvases.bus,
    canvas: elements.busScopeCanvas,
    key: "bus",
    color: "#8edbff",
    unit: "V",
    decimals: 3,
    label: elements.busScopeLabel,
  });
  drawScopeCanvas({
    context: scopeCanvases.current,
    canvas: elements.currentScopeCanvas,
    key: "current",
    color: "#f5a14b",
    unit: "mA",
    decimals: 2,
    label: elements.currentScopeLabel,
  });

  const latest = scopeSamples[scopeSamples.length - 1];
  const timeSpanSeconds = getScopeTimeSpanSeconds();
  elements.scopeScaleLabel.textContent = latest
    ? `${timeSpanSeconds.toFixed(1)} s | Samples ${scopeSamples.length} | Bus ${latest.bus.toFixed(3)} V | Current ${latest.current.toFixed(2)} mA`
    : "Waiting for samples";
}

function drawScopeCanvas({ context, canvas, key, color, unit, decimals, label }) {
  if (!context || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.round(rect.width * ratio));
  const height = Math.max(180, Math.round(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = context;
  ctx.save();
  ctx.scale(ratio, ratio);

  const cssWidth = width / ratio;
  const cssHeight = height / ratio;
  const plot = {
    x: SCOPE_PADDING.left,
    y: SCOPE_PADDING.top,
    width: cssWidth - SCOPE_PADDING.left - SCOPE_PADDING.right,
    height: cssHeight - SCOPE_PADDING.top - SCOPE_PADDING.bottom,
  };

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawScopeBackground(ctx, plot);

  if (scopeSamples.length < 2) {
    drawScopeEmptyState(ctx, cssWidth, cssHeight, unit);
    ctx.restore();
    return;
  }

  const range = getRange(scopeSamples.map((sample) => sample[key]));

  drawScopeTrace(ctx, plot, scopeSamples, key, range, color, 2);
  drawScopeReadout(ctx, plot, range, unit, decimals);
  drawScopeTimeAxis(ctx, plot);
  label.textContent = `${scopeSamples[scopeSamples.length - 1][key].toFixed(decimals)} ${unit}`;

  ctx.restore();
}

function drawScopeBackground(ctx, plot) {
  ctx.fillStyle = "#0c1013";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.strokeStyle = "rgba(142, 219, 255, 0.12)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 8; i += 1) {
    const x = plot.x + (plot.width * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.height);
    ctx.stroke();
  }

  for (let i = 0; i <= 4; i += 1) {
    const y = plot.y + (plot.height * i) / 4;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(237, 242, 244, 0.28)";
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y + plot.height / 2);
  ctx.lineTo(plot.x + plot.width, plot.y + plot.height / 2);
  ctx.stroke();
}

function drawScopeTrace(ctx, plot, samples, key, range, color, lineWidth) {
  const firstTime = samples[0].time;
  const lastTime = samples[samples.length - 1].time;
  const timeSpan = Math.max(lastTime - firstTime, PWR_SAMPLE_PERIOD_MS);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  samples.forEach((sample, index) => {
    const x = plot.x + (plot.width * (sample.time - firstTime)) / timeSpan;
    const y = mapToPlotY(sample[key], range, plot);

    if (index === 0) {
      ctx.moveTo(x, y);
      return;
    }

    ctx.lineTo(x, y);
  });

  ctx.stroke();

  const latest = samples[samples.length - 1];
  const latestX = plot.x + plot.width;
  const latestY = mapToPlotY(latest[key], range, plot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(latestX, latestY, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawScopeReadout(ctx, plot, range, unit, decimals) {
  ctx.fillStyle = "rgba(237, 242, 244, 0.78)";
  ctx.font = "12px Segoe UI, Noto Sans TC, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${range.max.toFixed(decimals)} ${unit}`, 8, plot.y + 2);
  ctx.fillText(`${range.min.toFixed(decimals)} ${unit}`, 8, plot.y + plot.height - 2);
  ctx.textAlign = "left";
}

function drawScopeTimeAxis(ctx, plot) {
  const timeSpanSeconds = getScopeTimeSpanSeconds();

  ctx.fillStyle = "rgba(154, 168, 178, 0.82)";
  ctx.font = "12px Segoe UI, Noto Sans TC, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`-${timeSpanSeconds.toFixed(1)}s`, plot.x, plot.y + plot.height + 17);
  ctx.textAlign = "right";
  ctx.fillText("0s", plot.x + plot.width, plot.y + plot.height + 17);
  ctx.textAlign = "left";
}

function drawScopeEmptyState(ctx, width, height, unit) {
  ctx.fillStyle = "rgba(154, 168, 178, 0.8)";
  ctx.font = "13px Segoe UI, Noto Sans TC, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Waiting for ${unit} samples`, width / 2, height / 2);
  ctx.textAlign = "left";
}

function getRange(values) {
  const finiteValues = values.filter(Number.isFinite);
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const span = max - min;
  const padding = Math.max(span * 0.12, Math.abs(max || min || 1) * 0.001, 0.01);

  if (span === 0) {
    return {
      min: min - padding,
      max: max + padding,
    };
  }

  return {
    min: min - padding,
    max: max + padding,
  };
}

function mapToPlotY(value, range, plot) {
  const span = range.max - range.min;
  const normalized = span > 0 ? (value - range.min) / span : 0.5;
  return plot.y + plot.height - clamp(normalized, 0, 1) * plot.height;
}

function shouldResetScope(frame, previousFrame) {
  const previousMode = previousFrame.mode;
  const modeChanged = previousMode !== "--" && frame.mode !== previousMode;
  const sampleCountReset =
    Number.isFinite(previousFrame.n) &&
    previousFrame.n > 0 &&
    Number.isFinite(frame.n) &&
    frame.n > 0 &&
    frame.n < previousFrame.n;

  return modeChanged || sampleCountReset;
}

function getScopeTimeSpanSeconds() {
  if (scopeSamples.length < 2) return 0;

  const first = scopeSamples[0];
  const latest = scopeSamples[scopeSamples.length - 1];
  return Math.max(0, (latest.time - first.time) / 1000);
}

function formatMode(mode) {
  const labels = {
    LOW_POWER: "LOW POWER",
    ACTIVE: "ACTIVE",
    MUTED: "MUTED",
    DIAGNOSTIC: "DIAGNOSTIC",
    INA219: "INA219",
  };
  return labels[mode] ?? mode;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setStatus(text) {
  elements.status.textContent = text;
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    setStatus("此瀏覽器不支援 Web Serial，請使用 Chrome 或 Edge");
    return;
  }

  stopDemo();

  if (port) {
    await disconnectSerial();
    return;
  }

  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: BAUD_RATE });
    keepReading = true;
    elements.connectButton.textContent = "中斷連線";
    setStatus(`已連線，baud ${BAUD_RATE}`);
    readSerialLoop();
  } catch (error) {
    setStatus(`連線失敗：${error.message}`);
    port = undefined;
  }
}

async function disconnectSerial() {
  keepReading = false;

  if (reader) {
    await reader.cancel();
    reader.releaseLock();
    reader = undefined;
  }

  if (port) {
    await port.close();
    port = undefined;
  }

  elements.connectButton.textContent = "連接序列埠";
  setStatus("未連線");
}

async function readSerialLoop() {
  const decoder = new TextDecoderStream();
  const readableClosed = port.readable.pipeTo(decoder.writable);
  reader = decoder.readable.getReader();
  let buffer = "";

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        handleLine(line.trim());
      }
    }
  } catch (error) {
    setStatus(`讀取失敗：${error.message}`);
  } finally {
    reader?.releaseLock();
    reader = undefined;
    await readableClosed.catch(() => undefined);
  }
}

function handleLine(line) {
  if (!line) return;

  appendRawLine(line);
  handleDemoSummaryLine(line);

  const frame = parsePowerLine(line);
  if (frame) {
    updateView(frame);
  }
}

function handleDemoSummaryLine(line) {
  if (line === "[DEMO_SUMMARY]") {
    demoSummaryActive = true;
    demoSummary = {};
    renderDemoSummary();
    return;
  }

  if (!demoSummaryActive) return;

  const entry = parseDemoSummaryEntry(line);
  if (!entry) {
    if (line.startsWith("[") || line.startsWith("PWR,") || line.startsWith("SIM") || line.startsWith("TEL,")) {
      demoSummaryActive = false;
    }
    return;
  }

  demoSummary[entry.key] = entry.value;
  renderDemoSummary();

  if (isDemoSummaryComplete(demoSummary)) {
    demoSummaryActive = false;
  }
}

function renderDemoSummary() {
  for (const key of DEMO_SUMMARY_FIELDS) {
    const element = elements.demoSummaryValues.get(key);
    if (!element) continue;

    const value = demoSummary[key] ?? defaultSummaryValue(key);
    element.textContent = value;
    element.dataset.state = getSummaryState(value);
  }

  const result = demoSummary.RESULT;
  elements.demoSummaryBadge.textContent = result || (demoSummaryActive ? "RECEIVING" : "WAITING");
  elements.demoSummaryBadge.dataset.state = getSummaryState(result);
  elements.demoSummaryUpdated.textContent = demoSummaryActive
    ? "正在接收 demo summary"
    : result
      ? `最後更新 ${new Date().toLocaleTimeString("zh-TW", { hour12: false })}`
      : "等待 [DEMO_SUMMARY]";
}

function defaultSummaryValue(key) {
  return key.endsWith("_CURRENT") ? "-- mA" : "--";
}

function getSummaryState(value) {
  if (value === "PASS" || value === "OK") return "pass";
  if (value === "FAIL") return "fail";
  if (value === "UNKNOWN" || value === "NA") return "unknown";
  return "neutral";
}

async function toggleDemo() {
  if (demoTimer) {
    stopDemo();
    return;
  }

  if (port) {
    await disconnectSerial();
  }

  const startedAt = performance.now();
  elements.demoButton.textContent = "停止 Demo";
  setStatus("Demo 資料輸入中");
  demoTimer = window.setInterval(() => {
    const t = (performance.now() - startedAt) / 1000;
    const current = Math.sin(t * 1.7) * 0.35 - 0.12;
    const avg = lastFrame.n > 0 ? lastFrame.avg * 0.9 + current * 0.1 : current;
    const min = Math.min(Number.isFinite(lastFrame.min) ? lastFrame.min : current, current);
    const max = Math.max(Number.isFinite(lastFrame.max) ? lastFrame.max : current, current);
    const bus = 4.972 + Math.sin(t * 0.4) * 0.006;
    const power = Math.max(0, bus * current);
    const line =
      `PWR,mode=LOW_POWER,bus=${bus.toFixed(3)},current=${current.toFixed(2)},` +
      `power=${power.toFixed(1)},avg=${avg.toFixed(2)},min=${min.toFixed(2)},` +
      `max=${max.toFixed(2)},n=${lastFrame.n + 1}`;
    handleLine(line);

    if (lastFrame.n === 40) {
      emitDemoSummaryDemo();
    }
  }, PWR_SAMPLE_PERIOD_MS);
}

function emitDemoSummaryDemo() {
  [
    "[DEMO_SUMMARY]",
    "HEAD_TRACKING=PASS",
    "HEAD_DOWN_MUTE=PASS",
    "LOW_POWER_AUDIO_RAIL_CUTOFF=PASS",
    "ACTIVE_20_CURRENT=18.0mA",
    "HEAD_DOWN_CURRENT=5.6mA",
    "LOW_POWER_CURRENT=-0.3mA",
    "RESULT=PASS",
    "IMU=OK",
    "I2S_LEFT=OK",
    "I2S_RIGHT=OK",
    "INA219=OK",
  ].forEach(handleLine);
}

function stopDemo() {
  if (!demoTimer) return;

  window.clearInterval(demoTimer);
  demoTimer = undefined;
  elements.demoButton.textContent = "Demo";
  setStatus(port ? `已連線，baud ${BAUD_RATE}` : "未連線");
}

elements.connectButton.addEventListener("click", connectSerial);
elements.demoButton.addEventListener("click", toggleDemo);
window.addEventListener("resize", drawScope);
drawScope();
