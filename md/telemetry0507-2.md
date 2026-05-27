# UART Telemetry Format

This document defines the UART line format for external 3D simulators.

Legacy simulator clients should parse only lines that start with `SIM,` and
ignore all other boot, debug, and demo event logs.

New simulator clients may prefer `SIM3,`, which carries the same data plus the
current firmware system mode, fault flags, and power policy.

Power measurement lines are also emitted during INA219 bring-up and demo runs.
Simulator clients that only need pose/audio visualization may ignore `PWR,`,
`[PWR]`, and `[DEMO_SUMMARY]` lines. Dashboard clients may parse them to show
audio rail current and low-power acceptance status.

## Header Line

On boot, firmware prints a human-readable format hint:

```text
[SIMFMT] SIM,ms,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct
[SIMFMT] SIM2,ms,mode,fault_hex,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct
[SIMFMT] SIM3,ms,mode,fault_hex,imu_hz,tel_hz,audio_en,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct
```

This line is for humans. Simulator clients may ignore it.

## Legacy Data Line

```text
SIM,<ms>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
```

Example:

```text
SIM,1234,-1850,420,CENTER,50,50,50,50
SIM,1280,-3020,310,LEFT,50,15,50,43
SIM,1520,120,-3810,DOWN,0,0,70,70
```

## Mode-Aware Data Line

```text
SIM2,<ms>,<mode>,<fault_hex>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
```

Example:

```text
SIM2,1234,ACTIVE,00000000,-1850,420,CENTER,50,50,50,50
SIM2,1280,MUTED,00000000,-3020,310,LEFT,0,0,45,45
SIM2,1520,LOW_POWER,00000000,120,-3810,DOWN,0,0,70,70
```

## Power-Policy Data Line

```text
SIM3,<ms>,<mode>,<fault_hex>,<imu_hz>,<tel_hz>,<audio_en>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
```

Example:

```text
SIM3,1234,ACTIVE,00000000,50,20,1,-1850,420,CENTER,50,50,50,50
SIM3,8000,LOW_POWER,00000000,10,2,0,120,-3810,DOWN,0,0,0,0
SIM3,9200,FAULT,00000001,10,2,0,0,0,CENTER,0,0,0,0
```

## Power Sample Line

INA219 audio-rail samples use a CSV-style line without brackets:

```text
PWR,mode=<mode>,bus=<bus_v>,current=<current_ma>,power=<power_mw>,avg=<avg_ma>,min=<min_ma>,max=<max_ma>,n=<sample_count>
```

Example:

```text
PWR,mode=ACTIVE,bus=4.972,current=17.20,power=86.0,avg=16.80,min=15.90,max=18.30,n=16
PWR,mode=LOW_POWER,bus=4.972,current=-0.30,power=0.0,avg=-0.25,min=-0.50,max=0.10,n=16
```

These values are sampled every 100 ms. The `avg`, `min`, and `max` fields are
the firmware's 16-sample moving window for the current system mode.

## Power Report Lines

Power report summary lines are human-readable event logs. They start with
`[PWR]` and are printed after LOW_POWER has enough samples for rail-cutoff
acceptance.

```text
[PWR] <state> avg=<avg_ma>mA min=<min_ma>mA max=<max_ma>mA n=<sample_count> duration=<duration_ms>ms
[PWR] AUDIO_RAIL_CUTOFF=<PASS|FAIL|UNKNOWN>
```

Example:

```text
[PWR] ACTIVE avg=18.0mA min=17.6mA max=18.5mA n=120 duration=11900ms
[PWR] HEAD_DOWN avg=5.6mA min=5.4mA max=5.9mA n=80 duration=7900ms
[PWR] LOW_POWER avg=-0.3mA min=-0.5mA max=0.1mA n=40 duration=3900ms
[PWR] AUDIO_RAIL_CUTOFF=PASS
```

States:

```text
ACTIVE
HEAD_DOWN
MUTED
LOW_POWER
DIAGNOSTIC
FAULT
```

Acceptance rule:

```text
LOW_POWER avg < 1.0 mA  -> AUDIO_RAIL_CUTOFF=PASS
LOW_POWER avg >= 1.0 mA -> AUDIO_RAIL_CUTOFF=FAIL
```

