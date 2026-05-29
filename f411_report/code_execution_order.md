# Code Execution Order 學習導覽

這份文件用「實際執行順序」整理整個 project 的 code。建議你照這個順序讀，先掌握 firmware 從上電到 main loop 的骨架，再回頭看各個協議和模組細節。

## 0. 先建立整體觀念

這個 project 是 STM32F411 head-tracking audio prototype。

核心資料流是：

```text
MPU6500 I2C raw data
  -> roll / pitch 計算
  -> low-pass filter
  -> head state machine
  -> audio control / mode policy
  -> I2S DMA audio output
  -> UART telemetry + MicroSD CSV log
```

最重要的兩個入口檔案：

```text
Core/Src/main.c
  CubeMX / HAL 初始化入口。

Core/Src/app_main.c
  真正 application 邏輯。
```

讀 code 時先不要從所有 driver 開始追，會很容易迷路。先把 `main.c -> App_Init() -> App_MainLoop()` 讀懂，後面每個模組就會自己接上。

## 1. Reset 後第一層：startup 到 main

### 1.1 startup_stm32f411xe.s

上電或 reset 後，CPU 先從 startup code 開始，設定 stack、vector table，最後呼叫 C runtime，再進入 `main()`。

你可以先知道它存在即可，不需要一開始細讀 assembly。

### 1.2 Core/Src/main.c

重點位置：

```text
Core/Src/main.c:72   int main(void)
Core/Src/main.c:108  App_Init()
Core/Src/main.c:119  App_MainLoop()
```

執行順序：

```text
HAL_Init()
  -> 初始化 HAL、SysTick、NVIC 基礎狀態

SystemClock_Config()
  -> 設定 STM32 system clock

PeriphCommonClock_Config()
  -> 設定 I2S peripheral clock

MX_GPIO_Init()
MX_DMA_Init()
MX_I2C1_Init()
MX_USART2_UART_Init()
MX_I2S2_Init()
MX_I2S3_Init()
MX_SPI1_Init()
MX_FATFS_Init()
  -> CubeMX 產生的 peripheral 初始化

App_Init()
  -> 進入你自己的 application 初始化

while (1)
{
  App_MainLoop();
}
  -> 永遠重複跑 application 主迴圈
```

這裡的重點是：`main.c` 幾乎不放商業邏輯，只負責把硬體初始化好，然後把控制權交給 `app_main.c`。

## 2. App_Init：開機初始化順序

檔案：

```text
Core/Src/app_main.c:118  App_Init(void)
```

`App_Init()` 是開機後只跑一次的初始化流程。

實際順序：

```text
LOG_Printf boot logs
  -> 透過 USART2 印出開機訊息

StatusLed_Init()
  -> PC13 / PC14 / PC15 LED 自測

AudioPower_Init()
  -> PB8 控制 AO3401 audio rail，預設 audio power on

AttitudeFilter_Init()
HeadSM_Init()
SystemMode_Init()
FaultManager_Init()
PowerReport_Init()
  -> 初始化姿態濾波、頭部狀態、系統模式、錯誤管理、電流報告

DataLogger_Init()
  -> FatFS mount
  -> 開第一個可用 LOGnnn.CSV
  -> 寫入 CSV header
  -> 失敗時設定 FAULT_SD_LOG，但這個 fault 是 non-fatal

ButtonEvent_Init()
  -> 初始化 PA0 button debounce / press duration state

AudioControl_Init()
AudioControl_SetMode()
AudioVolumeSmoother_Init()
App_UpdateVolumeTarget()
  -> 初始化音量控制目標和 smoothing 狀態

AudioTone_Init(&hi2s2, &hi2s3)
AudioTone_Start()
  -> 建立 440 Hz tone buffer
  -> 啟動 I2S2 / I2S3 DMA circular transmit

SimTelemetry_PrintFormat()
  -> 印出 TEL / SIM format hint

MPU6500_Init()
  -> I2C1 喚醒 MPU6500
  -> 讀 WHO_AM_I，期望 0x70
  -> 失敗時設定 FAULT_IMU_LOST

INA219_Init()
  -> I2C1 初始化 INA219
  -> 設定 32V / 2A profile
  -> 成功後允許 power monitor 每 100 ms sample

App_ForceFaultModeIfNeeded()
StatusLed_Update()
  -> 如果有 fatal fault，進入 FAULT mode
```

