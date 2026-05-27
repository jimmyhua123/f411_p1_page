export const DEMO_SUMMARY_FIELDS = [
  "RESULT",
  "HEAD_TRACKING",
  "HEAD_DOWN_MUTE",
  "LOW_POWER_AUDIO_RAIL_CUTOFF",
  "ACTIVE_20_CURRENT",
  "HEAD_DOWN_CURRENT",
  "LOW_POWER_CURRENT",
  "IMU",
  "I2S_LEFT",
  "I2S_RIGHT",
  "INA219",
];

export function parseDemoSummaryEntry(line) {
  const match = String(line).trim().match(/^([A-Z0-9_]+)=(.+)$/);
  if (!match) return null;

  const key = match[1];
  if (!DEMO_SUMMARY_FIELDS.includes(key)) return null;

  return {
    key,
    value: match[2].trim(),
  };
}

export function isDemoSummaryComplete(summary) {
  return DEMO_SUMMARY_FIELDS.every((key) => Object.hasOwn(summary, key));
}

export function parseTelLine(line) {
  const fields = String(line).trim().split(",");
  if (fields.length !== 19 || fields[0] !== "TEL") return null;

  const [
    ,
    ms,
    mode,
    faultHex,
    imuHz,
    telemetryHz,
    audioEnabled,
    rollCd,
    pitchCd,
    head,
    targetLeftPct,
    targetRightPct,
    smoothLeftPct,
    smoothRightPct,
    busMv,
    shuntUv,
    currentCma,
    powerMw,
    audioRail,
  ] = fields;

  const parsed = {
    ms: Number(ms),
    imuHz: Number(imuHz),
    telemetryHz: Number(telemetryHz),
    audioEnabled: Number(audioEnabled),
    rollCd: Number(rollCd),
    pitchCd: Number(pitchCd),
    targetLeft: Number(targetLeftPct),
    targetRight: Number(targetRightPct),
    smoothLeft: Number(smoothLeftPct),
    smoothRight: Number(smoothRightPct),
    busMv: Number(busMv),
    shuntUv: Number(shuntUv),
    currentCma: Number(currentCma),
    powerMw: Number(powerMw),
    audioRail: Number(audioRail),
  };

  if (Object.values(parsed).some((value) => !Number.isFinite(value))) return null;

  return {
    ...parsed,
    mode: mode.trim().toUpperCase(),
    faultHex: faultHex.trim().toUpperCase(),
    head: head.trim().toUpperCase(),
    busV: parsed.busMv / 1000,
    currentMa: parsed.currentCma / 100,
    audioRailOn: parsed.audioRail !== 0,
  };
}