A small negative LOW_POWER current near zero is expected at low current because
of INA219 shunt offset and measurement resolution.

## Demo Summary Block

Diagnostic mode prints a short demo summary block near the end of the diagnostic
flow:

```text
[DEMO_SUMMARY]
HEAD_TRACKING=<PASS|FAIL>
HEAD_DOWN_MUTE=<PASS|FAIL|UNKNOWN>
LOW_POWER_AUDIO_RAIL_CUTOFF=<PASS|FAIL|UNKNOWN>
ACTIVE_20_CURRENT=<avg_ma>mA
HEAD_DOWN_CURRENT=<avg_ma>mA
LOW_POWER_CURRENT=<avg_ma>mA
RESULT=<PASS|FAIL>
IMU=<OK|FAIL>
I2S_LEFT=<OK|FAIL>
I2S_RIGHT=<OK|FAIL>
INA219=<OK|FAIL>
```

Example:

```text
[DEMO_SUMMARY]
HEAD_TRACKING=PASS
HEAD_DOWN_MUTE=PASS
LOW_POWER_AUDIO_RAIL_CUTOFF=PASS
ACTIVE_20_CURRENT=18.0mA
HEAD_DOWN_CURRENT=5.6mA
LOW_POWER_CURRENT=-0.3mA
RESULT=PASS
IMU=OK
I2S_LEFT=OK
I2S_RIGHT=OK
INA219=OK
```

If no LOW_POWER sample has been collected yet, the firmware prints:

```text
LOW_POWER_AUDIO_RAIL_CUTOFF=UNKNOWN
LOW_POWER_CURRENT=NA
```

## Fields

```text
ms             HAL tick in milliseconds
mode           ACTIVE, MUTED, LOW_POWER, DIAGNOSTIC, or FAULT; SIM2/SIM3 only
fault_hex      fault bitmask in hexadecimal; SIM2/SIM3 only
imu_hz         current power-policy IMU update rate; SIM3 only
tel_hz         current power-policy telemetry update rate; SIM3 only
audio_en       1 when policy allows audio output, 0 when force-muted; SIM3 only
roll_cd        filtered roll angle in centi-degrees
pitch_cd       filtered pitch angle in centi-degrees
head           CENTER, LEFT, RIGHT, DOWN, or UP
target_l_pct   target left volume after master volume scaling, 0 to 100
target_r_pct   target right volume after master volume scaling, 0 to 100
smooth_l_pct   smoothed left volume sent to audio_tone, 0 to 100
smooth_r_pct   smoothed right volume sent to audio_tone, 0 to 100
bus            INA219 bus voltage in volts; PWR only
current        latest INA219 current in mA; PWR only
power          latest INA219 power in mW; PWR only
avg            moving-average current in mA; PWR only
min            minimum current in mA; PWR/[PWR] only
max            maximum current in mA; PWR/[PWR] only
n              sample count; PWR/[PWR] only
duration       measured state duration in ms; [PWR] only
```

Volume fields report actual normalized gain. In the current bench-test build,
the user-facing 100% master volume is capped to 50 actual percent, while the
20% setting still reports as 20.

Convert angle fields to degrees with:

```text
degrees = centi_degrees / 100.0
```

Convert volume fields to normalized gain with:

```text
gain = percent / 100.0
```

## Update Rate

Telemetry is emitted at a throttled simulator update rate:

```text
ACTIVE / DIAGNOSTIC: 50 ms / 20 Hz
MUTED:               100 ms / 10 Hz
LOW_POWER / FAULT:   500 ms / 2 Hz
```

## Suggested 3D Simulator Mapping

```text
roll_deg  = roll_cd / 100.0
pitch_deg = pitch_cd / 100.0

board roll  <- roll_deg
board pitch <- pitch_deg

left speaker visual level  <- smooth_l_pct / 100.0
right speaker visual level <- smooth_r_pct / 100.0
```

`head` can drive labels or state colors:

```text
CENTER -> neutral
LEFT   -> left highlight
RIGHT  -> right highlight
DOWN   -> muted / dimmed
UP     -> upward highlight
```