### App_Init 建議閱讀順序

照這樣讀會最順：

```text
1. Core/Src/app_main.c          App_Init()
2. Core/Src/status_led.c        StatusLed_Init()
3. Core/Src/audio_power.c       AudioPower_Init()
4. Core/Src/system_mode.c       SystemMode_Init()
5. Core/Src/fault_manager.c     FaultManager_Init()
6. Core/Src/data_logger.c       DataLogger_Init()
7. Core/Src/button_event.c      ButtonEvent_Init()
8. Core/Src/audio_tone.c        AudioTone_Init() / AudioTone_Start()
9. Core/Src/imu_mpu6500.c       MPU6500_Init()
10. Core/Src/ina219_power.c     INA219_Init()
```

## 3. App_MainLoop：每圈主迴圈順序

檔案：

```text
Core/Src/app_main.c:206  App_MainLoop(void)
```

`App_MainLoop()` 是整個 firmware 的心臟。它不是 RTOS task，而是在 `while(1)` 裡一直被呼叫，用 `HAL_GetTick()` 和時間差做簡單 scheduler。

每一圈都先做「不一定依賴 IMU 更新率」的工作：

```text
now = HAL_GetTick()

App_UpdateButtonEvents(now)
  -> 讀 PA0 button release event
  -> short press: 切換 master volume 20% / 100%
  -> long 1s: ACTIVE <-> MUTED
  -> LOW_POWER 中按鍵會回 ACTIVE

App_UpdateDiagnosticHold(now)
  -> PA0 按住超過 3s，不等 release，直接進 DIAGNOSTIC

App_UpdateFaults(now)
  -> 記錄 button stuck
  -> 記錄 I2S error
  -> fault 狀態下長按可 clear fault

App_ForceFaultModeIfNeeded(now)
  -> 如果有 fatal fault，切到 SYS_MODE_FAULT

App_UpdateAutoLowPower(now)
  -> MUTED 維持 5s 後自動進 LOW_POWER

App_UpdatePowerMonitor(now)
  -> INA219 每 100 ms sample 一次
  -> 更新 bus/current/power/latest stats
  -> 記錄 PowerReport

App_UpdateDataLogger(now)
  -> 建立 snapshot
  -> ACTIVE 每 200 ms 寫 CSV
  -> MUTED 每 500 ms 寫 CSV
  -> LOW_POWER 只寫 enter/exit event

FaultManager_UpdateLog(&fault_manager, now)
  -> fault log 節流輸出

StatusLed_Update(...)
  -> 依 mode / fault 更新 LED

App_GetPowerPolicy(&policy)
  -> 依目前 mode 決定 IMU period、telemetry period、audio_enabled
```

接著才判斷 IMU 更新時間是否到了：

```text
if ((now - last_imu_tick) < policy.imu_period_ms)
{
  return;
}
last_imu_tick += policy.imu_period_ms;
```

也就是說：

```text
ACTIVE / MUTED / DIAGNOSTIC: IMU 20 ms, 50 Hz
LOW_POWER / FAULT:           IMU 100 ms, 10 Hz
```

## 4. IMU 到姿態角的執行順序

當 IMU period 到了之後：

```text
MPU6500_ReadRaw(&raw)
  -> I2C1 從 MPU6500 0x3B 開始讀 14 bytes
  -> 取出 ax, ay, az, gx, gy, gz

FaultManager_RecordImuRead()
  -> 成功時清除連續失敗計數
  -> 連續失敗 >= 5 次時設 FAULT_IMU_LOST

Attitude_UpdateAccelOnly(&raw, &attitude)
  -> 用 accelerometer 計算 roll / pitch

AttitudeFilter_Update(&attitude_filter, &raw_angle, &filtered_angle)
  -> alpha = 0.15 low-pass filter
```

