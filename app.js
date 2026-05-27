import * as THREE from "./node_modules/three/build/three.module.js";
import { parseTelLine } from "./telemetry-utils.js";

const BAUD_RATE = 115200;
const LOG_LIMIT = 4000;
const POWER_SCOPE_SAMPLE_LIMIT = 240;
const POWER_SCOPE_SAMPLE_PERIOD_MS = 100;
const POWER_SCOPE_PADDING = {
  top: 22,
  right: 18,
  bottom: 24,
  left: 46,
};

const elements = {
  connectButton: document.querySelector("#connectButton"),
  calibrateButton: document.querySelector("#calibrateButton"),
  demoButton: document.querySelector("#demoButton"),
  status: document.querySelector("#connectionStatus"),
  model: document.querySelector("#model"),
  horizonSky: document.querySelector("#horizonSky"),
  rawLog: document.querySelector("#rawLog"),
  roll: document.querySelector("#rollValue"),
  pitch: document.querySelector("#pitchValue"),
  yaw: document.querySelector("#yawValue"),
  ax: document.querySelector("#axValue"),
  ay: document.querySelector("#ayValue"),
  az: document.querySelector("#azValue"),
  gx: document.querySelector("#gxValue"),
  gy: document.querySelector("#gyValue"),
  gz: document.querySelector("#gzValue"),
  direction: document.querySelector("#directionValue"),
  volume: document.querySelector("#volumeValue"),
  volumeFill: document.querySelector("#volumeFill"),
  leftVolume: document.querySelector("#leftVolumeValue"),
  rightVolume: document.querySelector("#rightVolumeValue"),
  leftVolumeFill: document.querySelector("#leftVolumeFill"),
  rightVolumeFill: document.querySelector("#rightVolumeFill"),
  targetLeft: document.querySelector("#targetLeftValue"),
  targetRight: document.querySelector("#targetRightValue"),
  mode: document.querySelector("#modeValue"),
  audioState: document.querySelector("#audioStateValue"),
  tone: document.querySelector("#toneValue"),
  gainDb: document.querySelector("#gainDbValue"),
  fault: document.querySelector("#faultValue"),
  bus: document.querySelector("#busValue"),
  current: document.querySelector("#currentValue"),
  power: document.querySelector("#powerValue"),
  powerBus: document.querySelector("#powerBusValue"),
  powerCurrent: document.querySelector("#powerCurrentValue"),
  powerPower: document.querySelector("#powerPowerValue"),
  busScopeCanvas: document.querySelector("#busScopeCanvas"),
  currentScopeCanvas: document.querySelector("#currentScopeCanvas"),
  scopeScaleLabel: document.querySelector("#scopeScaleLabel"),
  busScopeLabel: document.querySelector("#busScopeLabel"),
  currentScopeLabel: document.querySelector("#currentScopeLabel"),
  invertX: document.querySelector("#invertX"),
  invertY: document.querySelector("#invertY"),
  invertZ: document.querySelector("#invertZ"),
};

const powerScopeCanvases = {
  bus: elements.busScopeCanvas?.getContext("2d"),
  current: elements.currentScopeCanvas?.getContext("2d"),
};
const powerScopeSamples = [];

let port;
let reader;
let keepReading = false;
let demoTimer;
let calibration = {
  roll: 0,
  pitch: 0,
  yaw: 0,
};
let axisDirection = {
  x: 1,
  y: 1,
  z: 1,
};
let telemetry = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  ax: 0,
  ay: 0,
  az: 0,
  gx: 0,
  gy: 0,
  gz: 0,
  direction: "CENTER",
  volume: 50,
  targetLeft: 100,
  targetRight: 100,
  smoothLeft: 100,
  smoothRight: 100,
  mode: "SIM",
  audio: "ON",
  tone: "NEUTRAL",
  gainDb: -12,
  fault: "00000000",
  bus: 0,
  current: 0,
  power: 0,
};

const preview = createThreePreview(elements.model);

function parseLine(line) {
  if (line.startsWith("TEL,")) return parseCombinedTelemetryLine(line);
  if (line.startsWith("SIM2,")) return parseSim2Line(line);
  if (line.startsWith("SIM,")) return parseSimLine(line);
  return null;
}

