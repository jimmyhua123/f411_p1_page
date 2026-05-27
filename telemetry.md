# UART Telemetry Format

The current simulator telemetry contract is maintained in
[md/telemetry.md](./md/telemetry.md).

The web simulator supports both:

```text
SIM,<ms>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
SIM2,<ms>,<mode>,<roll_cd>,<pitch_cd>,<head>,<target_l_pct>,<target_r_pct>,<smooth_l_pct>,<smooth_r_pct>
```

New firmware should emit `SIM2,` when possible because it includes the system
mode: `ACTIVE`, `MUTED`, `LOW_POWER`, or `DIAGNOSTIC`.