對應檔案：

```text
Core/Src/imu_mpu6500.c
  MPU6500_Init()
  MPU6500_ReadRaw()

Core/Src/attitude.c
  Attitude_UpdateAccelOnly()

Core/Src/attitude_filter.c
  AttitudeFilter_Update()
```

資料格式：

```text
imu_raw_t
  ax, ay, az, gx, gy, gz

attitude_t / attitude_angle_t
  roll_deg
  pitch_deg
```

目前姿態是 accel-only，gyro 有讀出來但還沒有做 yaw / fusion。

## 5. 姿態角到 head state

接著主迴圈會做：

```text
App_UpdateLowPowerMotionWake(&filtered_angle)
  -> LOW_POWER 中，如果 roll 或 pitch 跟 reference 差超過 10 deg，就 wake 回 ACTIVE

App_GetPowerPolicy(&policy)
  -> 因為 wake 可能改變 mode，所以重新拿一次 policy

HeadSM_Update(&head_sm, filtered_angle.roll_deg, filtered_angle.pitch_deg)
  -> 把 roll / pitch 分類成 CENTER / LEFT / RIGHT / DOWN / UP
```

對應檔案：

```text
Core/Src/head_state_machine.c
```

判斷順序：

```text
先看 pitch:
  pitch < -35 deg -> HEAD_DOWN
  pitch >  35 deg -> HEAD_UP

再看 roll:
  roll < -25 deg -> HEAD_LEFT
  roll >  25 deg -> HEAD_RIGHT

不符合就是 HEAD_CENTER
```

有 hysteresis，所以離開狀態的門檻比較寬鬆：

```text
LEFT  exit roll > -18 deg
RIGHT exit roll <  18 deg
DOWN  exit pitch > -25 deg
UP    exit pitch <  25 deg
```

## 6. head state 到 audio target

主迴圈接著執行：

```text
AudioControl_Update(head_state, roll_deg, pitch_deg)
  -> 如果 head state 改變，印 [HEAD] log
  -> HEAD_DOWN 時 base volume = 0 / 0
  -> 其他狀態依 roll 做左右聲道 panning
  -> MUTED / LOW_POWER / FAULT mode 強制 target volume = 0 / 0

App_UpdateAudioOutput()
  -> 根據 fault / policy 決定 mute
  -> 更新 volume smoother
  -> 把 smooth volume 寫進 AudioTone buffer
```

對應檔案：

```text
Core/Src/audio_control.c
  AudioControl_Update()

Core/Src/audio_volume_smoother.c
  AudioVolumeSmoother_SetTarget()
  AudioVolumeSmoother_Update()

Core/Src/audio_tone.c
  AudioTone_SetMute()
  AudioTone_SetStereoVolume()
```

音訊資料路徑：

```text
roll / head_state
  -> AudioControl target volume
  -> master_volume scale
  -> AudioVolumeSmoother smooth volume
  -> AudioTone_FillBuffer()
  -> I2S2 DMA left buffer
  -> I2S3 DMA right buffer
```

roll panning 規則：

```text
roll =   0 deg -> L=1.00 R=1.00
roll = -30 deg -> L=1.00 R=0.30
roll = +30 deg -> L=0.30 R=1.00

HEAD_DOWN -> L=0.00 R=0.00
```

## 7. mode / button / power policy 的協議邏輯

這個 project 裡「協議」比較像是 firmware 內部行為規則和 UART/CSV 資料格式。mode 邏輯主要由 PA0 button 觸發。

### 7.1 Button event

對應檔案：

```text
Core/Src/button_event.c
```

規則：

```text
debounce: 50 ms
short press: release 時 duration < 1000 ms
long 1s:     1000 ms <= duration < 3000 ms
long 3s:     duration >= 3000 ms
```

