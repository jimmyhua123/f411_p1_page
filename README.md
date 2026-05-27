# MPU Attitude Simulator

Browser-based 3D viewer for the STM32F411 head-tracking audio prototype. It
uses Web Serial to read UART telemetry, then displays board roll/pitch and the
left/right audio levels used by the firmware.

## Run

```powershell
.\start-server.ps1
```

Open Chrome or Edge at `http://localhost:8000`, then select the USB-UART COM
port with the serial connect button.

## Telemetry

The simulator ignores boot/debug logs and parses only simulator telemetry:

```text
SIM,<ms>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
SIM2,<ms>,<mode>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
```

`SIM2,` is preferred because it includes firmware mode.

Current format docs:

- [md/telemetry.md](./md/telemetry.md)
- [md/README.md](./md/README.md)

## Example

```text
SIM2,1234,ACTIVE,-1850,420,CENTER,50,50,50,50
SIM2,1280,MUTED,-3020,310,LEFT,0,0,45,45
SIM2,1520,LOW_POWER,120,-3810,DOWN,0,0,70,70
```

Angle conversion:

```text
roll_deg = roll_cd / 100.0
pitch_deg = pitch_cd / 100.0
```