function parseCombinedTelemetryLine(line) {
  const frame = parseTelLine(line);
  if (!frame) return null;

  return buildTelemetryFrame({
    mode: frame.mode,
    fault: frame.faultHex,
    rollCd: frame.rollCd,
    pitchCd: frame.pitchCd,
    head: frame.head,
    targetLeftPct: frame.targetLeft,
    targetRightPct: frame.targetRight,
    smoothLeftPct: frame.smoothLeft,
    smoothRightPct: frame.smoothRight,
    bus: frame.busV,
    current: frame.currentMa,
    power: frame.powerMw,
    audioRailOn: frame.audioRailOn,
  });
}

function parseSimLine(line) {
  const fields = line.split(",");
  if (fields.length !== 9) return null;

  const [
    ,
    ms,
    rollCd,
    pitchCd,
    head,
    targetLeftPct,
    targetRightPct,
    smoothLeftPct,
    smoothRightPct,
  ] = fields;

  return buildTelemetryFrame({
    mode: telemetry.mode,
    rollCd,
    pitchCd,
    head,
    targetLeftPct,
    targetRightPct,
    smoothLeftPct,
    smoothRightPct,
  });
}

function parseSim2Line(line) {
  const fields = line.split(",");
  if (fields.length !== 10 && fields.length !== 11) return null;

  const [, ms, mode, fourth, fifth, sixth, seventh, eighth, ninth, tenth, eleventh] = fields;
  if (!Number.isFinite(Number(ms))) return null;

  const hasFault = fields.length === 11;
  return buildTelemetryFrame({
    mode,
    fault: hasFault ? fourth : telemetry.fault,
    rollCd: hasFault ? fifth : fourth,
    pitchCd: hasFault ? sixth : fifth,
    head: hasFault ? seventh : sixth,
    targetLeftPct: hasFault ? eighth : seventh,
    targetRightPct: hasFault ? ninth : eighth,
    smoothLeftPct: hasFault ? tenth : ninth,
    smoothRightPct: hasFault ? eleventh : tenth,
  });
}

function buildTelemetryFrame({
  mode,
  fault = telemetry.fault,
  rollCd,
  pitchCd,
  head,
  targetLeftPct,
  targetRightPct,
  smoothLeftPct,
  smoothRightPct,
  bus = telemetry.bus,
  current = telemetry.current,
  power = telemetry.power,
  audioRailOn,
}) {
  const parsed = {
    rollCd: Number(rollCd),
    pitchCd: Number(pitchCd),
    targetLeft: Number(targetLeftPct),
    targetRight: Number(targetRightPct),
    smoothLeft: Number(smoothLeftPct),
    smoothRight: Number(smoothRightPct),
    bus: Number(bus),
    current: Number(current),
    power: Number(power),
  };

  if (Object.values(parsed).some((value) => !Number.isFinite(value))) return null;

  const direction = head.trim().toUpperCase();
  const smoothAverage = (parsed.smoothLeft + parsed.smoothRight) / 2;
  const audio = audioRailOn === undefined
    ? (smoothAverage <= 0 ? "OFF" : "ON")
    : (audioRailOn ? "ON" : "OFF");

  return {
    ...telemetry,
    roll: parsed.rollCd / 100,
    pitch: parsed.pitchCd / 100,
    yaw: 0,
    direction,
    targetLeft: clamp(parsed.targetLeft, 0, 100),
    targetRight: clamp(parsed.targetRight, 0, 100),
    smoothLeft: clamp(parsed.smoothLeft, 0, 100),
    smoothRight: clamp(parsed.smoothRight, 0, 100),
    mode: mode.trim().toUpperCase(),
    fault: String(fault).trim().toUpperCase(),
    volume: clamp(smoothAverage, 0, 100),
    audio,
    tone: directionToTone(direction),
    gainDb: percentToDb(smoothAverage),
    bus: parsed.bus,
    current: parsed.current,
    power: parsed.power,
  };
}