另外 `App_UpdateDiagnosticHold()` 會在按住滿 3000 ms 的當下直接進 DIAGNOSTIC，不必等 release。

### 7.2 System mode

對應檔案：

```text
Core/Src/system_mode.c
```

mode：

```text
SYS_MODE_ACTIVE
SYS_MODE_MUTED
SYS_MODE_LOW_POWER
SYS_MODE_DIAGNOSTIC
SYS_MODE_FAULT
```

button 對 mode 的影響：

```text
short press:
  ACTIVE / MUTED 中切 master volume
  LOW_POWER 中回 ACTIVE

long 1s:
  ACTIVE -> MUTED
  MUTED / LOW_POWER -> ACTIVE

long 3s:
  -> DIAGNOSTIC
```

### 7.3 App_ApplyMode

檔案：

```text
Core/Src/app_main.c:776  App_ApplyMode()
```

所有 mode change 都應該經過這裡，因為這裡會同步更新：

```text
UART [MODE] log
system_mode_enter_tick
LOW_POWER audio rail off / wake audio rail on
AudioControl_SetMode()
AudioTone_SetMute()
low_power reference angle
StatusLed_Update()
PowerPolicy log
volume target
DataLogger_LogModeEvent()
DIAGNOSTIC flow
```

這是理解整個 project 行為的關鍵函式之一。

## 8. INA219 power monitor 執行順序

開機：

```text
INA219_Init()
  -> write config
  -> write calibration
  -> read back config
```

主迴圈每 100 ms：

```text
App_UpdatePowerMonitor()
  -> INA219_ReadSample()
  -> latest_bus_mv / latest_current_ma_x100 / latest_power_mw
  -> App_UpdatePowerMonitorStats()
  -> PowerReport_Record()
```

對應檔案：

```text
Core/Src/ina219_power.c
  I2C register read/write

Core/Src/power_report.c
  ACTIVE / HEAD_DOWN / MUTED / LOW_POWER / DIAGNOSTIC / FAULT current summary
```

PowerReport 的分類方式：

```text
mode == ACTIVE 且 head == DOWN -> HEAD_DOWN
mode == ACTIVE                -> ACTIVE
mode == MUTED                 -> MUTED
mode == LOW_POWER             -> LOW_POWER
mode == DIAGNOSTIC            -> DIAGNOSTIC
mode == FAULT                 -> FAULT
```

LOW_POWER 有至少 8 筆 sample 後，會印 power summary，並判斷：

```text
LOW_POWER avg < 1.0 mA -> AUDIO_RAIL_CUTOFF=PASS
```

## 9. UART telemetry 執行順序

開機時：

```text
SimTelemetry_PrintFormat()
```

主迴圈中 IMU 成功更新後，如果 telemetry period 到了：

```text
App_PrintCombinedTelemetry()
  -> 印 TEL line
```

目前 `app_main.c` 的設定：

```text
APP_ENABLE_COMBINED_TELEMETRY = 1
APP_ENABLE_SIM_TELEMETRY      = 0
```

所以目前主要輸出是 `TEL,`，而不是 legacy `SIM,` / `SIM2,` / `SIM3,`。

對應檔案：

```text
Core/Src/app_main.c
  App_PrintCombinedTelemetry()

Core/Src/sim_telemetry.c
  SimTelemetry_PrintFormat()
  SimTelemetry_Print()
```

TEL line 欄位：

```text
TEL,ms,mode,fault_hex,imu_hz,tel_hz,audio_en,
    roll_cd,pitch_cd,head,
    target_l_pct,target_r_pct,
    smooth_l_pct,smooth_r_pct,
    bus_mv,shunt_uv,current_cma,power_mw,audio_rail
```

如果之後要接 PC simulator，優先看：

```text
telemetry.md
Core/Src/sim_telemetry.c
Core/Src/app_main.c:623  App_PrintCombinedTelemetry()
```

## 10. MicroSD CSV logger 執行順序

開機：

