import assert from "node:assert/strict";
import { isDemoSummaryComplete, parseDemoSummaryEntry, parseTelLine } from "./telemetry-utils.js";

assert.deepEqual(parseDemoSummaryEntry("LOW_POWER_CURRENT=-0.3mA"), {
  key: "LOW_POWER_CURRENT",
  value: "-0.3mA",
});

assert.equal(parseDemoSummaryEntry("[DEMO_SUMMARY]"), null);
assert.equal(parseDemoSummaryEntry("PWR,mode=ACTIVE,bus=4.972"), null);
assert.equal(parseDemoSummaryEntry("OTHER=PASS"), null);

const summary = {
  RESULT: "PASS",
  HEAD_TRACKING: "PASS",
  HEAD_DOWN_MUTE: "PASS",
  LOW_POWER_AUDIO_RAIL_CUTOFF: "PASS",
  ACTIVE_20_CURRENT: "18.0mA",
  HEAD_DOWN_CURRENT: "5.6mA",
  LOW_POWER_CURRENT: "-0.3mA",
  IMU: "OK",
  I2S_LEFT: "OK",
  I2S_RIGHT: "OK",
  INA219: "OK",
};

assert.equal(isDemoSummaryComplete(summary), true);
delete summary.INA219;
assert.equal(isDemoSummaryComplete(summary), false);

assert.deepEqual(
  parseTelLine("TEL,1234,ACTIVE,00000000,50,10,1,123,-456,CENTER,100,80,90,70,4960,-12,-43,2,1"),
  {
    ms: 1234,
    mode: "ACTIVE",
    faultHex: "00000000",
    imuHz: 50,
    telemetryHz: 10,
    audioEnabled: 1,
    rollCd: 123,
    pitchCd: -456,
    head: "CENTER",
    targetLeft: 100,
    targetRight: 80,
    smoothLeft: 90,
    smoothRight: 70,
    busMv: 4960,
    shuntUv: -12,
    currentCma: -43,
    powerMw: 2,
    audioRail: 1,
    busV: 4.96,
    currentMa: -0.43,
    audioRailOn: true,
  },
);
assert.equal(parseTelLine("SIM,1,2"), null);