function updateView(nextTelemetry, rawLine) {
  telemetry = nextTelemetry;
  const roll = clamp((telemetry.roll - calibration.roll) * axisDirection.x, -180, 180);
  const pitch = clamp((telemetry.pitch - calibration.pitch) * axisDirection.y, -90, 90);
  const yaw = normalizeAngle((telemetry.yaw - calibration.yaw) * axisDirection.z);

  elements.roll.textContent = `${roll.toFixed(2)} deg`;
  elements.pitch.textContent = `${pitch.toFixed(2)} deg`;
  elements.yaw.textContent = `${yaw.toFixed(2)} deg`;
  elements.ax.textContent = telemetry.ax.toFixed(0);
  elements.ay.textContent = telemetry.ay.toFixed(0);
  elements.az.textContent = telemetry.az.toFixed(0);
  elements.gx.textContent = telemetry.gx.toFixed(0);
  elements.gy.textContent = telemetry.gy.toFixed(0);
  elements.gz.textContent = telemetry.gz.toFixed(0);
  elements.direction.textContent = formatDirection(telemetry.direction);
  elements.volume.textContent = `${clamp(telemetry.volume, 0, 100).toFixed(0)} %`;
  elements.volumeFill.style.width = `${clamp(telemetry.volume, 0, 100)}%`;
  elements.leftVolume.textContent = `${telemetry.smoothLeft.toFixed(0)} %`;
  elements.rightVolume.textContent = `${telemetry.smoothRight.toFixed(0)} %`;
  elements.leftVolumeFill.style.width = `${telemetry.smoothLeft}%`;
  elements.rightVolumeFill.style.width = `${telemetry.smoothRight}%`;
  elements.targetLeft.textContent = `${telemetry.targetLeft.toFixed(0)} %`;
  elements.targetRight.textContent = `${telemetry.targetRight.toFixed(0)} %`;
  elements.mode.textContent = formatMode(telemetry.mode);
  elements.audioState.textContent = telemetry.audio === "OFF" ? "OFF" : "ON";
  elements.tone.textContent = formatTone(telemetry.tone);
  elements.gainDb.textContent = `${telemetry.gainDb.toFixed(1)} dB`;
  elements.fault.textContent = telemetry.fault;
  elements.bus.textContent = `${telemetry.bus.toFixed(3)} V`;
  elements.current.textContent = `${telemetry.current.toFixed(2)} mA`;
  elements.power.textContent = `${telemetry.power.toFixed(1)} mW`;
  elements.powerBus.textContent = `${telemetry.bus.toFixed(3)} V`;
  elements.powerCurrent.textContent = `${telemetry.current.toFixed(2)} mA`;
  elements.powerPower.textContent = `${telemetry.power.toFixed(1)} mW`;
  updatePowerScope(telemetry);

  preview.setAttitude(roll, pitch, yaw);
  elements.horizonSky.style.transform =
    `translate(-50%, -50%) rotate(${roll * -1}deg) translateY(${pitch * 4}px)`;

  if (rawLine) {
    elements.rawLog.value = `${rawLine}\n${elements.rawLog.value}`.slice(0, LOG_LIMIT);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updatePowerScope(frame) {
  if (!powerScopeCanvases.bus && !powerScopeCanvases.current) return;

  powerScopeSamples.push({
    bus: frame.bus,
    current: frame.current,
    time: performance.now(),
  });

  if (powerScopeSamples.length > POWER_SCOPE_SAMPLE_LIMIT) {
    powerScopeSamples.splice(0, powerScopeSamples.length - POWER_SCOPE_SAMPLE_LIMIT);
  }

  drawPowerScope();
}

function drawPowerScope() {
  drawPowerScopeCanvas({
    context: powerScopeCanvases.bus,
    canvas: elements.busScopeCanvas,
    key: "bus",
    color: "#8edbff",
    unit: "V",
    decimals: 3,
    label: elements.busScopeLabel,
  });
  drawPowerScopeCanvas({
    context: powerScopeCanvases.current,
    canvas: elements.currentScopeCanvas,
    key: "current",
    color: "#f5a14b",
    unit: "mA",
    decimals: 2,
    label: elements.currentScopeLabel,
  });

  const latest = powerScopeSamples[powerScopeSamples.length - 1];
  const timeSpanSeconds = getPowerScopeTimeSpanSeconds();
  elements.scopeScaleLabel.textContent = latest
    ? `${timeSpanSeconds.toFixed(1)} s | Samples ${powerScopeSamples.length} | Bus ${latest.bus.toFixed(3)} V | Current ${latest.current.toFixed(2)} mA`
    : "Waiting for TEL samples";
}

function drawPowerScopeCanvas({ context, canvas, key, color, unit, decimals, label }) {
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
    x: POWER_SCOPE_PADDING.left,
    y: POWER_SCOPE_PADDING.top,
    width: cssWidth - POWER_SCOPE_PADDING.left - POWER_SCOPE_PADDING.right,
    height: cssHeight - POWER_SCOPE_PADDING.top - POWER_SCOPE_PADDING.bottom,
  };

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawPowerScopeBackground(ctx, plot);

  if (powerScopeSamples.length < 2) {
    drawPowerScopeEmptyState(ctx, cssWidth, cssHeight, unit);
    ctx.restore();
    return;
  }

  const range = getRange(powerScopeSamples.map((sample) => sample[key]));
  drawPowerScopeTrace(ctx, plot, powerScopeSamples, key, range, color);
  drawPowerScopeReadout(ctx, plot, range, unit, decimals);
  drawPowerScopeTimeAxis(ctx, plot);
  label.textContent = `${powerScopeSamples[powerScopeSamples.length - 1][key].toFixed(decimals)} ${unit}`;

  ctx.restore();
}

function drawPowerScopeBackground(ctx, plot) {
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

function drawPowerScopeTrace(ctx, plot, samples, key, range, color) {
  const firstTime = samples[0].time;
  const lastTime = samples[samples.length - 1].time;
  const timeSpan = Math.max(lastTime - firstTime, POWER_SCOPE_SAMPLE_PERIOD_MS);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  samples.forEach((sample, index) => {
    const x = plot.x + (plot.width * (sample.time - firstTime)) / timeSpan;
    const y = mapToPlotY(sample[key], range, plot);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  const latest = samples[samples.length - 1];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(plot.x + plot.width, mapToPlotY(latest[key], range, plot), 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPowerScopeReadout(ctx, plot, range, unit, decimals) {
  ctx.fillStyle = "rgba(237, 242, 244, 0.78)";
  ctx.font = "12px Segoe UI, Noto Sans TC, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${range.max.toFixed(decimals)} ${unit}`, 8, plot.y + 2);
  ctx.fillText(`${range.min.toFixed(decimals)} ${unit}`, 8, plot.y + plot.height - 2);
}

function drawPowerScopeTimeAxis(ctx, plot) {
  const timeSpanSeconds = getPowerScopeTimeSpanSeconds();
  ctx.fillStyle = "rgba(154, 168, 178, 0.82)";
  ctx.font = "12px Segoe UI, Noto Sans TC, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`-${timeSpanSeconds.toFixed(1)}s`, plot.x, plot.y + plot.height + 17);
  ctx.textAlign = "right";
  ctx.fillText("0s", plot.x + plot.width, plot.y + plot.height + 17);
  ctx.textAlign = "left";
}

function drawPowerScopeEmptyState(ctx, width, height, unit) {
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

  return span === 0
    ? { min: min - padding, max: max + padding }
    : { min: min - padding, max: max + padding };
}

function mapToPlotY(value, range, plot) {
  const span = range.max - range.min;
  const normalized = span > 0 ? (value - range.min) / span : 0.5;
  return plot.y + plot.height - clamp(normalized, 0, 1) * plot.height;
}

function getPowerScopeTimeSpanSeconds() {
  if (powerScopeSamples.length < 2) return 0;
  return Math.max(0, (powerScopeSamples.at(-1).time - powerScopeSamples[0].time) / 1000);
}

function normalizeAngle(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function percentToDb(percent) {
  if (percent <= 0) return -60;
  return 20 * Math.log10(clamp(percent, 1, 100) / 100);
}

function directionToTone(direction) {
  if (direction === "LEFT") return "DARK";
  if (direction === "RIGHT") return "BRIGHT";
  if (direction === "DOWN") return "MUTE";
  return "NEUTRAL";
}

function formatMode(mode) {
  const labels = {
    SIM: "Legacy",
    ACTIVE: "ACTIVE",
    MUTED: "MUTED",
    LOW_POWER: "LOW POWER",
    DIAGNOSTIC: "DIAGNOSTIC",
  };
  return labels[mode] ?? mode;
}

function formatDirection(direction) {
  const labels = {
    CENTER: "置中",
    LEFT: "左轉",
    RIGHT: "右轉",
    UP: "抬頭",
    DOWN: "低頭",
    TILT_LEFT: "左傾",
    TILT_RIGHT: "右傾",
    FACE_UP: "朝上",
    FACE_DOWN: "朝下",
  };
  return labels[direction] ?? direction;
}

function formatTone(tone) {
  const labels = {
    NEUTRAL: "標準",
    BRIGHT: "偏亮",
    DARK: "偏暗",
    MUTE: "靜音",
  };
  return labels[tone] ?? tone;
}

function setStatus(text) {
  elements.status.textContent = text;
}

function createThreePreview(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const airplane = new THREE.Group();
  const targetRotation = new THREE.Euler(0, 0, 0, "XYZ");

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  camera.position.set(4.3, 3.1, 5.4);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x243036, 1.8));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(4, 6, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7fc7ff, 0.8);
  fillLight.position.set(-5, 2, -4);
  scene.add(fillLight);

  scene.add(makeReferenceGrid());
  scene.add(makeAxes());
  scene.add(airplane);
  buildAirplane(airplane);

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function animate() {
    airplane.rotation.x += (targetRotation.x - airplane.rotation.x) * 0.22;
    airplane.rotation.y += (targetRotation.y - airplane.rotation.y) * 0.22;
    airplane.rotation.z += (targetRotation.z - airplane.rotation.z) * 0.22;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  new ResizeObserver(resize).observe(container);
  resize();
  animate();

  return {
    setAttitude(roll, pitch, yaw) {
      targetRotation.x = THREE.MathUtils.degToRad(pitch);
      targetRotation.y = THREE.MathUtils.degToRad(yaw);
      targetRotation.z = THREE.MathUtils.degToRad(-roll);
    },
  };
}

function buildAirplane(group) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfe9ec,
    roughness: 0.46,
    metalness: 0.18,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2a13a,
    roughness: 0.42,
    metalness: 0.08,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3a40,
    roughness: 0.62,
    metalness: 0.18,
  });
  const canopyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x6ec7ef,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.18,
    transparent: true,
    opacity: 0.72,
  });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.9, 36), bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.78, 36), accentMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.82;
  nose.castShadow = true;
  group.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), canopyMaterial);
  canopy.scale.set(0.72, 0.48, 1.25);
  canopy.position.set(0, 0.27, -0.62);
  canopy.castShadow = true;
  group.add(canopy);

  addWing(group, 0, -0.25, 3.9, 0.12, 0.62, bodyMaterial);
  addWing(group, 0, 1.24, 1.75, 0.1, 0.38, bodyMaterial);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.52), accentMaterial);
  fin.position.set(0, 0.46, 1.32);
  fin.rotation.x = -0.22;
  fin.castShadow = true;
  group.add(fin);

  const propeller = new THREE.Group();
  propeller.position.z = -2.27;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 24), darkMaterial);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);

  const bladeGeometry = new THREE.BoxGeometry(0.16, 1.35, 0.045);
  const bladeA = new THREE.Mesh(bladeGeometry, darkMaterial);
  const bladeB = bladeA.clone();
  bladeB.rotation.z = Math.PI / 2;
  propeller.add(bladeA, bladeB);
  group.add(propeller);

  const shadow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 2.55, 24),
    new THREE.MeshStandardMaterial({ color: 0x5f6c72, roughness: 0.8 })
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = -0.12;
  shadow.position.z = 0.12;
  shadow.scale.set(0.84, 0.84, 1);
  shadow.receiveShadow = true;
  group.add(shadow);
}