```text
DataLogger_Init()
  -> f_mount()
  -> DataLogger_OpenNextFile()
  -> f_open(LOG000.CSV / LOG001.CSV / ...)
  -> write CSV header
```

主迴圈：

```text
App_UpdateDataLogger(now)
  -> App_BuildLogSnapshot()
  -> DataLogger_Process()
```

`DataLogger_Process()` 內部：

```text
如果 fault_flags 新增:
  -> DataLogger_LogFault()

如果 mode == ACTIVE:
  -> 每 200 ms 寫一列

如果 mode == MUTED:
  -> 每 500 ms 寫一列

其他 mode:
  -> 不做週期性寫入
```

mode event：

```text
App_ApplyMode()
  -> DataLogger_LogModeEvent()
  -> 只有 LOW_POWER enter / exit 會額外寫 event row
```

diagnostic：

```text
App_RunDiagnostic()
  -> DataLogger_LogDiagnosticSummary()
```

對應檔案：

```text
Core/Src/data_logger.c
FATFS/Target/user_diskio.c
Middlewares/Third_Party/FatFs/src/ff.c
```

CSV header：

```csv
seq,time_ms,mode,head,roll,pitch,lvol,rvol,bus_v,current_ma,audio_rail,fault
```

## 11. fault flow

主要檔案：

```text
Core/Src/fault_manager.c
Core/Src/app_main.c
```

fault 來源：

```text
MPU6500 init fail or read fail >= 5 次
I2S left/right error
button pressed >= 10 seconds
SD logger error
```

注意：

```text
FAULT_SD_LOG 是 non-fatal。
App_GetFatalFaultFlags() 會把 FAULT_SD_LOG 排除。
```

fatal fault flow：

```text
FaultManager_SetFlags()
  -> App_ForceFaultModeIfNeeded()
  -> DataLogger_LogFault()
  -> SystemMode_Set(SYS_MODE_FAULT)
  -> App_ApplyMode(..., SYS_MODE_FAULT)
  -> audio forced mute
  -> red LED on
```

I2S HAL callback：

```text
Core/Src/app_main.c:935  HAL_I2S_ErrorCallback()
```

這個 callback 由 HAL driver 在 I2S error 時呼叫，會設定：

```text
FAULT_I2S_LEFT
FAULT_I2S_RIGHT
```

## 12. Diagnostic flow

觸發：

```text
PA0 hold >= 3000 ms
  -> App_UpdateDiagnosticHold()
  -> SYS_MODE_DIAGNOSTIC
  -> App_ApplyMode()
  -> App_RunDiagnostic()
```

`App_RunDiagnostic()` 順序：

```text
print [DIAG] start
left beep
right beep
stereo beep
read MPU6500 WHO_AM_I
check I2S left/right error
read button state
PowerReport_PrintDemoSummary()
DataLogger_LogDiagnosticSummary()
print [DIAG] done
return to ACTIVE
```

對應位置：

```text
Core/Src/app_main.c:833  App_RunDiagnostic()
```

## 13. 建議學習路線

### 第一輪：只看主流程

目標是知道 code 怎麼跑，不要被細節卡住。

```text
1. Core/Src/main.c
2. Core/Src/app_main.c
   - App_Init()
   - App_MainLoop()
   - App_ApplyMode()
```

讀完你應該能回答：

```text
上電後初始化了哪些 peripheral？
App_Init 做了哪些模組初始化？
App_MainLoop 每圈先處理哪些事情？
IMU 為什麼不是每圈都讀？
mode change 為什麼要走 App_ApplyMode？
```

### 第二輪：看 head tracking

```text
1. Core/Src/imu_mpu6500.c
2. Core/Src/attitude.c
3. Core/Src/attitude_filter.c
4. Core/Src/head_state_machine.c
```

讀完你應該能畫出：

```text
I2C raw accel -> roll/pitch -> filter -> CENTER/LEFT/RIGHT/DOWN/UP
```

### 第三輪：看 audio