function addWing(group, x, z, width, thickness, depth, material) {
  const wing = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), material);
  wing.position.set(x, 0, z);
  wing.castShadow = true;
  wing.receiveShadow = true;
  group.add(wing);

  const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, thickness * 1.6, depth * 0.88), material);
  leftTip.position.set(-width / 2 - 0.04, -0.01, z);
  leftTip.rotation.z = 0.18;
  leftTip.castShadow = true;
  group.add(leftTip);

  const rightTip = leftTip.clone();
  rightTip.position.x = width / 2 + 0.04;
  rightTip.rotation.z = -0.18;
  group.add(rightTip);
}

function makeReferenceGrid() {
  const group = new THREE.Group();
  const grid = new THREE.GridHelper(6, 12, 0x42515a, 0x26323a);
  grid.position.y = -0.9;
  group.add(grid);
  return group;
}

function makeAxes() {
  const group = new THREE.Group();
  group.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -0.72, 0), 2.35, 0xf46d75, 0.18, 0.09));
  group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -0.72, 0), 1.55, 0xf5d45c, 0.18, 0.09));
  group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -0.72, 0), 2.1, 0x8edbff, 0.18, 0.09));
  return group;
}

function calibrateAttitude() {
  calibration = {
    roll: telemetry.roll,
    pitch: telemetry.pitch,
    yaw: telemetry.yaw,
  };
  updateView(telemetry, "");
  setStatus(
    `已3軸校正：roll ${calibration.roll.toFixed(2)} deg, ` +
      `pitch ${calibration.pitch.toFixed(2)} deg, yaw ${calibration.yaw.toFixed(2)} deg`
  );
}

function syncAxisControls() {
  elements.invertX.checked = axisDirection.x < 0;
  elements.invertY.checked = axisDirection.y < 0;
  elements.invertZ.checked = axisDirection.z < 0;
}

function updateAxisDirection() {
  axisDirection = {
    x: elements.invertX.checked ? -1 : 1,
    y: elements.invertY.checked ? -1 : 1,
    z: elements.invertZ.checked ? -1 : 1,
  };
  updateView(telemetry, "");
  setStatus(
    `軸向：X ${axisDirection.x < 0 ? "反轉" : "正常"}, ` +
      `Y ${axisDirection.y < 0 ? "反轉" : "正常"}, ` +
      `Z ${axisDirection.z < 0 ? "反轉" : "正常"}`
  );
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

  elements.connectButton.textContent = "連接串口";
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
    setStatus(`讀取中斷：${error.message}`);
  } finally {
    reader?.releaseLock();
    reader = undefined;
    await readableClosed.catch(() => undefined);
  }
}

function handleLine(line) {
  if (!line) return;

  const next = parseLine(line);
  if (next) {
    updateView(next, line);
  }
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
  setStatus("Demo 模式");
  demoTimer = window.setInterval(() => {
    const t = (performance.now() - startedAt) / 1000;
    const rollCd = Math.round(Math.sin(t * 0.9) * 2800);
    const pitchCd = Math.round(Math.cos(t * 0.7) * 1800);
    const direction = rollCd < -1800 ? "LEFT" : rollCd > 1800 ? "RIGHT" : pitchCd < -1500 ? "DOWN" : pitchCd > 1500 ? "UP" : "CENTER";
    const targetLeft = direction === "RIGHT" ? 35 : direction === "DOWN" ? 0 : 100;
    const targetRight = direction === "LEFT" ? 35 : direction === "DOWN" ? 0 : 100;
    const smoothLeft = Math.round((telemetry.smoothLeft * 0.82) + (targetLeft * 0.18));
    const smoothRight = Math.round((telemetry.smoothRight * 0.82) + (targetRight * 0.18));
    const mode = direction === "DOWN" ? "MUTED" : "ACTIVE";
    const busMv = Math.round(4960 + Math.sin(t * 0.45) * 12);
    const currentCma = Math.round((Math.sin(t * 1.7) * 0.35 - 0.12) * 100);
    const powerMw = Math.max(0, Math.round((busMv / 1000) * (currentCma / 100)));
    const audioRail = direction === "DOWN" ? 0 : 1;
    const line =
      `TEL,${Math.round(t * 1000)},${mode},00000000,50,20,${audioRail},` +
      `${rollCd},${pitchCd},${direction},${targetLeft},${targetRight},` +
      `${smoothLeft},${smoothRight},${busMv},0,${currentCma},${powerMw},${audioRail}`;
    handleLine(line);
  }, 50);
}

function stopDemo() {
  if (!demoTimer) return;

  window.clearInterval(demoTimer);
  demoTimer = undefined;
  elements.demoButton.textContent = "Demo";
  setStatus(port ? `已連線，baud ${BAUD_RATE}` : "未連線");
}

elements.connectButton.addEventListener("click", connectSerial);
elements.calibrateButton.addEventListener("click", calibrateAttitude);
elements.demoButton.addEventListener("click", toggleDemo);
elements.invertX.addEventListener("change", updateAxisDirection);
elements.invertY.addEventListener("change", updateAxisDirection);
elements.invertZ.addEventListener("change", updateAxisDirection);
window.addEventListener("resize", drawPowerScope);

syncAxisControls();
updateView(telemetry, "");