```text
1. Core/Src/audio_control.c
2. Core/Src/audio_volume_smoother.c
3. Core/Src/audio_tone.c
4. Core/Src/audio_power.c
```

讀完你應該能回答：

```text
HEAD_DOWN 怎麼 mute？
roll 怎麼改左右聲道？
smooth volume 什麼時候更新？
I2S DMA buffer 是在哪裡填的？
LOW_POWER 怎麼關 audio rail？
```

### 第四輪：看 mode / fault / power

```text
1. Core/Src/button_event.c
2. Core/Src/system_mode.c
3. Core/Src/power_policy.c
4. Core/Src/fault_manager.c
5. Core/Src/ina219_power.c
6. Core/Src/power_report.c
```

讀完你應該能回答：

```text
PA0 短按和長按分別做什麼？
ACTIVE / MUTED / LOW_POWER 差在哪裡？
INA219 資料怎麼變成 PWR / DEMO_SUMMARY？
哪些 fault 會讓系統進 FAULT？
```

### 第五輪：看資料輸出協議

```text
1. telemetry.md
2. Core/Src/sim_telemetry.c
3. Core/Src/app_main.c 的 App_PrintCombinedTelemetry()
4. Core/Src/data_logger.c
5. log/LOG000.CSV
```

讀完你應該能回答：

```text
UART TEL / SIM3 每個欄位代表什麼？
CSV log 何時寫入？
LOW_POWER 為什麼不是一直寫 CSV？
外部 PC tool 應該 parse 哪些 line？
```

## 14. 一張總執行順序圖

```text
Reset
  |
  v
startup_stm32f411xe.s
  |
  v
main()
  |
  +-- HAL_Init()
  +-- SystemClock_Config()
  +-- PeriphCommonClock_Config()
  +-- MX_GPIO_Init()
  +-- MX_DMA_Init()
  +-- MX_I2C1_Init()
  +-- MX_USART2_UART_Init()
  +-- MX_I2S2_Init()
  +-- MX_I2S3_Init()
  +-- MX_SPI1_Init()
  +-- MX_FATFS_Init()
  |
  v
App_Init()
  |
  +-- LED / audio power / filters / mode / fault init
  +-- SD logger init
  +-- button init
  +-- audio tone + I2S DMA start
  +-- MPU6500 init
  +-- INA219 init
  +-- force FAULT if needed
  |
  v
while (1)
  |
  v
App_MainLoop()
  |
  +-- button events
  +-- diagnostic hold
  +-- fault update
  +-- auto low power
  +-- INA219 power monitor
  +-- SD logger process
  +-- fault log
  +-- LED update
  +-- power policy
  |
  +-- if IMU period not reached: return
  |
  +-- MPU6500_ReadRaw()
  +-- Attitude_UpdateAccelOnly()
  +-- AttitudeFilter_Update()
  +-- LOW_POWER motion wake check
  +-- HeadSM_Update()
  +-- AudioControl_Update()
  +-- App_UpdateAudioOutput()
  +-- DataLogger_Process()
  +-- TEL / SIM telemetry if period reached
  |
  v
repeat forever
```

## 15. 讀 code 時最值得先標記的函式

```text
Core/Src/main.c
  main()

Core/Src/app_main.c
  App_Init()
  App_MainLoop()
  App_ApplyMode()
  App_UpdateAudioOutput()
  App_UpdatePowerMonitor()
  App_PrintCombinedTelemetry()
  App_RunDiagnostic()

Core/Src/system_mode.c
  SystemMode_HandleButtonEvent()

Core/Src/power_policy.c
  PowerPolicy_Get()

Core/Src/head_state_machine.c
  HeadSM_Update()

Core/Src/audio_control.c
  AudioControl_Update()

Core/Src/data_logger.c
  DataLogger_Init()
  DataLogger_Process()

Core/Src/ina219_power.c
  INA219_ReadSample()
```

如果你只先讀這些函式，就已經能理解 70% 以上的專案執行邏輯。
