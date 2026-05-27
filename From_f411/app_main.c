#include "app_main.h"
#include "attitude.h"
#include "attitude_filter.h"
#include "audio_control.h"
#include "audio_power.h"
#include "audio_tone.h"
#include "audio_volume_smoother.h"
#include "bsp_uart_log.h"
#include "button_event.h"
#include "data_logger.h"
#include "fault_manager.h"
#include "gpio.h"
#include "head_state_machine.h"
#include "i2s.h"
#include "ina219_power.h"
#include "imu_mpu6500.h"
#include "power_policy.h"
#include "power_report.h"
#include "sim_telemetry.h"
#include "status_led.h"
#include "system_mode.h"

#define MPU6500_WHO_AM_I_VALUE 0x70
#define ATTITUDE_LPF_ALPHA      0.15f
#define MASTER_VOLUME_FULL      0.5f
#define MASTER_VOLUME_LOW       0.2f
#define DIAG_BEEP_VOLUME        0.2f
#define DIAG_BEEP_ON_MS         160U
#define DIAG_BEEP_OFF_MS        120U
#define AUDIO_POWER_WAKE_DELAY_MS 30U
#define AUDIO_POWER_OFF_SETTLE_MS 20U
#define LOW_POWER_ENTRY_DELAY_MS 5000U
#define FAULT_CLEAR_HOLD_MS     3000U
#define LOW_POWER_WAKE_DELTA_DEG 10.0f
#define POWER_MONITOR_PERIOD_MS 100U
#define POWER_MONITOR_AVG_WINDOW 16U
#define APP_ENABLE_POWER_TELEMETRY_LOG 0U
#define APP_ENABLE_COMBINED_TELEMETRY 1U
#define APP_ENABLE_SIM_TELEMETRY 0U

typedef struct
{
  uint32_t bus_mv;
  int32_t current_ma_x100;
  uint32_t power_mw;
  int32_t current_avg_ma_x100;
  int32_t current_min_ma_x100;
  int32_t current_max_ma_x100;
  uint32_t sample_count;
} power_sample_t;

static attitude_filter_t attitude_filter;
static head_sm_t head_sm;
static audio_volume_smoother_t volume_smoother;
static button_event_t volume_button;
static system_mode_t system_mode;
static fault_manager_t fault_manager;
static uint32_t last_imu_tick = 0;
static uint32_t last_sim_telemetry_tick = 0;
static uint32_t last_power_monitor_tick = 0;
static uint32_t system_mode_enter_tick = 0;
static float master_volume = MASTER_VOLUME_LOW;
static float last_filtered_roll_deg = 0.0f;
static float last_filtered_pitch_deg = 0.0f;
static float low_power_reference_roll_deg = 0.0f;
static float low_power_reference_pitch_deg = 0.0f;
static head_state_t current_head_state = HEAD_CENTER;
static uint8_t low_power_reference_valid = 0U;
static uint8_t imu_boot_who_am_i = 0;
static uint8_t fault_clear_hold_consumed = 0U;
static uint8_t diagnostic_hold_consumed = 0U;
static uint8_t power_monitor_ready = 0U;
static SystemMode_t power_monitor_mode = SYS_MODE_ACTIVE;
static int32_t power_monitor_current_window[POWER_MONITOR_AVG_WINDOW];
static uint32_t power_monitor_window_index = 0U;
static uint32_t power_monitor_window_count = 0U;
static int32_t power_monitor_window_sum_ma_x100 = 0L;
static int32_t power_monitor_min_ma_x100 = 0L;
static int32_t power_monitor_max_ma_x100 = 0L;
static uint32_t power_monitor_sample_count = 0U;
static uint32_t latest_bus_mv = 0U;
static int32_t latest_shunt_uv = 0L;
static int32_t latest_current_ma_x100 = 0L;
static uint32_t latest_power_mw = 0U;
static uint8_t data_logger_fault_latched = 0U;

static void App_GetPowerPolicy(PowerPolicy_t *policy);
static uint32_t App_GetFatalFaultFlags(void);
static void App_BuildLogSnapshot(DataLogger_Snapshot_t *snapshot, uint32_t now);
static void App_UpdateDataLogger(uint32_t now);
static void App_CheckDataLoggerFault(void);
static void App_PrintPowerPolicy(SystemMode_t mode);
static void App_UpdateVolumeTarget(void);
static void App_UpdateButtonEvents(uint32_t now);
static void App_UpdateDiagnosticHold(uint32_t now);
static void App_UpdateFaults(uint32_t now);
static void App_UpdateAutoLowPower(uint32_t now);
static void App_UpdatePowerMonitor(uint32_t now);
static void App_ResetPowerMonitorStats(SystemMode_t mode);
static void App_UpdatePowerMonitorStats(const ina219_sample_t *sample, power_sample_t *power_sample);
static void App_PrintPowerSample(SystemMode_t mode, const power_sample_t *sample);
static void App_PrintCombinedTelemetry(uint32_t now,
                                       const PowerPolicy_t *policy,
                                       float roll_deg,
                                       float pitch_deg,
                                       head_state_t head_state);
static void App_PrintFixedSigned(int32_t value_x100);
static void App_PrintFixedUnsigned(uint32_t value_x100);
static void App_ForceFaultModeIfNeeded(uint32_t now);
static void App_UpdateAudioOutput(void);
static void App_UpdateLowPowerMotionWake(const attitude_angle_t *angle);
static void App_ToggleMasterVolume(void);
static void App_ApplyMode(SystemMode_t previous_mode, SystemMode_t next_mode);
static void App_RunDiagnostic(void);
static void App_DiagnosticBeep(float left_volume, float right_volume);
static float App_AbsFloat(float value);

void App_Init(void)
{
  uint8_t who_am_i = 0;
  HAL_StatusTypeDef imu_status;

  LOG_Printf("[BOOT] STM32 Head-Tracking Audio Prototype\r\n");
  LOG_Printf("[PWR] sensor on\r\n");
  LOG_Printf("[PWR] audio on\r\n");
  StatusLed_Init();
  AudioPower_Init();

  AttitudeFilter_Init(&attitude_filter, ATTITUDE_LPF_ALPHA);
  HeadSM_Init(&head_sm);
  SystemMode_Init(&system_mode);
  FaultManager_Init(&fault_manager);
  PowerReport_Init();
  if (DataLogger_Init() == DATA_LOGGER_ERROR)
  {
    FaultManager_SetFlags(&fault_manager, FAULT_SD_LOG);
    data_logger_fault_latched = 1U;
  }
  system_mode_enter_tick = HAL_GetTick();
  ButtonEvent_Init(&volume_button,
                   VOLUME_BUTTON_GPIO_Port,
                   VOLUME_BUTTON_Pin,
                   GPIO_PIN_RESET,
                   HAL_GetTick());
  AudioControl_Init();
  AudioControl_SetMode(SystemMode_Get(&system_mode));
  AudioVolumeSmoother_Init(&volume_smoother);
  StatusLed_Update(SystemMode_Get(&system_mode), FaultManager_GetFlags(&fault_manager), HAL_GetTick());
  App_PrintPowerPolicy(SystemMode_Get(&system_mode));
  App_UpdateVolumeTarget();
  AudioTone_Init(&hi2s2, &hi2s3);
  AudioTone_SetStereoVolume(AudioVolumeSmoother_GetLeft(&volume_smoother),
                            AudioVolumeSmoother_GetRight(&volume_smoother));
  if (AudioTone_Start() == HAL_OK)
  {
    LOG_Printf("[Audio] I2S2/I2S3 DMA started\r\n");
  }
  else
  {
    FaultManager_SetFlags(&fault_manager, FAULT_I2S_LEFT | FAULT_I2S_RIGHT);
    LOG_Printf("[Audio] I2S2/I2S3 DMA start failed\r\n");
  }
  LOG_Printf("[Audio] L state=0x%lX error=0x%lX R state=0x%lX error=0x%lX\r\n",
             (unsigned long)AudioTone_GetLeftState(),
             (unsigned long)AudioTone_GetLeftError(),
             (unsigned long)AudioTone_GetRightState(),
             (unsigned long)AudioTone_GetRightError());
  if ((AudioTone_GetLeftError() != 0U) || (AudioTone_GetRightError() != 0U))
  {
    FaultManager_RecordI2sErrors(&fault_manager,
                                 AudioTone_GetLeftError(),
                                 AudioTone_GetRightError());
  }
  LOG_Printf("[Audio] boot master=20%%\r\n");
  LOG_Printf("[PWR] audio switch=%s\r\n", (AudioPower_IsOn() != 0U) ? "on" : "off");
  if ((APP_ENABLE_SIM_TELEMETRY != 0U) || (APP_ENABLE_COMBINED_TELEMETRY != 0U))
  {
    SimTelemetry_PrintFormat();
  }

  imu_status = MPU6500_Init(&who_am_i);
  imu_boot_who_am_i = who_am_i;
  if ((imu_status != HAL_OK) || (who_am_i != MPU6500_WHO_AM_I_VALUE))
  {
    FaultManager_SetFlags(&fault_manager, FAULT_IMU_LOST);
    LOG_Printf("[IMU] FAIL\r\n");
  }

  if (INA219_Init() == HAL_OK)
  {
    power_monitor_ready = 1U;
    last_power_monitor_tick = HAL_GetTick();
    App_ResetPowerMonitorStats(SystemMode_Get(&system_mode));
    LOG_Printf("[INA219] OK addr=0x40\r\n");
  }
  else
  {
    power_monitor_ready = 0U;
    LOG_Printf("[INA219] FAIL addr=0x40\r\n");
  }

  App_ForceFaultModeIfNeeded(HAL_GetTick());
  StatusLed_Update(SystemMode_Get(&system_mode), FaultManager_GetFlags(&fault_manager), HAL_GetTick());
}

void App_MainLoop(void)
{
  imu_raw_t raw;
  attitude_t attitude;
  attitude_angle_t raw_angle;
  attitude_angle_t filtered_angle;
  head_state_t head_state;
  uint32_t now;
  PowerPolicy_t policy;

  now = HAL_GetTick();
  App_UpdateButtonEvents(now);
  App_UpdateDiagnosticHold(now);
  App_UpdateFaults(now);
  App_ForceFaultModeIfNeeded(now);
  App_UpdateAutoLowPower(now);
  App_UpdatePowerMonitor(now);
  App_UpdateDataLogger(now);
  FaultManager_UpdateLog(&fault_manager, now);
  StatusLed_Update(SystemMode_Get(&system_mode), FaultManager_GetFlags(&fault_manager), now);
  App_GetPowerPolicy(&policy);

  if ((now - last_imu_tick) < policy.imu_period_ms)
  {
    return;
  }
  last_imu_tick += policy.imu_period_ms;

  if (MPU6500_ReadRaw(&raw) == HAL_OK)
  {
    FaultManager_RecordImuRead(&fault_manager, HAL_OK);
    Attitude_UpdateAccelOnly(&raw, &attitude);
    raw_angle.roll_deg = attitude.roll_deg;
    raw_angle.pitch_deg = attitude.pitch_deg;
    AttitudeFilter_Update(&attitude_filter, &raw_angle, &filtered_angle);
    last_filtered_roll_deg = filtered_angle.roll_deg;
    last_filtered_pitch_deg = filtered_angle.pitch_deg;
    App_UpdateLowPowerMotionWake(&filtered_angle);
    App_GetPowerPolicy(&policy);
    head_state = HeadSM_Update(&head_sm, filtered_angle.roll_deg, filtered_angle.pitch_deg);
    current_head_state = head_state;
    (void)AudioControl_Update(head_state, filtered_angle.roll_deg, filtered_angle.pitch_deg);
    App_UpdateAudioOutput();
    App_UpdateDataLogger(now);

    if (((APP_ENABLE_SIM_TELEMETRY != 0U) || (APP_ENABLE_COMBINED_TELEMETRY != 0U)) &&
        ((now - last_sim_telemetry_tick) >= policy.telemetry_period_ms))
    {
      last_sim_telemetry_tick = now;
      if (APP_ENABLE_SIM_TELEMETRY != 0U)
      {
        SimTelemetry_Print(now,
                           SystemMode_Get(&system_mode),
                           FaultManager_GetFlags(&fault_manager),
                           &policy,
                           filtered_angle.roll_deg,
                           filtered_angle.pitch_deg,
                           head_state,
                           AudioControl_GetLeftVolume() * master_volume,
                           AudioControl_GetRightVolume() * master_volume,
                           AudioVolumeSmoother_GetLeft(&volume_smoother),
                           AudioVolumeSmoother_GetRight(&volume_smoother));
      }
      if (APP_ENABLE_COMBINED_TELEMETRY != 0U)
      {
        App_PrintCombinedTelemetry(now,
                                   &policy,
                                   filtered_angle.roll_deg,
                                   filtered_angle.pitch_deg,
                                   head_state);
      }
    }
  }
  else
  {
    FaultManager_RecordImuRead(&fault_manager, HAL_ERROR);
    App_ForceFaultModeIfNeeded(now);
    App_UpdateAudioOutput();
  }
}

static void App_UpdateVolumeTarget(void)
{
  PowerPolicy_t policy;

  App_GetPowerPolicy(&policy);
  if ((App_GetFatalFaultFlags() != FAULT_NONE) ||
      (policy.audio_enabled == 0U))
  {
    AudioVolumeSmoother_SetTarget(&volume_smoother, 0.0f, 0.0f);
    return;
  }

  AudioVolumeSmoother_SetTarget(&volume_smoother,
                                AudioControl_GetLeftVolume() * master_volume,
                                AudioControl_GetRightVolume() * master_volume);
}

static void App_UpdateButtonEvents(uint32_t now)
{
  ButtonEvent_t event;
  SystemMode_t previous_mode;
  SystemMode_t next_mode;

  event = ButtonEvent_Update(&volume_button, now);
  if (event == BTN_EVENT_NONE)
  {
    return;
  }

  if (diagnostic_hold_consumed != 0U)
  {
    diagnostic_hold_consumed = 0U;
    return;
  }

  if (App_GetFatalFaultFlags() != FAULT_NONE)
  {
    return;
  }

  LOG_Printf("[BTN] %s\r\n", ButtonEvent_ToString(event));

  if (event == BTN_EVENT_SHORT_PRESS)
  {
    if (SystemMode_Get(&system_mode) == SYS_MODE_LOW_POWER)
    {
      previous_mode = SystemMode_Get(&system_mode);
      (void)SystemMode_Set(&system_mode, SYS_MODE_ACTIVE);
      App_ApplyMode(previous_mode, SYS_MODE_ACTIVE);
      return;
    }

    App_ToggleMasterVolume();
    return;
  }

  previous_mode = SystemMode_Get(&system_mode);
  if (SystemMode_HandleButtonEvent(&system_mode, event) != 0U)
  {
    next_mode = SystemMode_Get(&system_mode);
    App_ApplyMode(previous_mode, next_mode);
  }
}

static void App_UpdateDiagnosticHold(uint32_t now)
{
  uint32_t held_ms;
  SystemMode_t previous_mode;

  if (diagnostic_hold_consumed != 0U)
  {
    return;
  }

  if (App_GetFatalFaultFlags() != FAULT_NONE)
  {
    return;
  }

  if (SystemMode_Get(&system_mode) == SYS_MODE_DIAGNOSTIC)
  {
    return;
  }

  held_ms = ButtonEvent_GetPressedDuration(&volume_button, now);
  if (held_ms < FAULT_CLEAR_HOLD_MS)
  {
    return;
  }

  diagnostic_hold_consumed = 1U;
  LOG_Printf("[BTN] LONG_3S\r\n");
  previous_mode = SystemMode_Get(&system_mode);
  (void)SystemMode_Set(&system_mode, SYS_MODE_DIAGNOSTIC);
  App_ApplyMode(previous_mode, SYS_MODE_DIAGNOSTIC);
}

static void App_UpdateFaults(uint32_t now)
{
  uint32_t held_ms;
  uint32_t flags_before;

  held_ms = ButtonEvent_GetPressedDuration(&volume_button, now);
  flags_before = FaultManager_GetFlags(&fault_manager);
  FaultManager_RecordButtonHeld(&fault_manager, held_ms);
  FaultManager_RecordI2sErrors(&fault_manager,
                               AudioTone_GetLeftError(),
                               AudioTone_GetRightError());

  if (ButtonEvent_IsPressed(&volume_button) == 0U)
  {
    fault_clear_hold_consumed = 0U;
    return;
  }

  if ((flags_before == FAULT_NONE) ||
      (fault_clear_hold_consumed != 0U) ||
      (held_ms < FAULT_CLEAR_HOLD_MS))
  {
    return;
  }

  fault_clear_hold_consumed = 1U;
  FaultManager_PrintClearRequest();
  FaultManager_Clear(&fault_manager);
  if (SystemMode_Get(&system_mode) == SYS_MODE_FAULT)
  {
    SystemMode_t previous_mode = SystemMode_Get(&system_mode);
    (void)SystemMode_Set(&system_mode, SYS_MODE_ACTIVE);
    App_ApplyMode(previous_mode, SYS_MODE_ACTIVE);
  }
}

static void App_UpdateAutoLowPower(uint32_t now)
{
  SystemMode_t previous_mode;

  if (App_GetFatalFaultFlags() != FAULT_NONE)
  {
    return;
  }

  if (ButtonEvent_IsPressed(&volume_button) != 0U)
  {
    return;
  }

  if (SystemMode_Get(&system_mode) != SYS_MODE_MUTED)
  {
    return;
  }

  if ((now - system_mode_enter_tick) < LOW_POWER_ENTRY_DELAY_MS)
  {
    return;
  }

  previous_mode = SystemMode_Get(&system_mode);
  if (SystemMode_Set(&system_mode, SYS_MODE_LOW_POWER) != 0U)
  {
    App_ApplyMode(previous_mode, SYS_MODE_LOW_POWER);
  }
}

static void App_UpdatePowerMonitor(uint32_t now)
{
  ina219_sample_t sample;
  power_sample_t power_sample;
  SystemMode_t mode;

  if (power_monitor_ready == 0U)
  {
    return;
  }

  mode = SystemMode_Get(&system_mode);
  if (mode != power_monitor_mode)
  {
    App_ResetPowerMonitorStats(mode);
  }

  if ((now - last_power_monitor_tick) < POWER_MONITOR_PERIOD_MS)
  {
    return;
  }
  last_power_monitor_tick = now;

  if (INA219_ReadSample(&sample) != HAL_OK)
  {
    LOG_Printf("[INA219] read fail\r\n");
    return;
  }

  latest_bus_mv = sample.bus_mv;
  latest_shunt_uv = sample.shunt_uv;
  latest_current_ma_x100 = sample.current_ma_x100;
  latest_power_mw = sample.power_mw;
  App_UpdatePowerMonitorStats(&sample, &power_sample);
  PowerReport_Record(mode, current_head_state, sample.current_ma_x100, now);
  if (APP_ENABLE_POWER_TELEMETRY_LOG != 0U)
  {
    App_PrintPowerSample(mode, &power_sample);
  }
}

static void App_ResetPowerMonitorStats(SystemMode_t mode)
{
  uint32_t index;

  power_monitor_mode = mode;
  power_monitor_window_index = 0U;
  power_monitor_window_count = 0U;
  power_monitor_window_sum_ma_x100 = 0L;
  power_monitor_min_ma_x100 = 0L;
  power_monitor_max_ma_x100 = 0L;
  power_monitor_sample_count = 0U;

  for (index = 0U; index < POWER_MONITOR_AVG_WINDOW; index++)
  {
    power_monitor_current_window[index] = 0L;
  }
}

static void App_BuildLogSnapshot(DataLogger_Snapshot_t *snapshot, uint32_t now)
{
  if (snapshot == 0)
  {
    return;
  }

  snapshot->time_ms = now;
  snapshot->mode = SystemMode_Get(&system_mode);
  snapshot->head_state = current_head_state;
  snapshot->roll_deg = last_filtered_roll_deg;
  snapshot->pitch_deg = last_filtered_pitch_deg;
  snapshot->left_volume = AudioVolumeSmoother_GetLeft(&volume_smoother);
  snapshot->right_volume = AudioVolumeSmoother_GetRight(&volume_smoother);
  snapshot->bus_mv = latest_bus_mv;
  snapshot->current_ma_x100 = latest_current_ma_x100;
  snapshot->audio_rail_on = AudioPower_IsOn();
  snapshot->fault_flags = FaultManager_GetFlags(&fault_manager);
}

static void App_UpdateDataLogger(uint32_t now)
{
  DataLogger_Snapshot_t snapshot;

  App_BuildLogSnapshot(&snapshot, now);
  DataLogger_Process(&snapshot);
  App_CheckDataLoggerFault();
}

static void App_CheckDataLoggerFault(void)
{
  if ((DataLogger_HasError() != 0U) && (data_logger_fault_latched == 0U))
  {
    data_logger_fault_latched = 1U;
    FaultManager_SetFlags(&fault_manager, FAULT_SD_LOG);
  }
}

static void App_UpdatePowerMonitorStats(const ina219_sample_t *sample, power_sample_t *power_sample)
{
  int32_t old_current;

  if ((sample == 0) || (power_sample == 0))
  {
    return;
  }

  if (power_monitor_window_count < POWER_MONITOR_AVG_WINDOW)
  {
    power_monitor_window_count++;
  }
  else
  {
    old_current = power_monitor_current_window[power_monitor_window_index];
    power_monitor_window_sum_ma_x100 -= old_current;
  }

  power_monitor_current_window[power_monitor_window_index] = sample->current_ma_x100;
  power_monitor_window_sum_ma_x100 += sample->current_ma_x100;
  power_monitor_window_index++;
  if (power_monitor_window_index >= POWER_MONITOR_AVG_WINDOW)
  {
    power_monitor_window_index = 0U;
  }

  power_monitor_sample_count++;
  if (power_monitor_sample_count == 1U)
  {
    power_monitor_min_ma_x100 = sample->current_ma_x100;
    power_monitor_max_ma_x100 = sample->current_ma_x100;
  }
  else
  {
    if (sample->current_ma_x100 < power_monitor_min_ma_x100)
    {
      power_monitor_min_ma_x100 = sample->current_ma_x100;
    }
    if (sample->current_ma_x100 > power_monitor_max_ma_x100)
    {
      power_monitor_max_ma_x100 = sample->current_ma_x100;
    }
  }

  power_sample->bus_mv = sample->bus_mv;
  power_sample->current_ma_x100 = sample->current_ma_x100;
  power_sample->power_mw = sample->power_mw;
  power_sample->current_avg_ma_x100 = power_monitor_window_sum_ma_x100 / (int32_t)power_monitor_window_count;
  power_sample->current_min_ma_x100 = power_monitor_min_ma_x100;
  power_sample->current_max_ma_x100 = power_monitor_max_ma_x100;
  power_sample->sample_count = power_monitor_sample_count;
}

static void App_PrintPowerSample(SystemMode_t mode, const power_sample_t *sample)
{
  if (sample == 0)
  {
    return;
  }

  LOG_Printf("PWR,mode=%s,bus=%lu.%03lu,current=",
             SystemMode_ToString(mode),
             (unsigned long)(sample->bus_mv / 1000U),
             (unsigned long)(sample->bus_mv % 1000U));
  App_PrintFixedSigned(sample->current_ma_x100);
  LOG_Printf(",power=%lu.0,avg=", (unsigned long)sample->power_mw);
  App_PrintFixedSigned(sample->current_avg_ma_x100);
  LOG_Printf(",min=");
  App_PrintFixedSigned(sample->current_min_ma_x100);
  LOG_Printf(",max=");
  App_PrintFixedSigned(sample->current_max_ma_x100);
  LOG_Printf(",n=%lu\r\n", (unsigned long)sample->sample_count);
}

static void App_PrintCombinedTelemetry(uint32_t now,
                                       const PowerPolicy_t *policy,
                                       float roll_deg,
                                       float pitch_deg,
                                       head_state_t head_state)
{
  uint32_t imu_hz = 0U;
  uint32_t telemetry_hz = 0U;
  uint32_t audio_enabled = 0U;

  if (policy != 0)
  {
    imu_hz = PowerPolicy_PeriodToHz(policy->imu_period_ms);
    telemetry_hz = PowerPolicy_PeriodToHz(policy->telemetry_period_ms);
    audio_enabled = policy->audio_enabled;
  }

  LOG_Printf("TEL,%lu,%s,%08lX,%lu,%lu,%lu,%ld,%ld,%s,%lu,%lu,%lu,%lu,%lu,%ld,%ld,%lu,%lu\r\n",
             (unsigned long)now,
             SystemMode_ToString(SystemMode_Get(&system_mode)),
             (unsigned long)FaultManager_GetFlags(&fault_manager),
             (unsigned long)imu_hz,
             (unsigned long)telemetry_hz,
             (unsigned long)audio_enabled,
             (long)SimTelemetry_DegToCentiDeg(roll_deg),
             (long)SimTelemetry_DegToCentiDeg(pitch_deg),
             HeadSM_ToString(head_state),
             (unsigned long)SimTelemetry_VolumeToPercent(AudioControl_GetLeftVolume() * master_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(AudioControl_GetRightVolume() * master_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(AudioVolumeSmoother_GetLeft(&volume_smoother)),
             (unsigned long)SimTelemetry_VolumeToPercent(AudioVolumeSmoother_GetRight(&volume_smoother)),
             (unsigned long)latest_bus_mv,
             (long)latest_shunt_uv,
             (long)latest_current_ma_x100,
             (unsigned long)latest_power_mw,
             (unsigned long)AudioPower_IsOn());
}

static void App_PrintFixedSigned(int32_t value_x100)
{
  uint32_t magnitude;

  if (value_x100 < 0L)
  {
    LOG_Printf("-");
    magnitude = (uint32_t)(0L - value_x100);
  }
  else
  {
    magnitude = (uint32_t)value_x100;
  }

  App_PrintFixedUnsigned(magnitude);
}

static void App_PrintFixedUnsigned(uint32_t value_x100)
{
  LOG_Printf("%lu.%02lu",
             (unsigned long)(value_x100 / 100U),
             (unsigned long)(value_x100 % 100U));
}

static void App_ForceFaultModeIfNeeded(uint32_t now)
{
  SystemMode_t previous_mode;
  DataLogger_Snapshot_t snapshot;

  if (App_GetFatalFaultFlags() == FAULT_NONE)
  {
    return;
  }

  if (SystemMode_Get(&system_mode) == SYS_MODE_FAULT)
  {
    return;
  }

  previous_mode = SystemMode_Get(&system_mode);
  App_BuildLogSnapshot(&snapshot, now);
  DataLogger_LogFault(&snapshot);
  (void)SystemMode_Set(&system_mode, SYS_MODE_FAULT);
  App_ApplyMode(previous_mode, SYS_MODE_FAULT);
  StatusLed_Update(SystemMode_Get(&system_mode), FaultManager_GetFlags(&fault_manager), now);
}

static void App_UpdateAudioOutput(void)
{
  PowerPolicy_t policy;

  App_GetPowerPolicy(&policy);
  App_UpdateVolumeTarget();

  if ((App_GetFatalFaultFlags() != FAULT_NONE) ||
      (policy.audio_enabled == 0U))
  {
    AudioTone_SetMute(1U);
    AudioTone_SetStereoVolume(0.0f, 0.0f);
    return;
  }

  AudioTone_SetMute(0U);
  if (AudioVolumeSmoother_Update(&volume_smoother) != 0U)
  {
    AudioTone_SetStereoVolume(AudioVolumeSmoother_GetLeft(&volume_smoother),
                              AudioVolumeSmoother_GetRight(&volume_smoother));
  }
}

static void App_UpdateLowPowerMotionWake(const attitude_angle_t *angle)
{
  SystemMode_t previous_mode;

  if ((angle == 0) || (SystemMode_Get(&system_mode) != SYS_MODE_LOW_POWER))
  {
    return;
  }

  if (low_power_reference_valid == 0U)
  {
    low_power_reference_roll_deg = angle->roll_deg;
    low_power_reference_pitch_deg = angle->pitch_deg;
    low_power_reference_valid = 1U;
    return;
  }

  if ((App_AbsFloat(angle->roll_deg - low_power_reference_roll_deg) <= LOW_POWER_WAKE_DELTA_DEG) &&
      (App_AbsFloat(angle->pitch_deg - low_power_reference_pitch_deg) <= LOW_POWER_WAKE_DELTA_DEG))
  {
    return;
  }

  LOG_Printf("[WAKE] motion detected\r\n");
  previous_mode = SystemMode_Get(&system_mode);
  (void)SystemMode_Set(&system_mode, SYS_MODE_ACTIVE);
  App_ApplyMode(previous_mode, SYS_MODE_ACTIVE);
}

static void App_ToggleMasterVolume(void)
{
  if (master_volume > MASTER_VOLUME_LOW)
  {
    master_volume = MASTER_VOLUME_LOW;
    LOG_Printf("[VOL] master=20%%\r\n");
  }
  else
  {
    master_volume = MASTER_VOLUME_FULL;
    LOG_Printf("[VOL] master=100%%\r\n");
  }

  App_UpdateVolumeTarget();
}

static void App_ApplyMode(SystemMode_t previous_mode, SystemMode_t next_mode)
{
  DataLogger_Snapshot_t snapshot;

  LOG_Printf("[MODE] %s -> %s\r\n",
             SystemMode_ToString(previous_mode),
             SystemMode_ToString(next_mode));

  system_mode_enter_tick = HAL_GetTick();

  if (next_mode == SYS_MODE_LOW_POWER)
  {
    AudioTone_SetMute(1U);
    AudioTone_SetStereoVolume(0.0f, 0.0f);
    HAL_Delay(AUDIO_POWER_OFF_SETTLE_MS);
    AudioPower_Set(0U);
    LOG_Printf("[PWR] audio switch=off\r\n");
  }
  else
  {
    if (AudioPower_IsOn() == 0U)
    {
      AudioPower_Set(1U);
      LOG_Printf("[PWR] audio switch=on\r\n");
      if (previous_mode == SYS_MODE_LOW_POWER)
      {
        HAL_Delay(AUDIO_POWER_WAKE_DELAY_MS);
      }
    }
  }

  AudioControl_SetMode(next_mode);
  AudioTone_SetMute(((next_mode == SYS_MODE_LOW_POWER) || (next_mode == SYS_MODE_FAULT)) ? 1U : 0U);
  if (next_mode == SYS_MODE_LOW_POWER)
  {
    low_power_reference_roll_deg = last_filtered_roll_deg;
    low_power_reference_pitch_deg = last_filtered_pitch_deg;
    low_power_reference_valid = 1U;
  }
  else
  {
    low_power_reference_valid = 0U;
  }

  StatusLed_Update(next_mode, FaultManager_GetFlags(&fault_manager), system_mode_enter_tick);
  App_PrintPowerPolicy(next_mode);
  App_UpdateVolumeTarget();
  App_BuildLogSnapshot(&snapshot, system_mode_enter_tick);
  DataLogger_LogModeEvent(&snapshot, previous_mode, next_mode);
  App_CheckDataLoggerFault();

  if (next_mode == SYS_MODE_DIAGNOSTIC)
  {
    App_RunDiagnostic();
  }
}

static void App_RunDiagnostic(void)
{
  uint8_t who_am_i = 0;
  HAL_StatusTypeDef imu_status;
  GPIO_PinState button_state;
  SystemMode_t previous_mode;
  uint8_t imu_ok = 0U;
  uint8_t i2s_left_ok;
  uint8_t i2s_right_ok;

  LOG_Printf("[DIAG] start\r\n");

  App_DiagnosticBeep(DIAG_BEEP_VOLUME, 0.0f);
  App_DiagnosticBeep(0.0f, DIAG_BEEP_VOLUME);
  App_DiagnosticBeep(DIAG_BEEP_VOLUME, DIAG_BEEP_VOLUME);

  imu_status = MPU6500_ReadWhoAmI(&who_am_i);
  if ((imu_status == HAL_OK) && (who_am_i == MPU6500_WHO_AM_I_VALUE))
  {
    imu_ok = 1U;
    LOG_Printf("[DIAG] imu=OK whoami=0x%02X\r\n", who_am_i);
  }
  else
  {
    FaultManager_SetFlags(&fault_manager, FAULT_IMU_LOST);
    LOG_Printf("[DIAG] imu=FAIL whoami=0x%02X boot=0x%02X\r\n",
               who_am_i,
               imu_boot_who_am_i);
  }

  i2s_left_ok = (AudioTone_GetLeftError() == 0U) ? 1U : 0U;
  i2s_right_ok = (AudioTone_GetRightError() == 0U) ? 1U : 0U;
  LOG_Printf("[DIAG] i2s_left=%s state=0x%lX error=0x%lX\r\n",
             (i2s_left_ok != 0U) ? "OK" : "FAIL",
             (unsigned long)AudioTone_GetLeftState(),
             (unsigned long)AudioTone_GetLeftError());
  LOG_Printf("[DIAG] i2s_right=%s state=0x%lX error=0x%lX\r\n",
             (i2s_right_ok != 0U) ? "OK" : "FAIL",
             (unsigned long)AudioTone_GetRightState(),
             (unsigned long)AudioTone_GetRightError());
  if ((AudioTone_GetLeftError() != 0U) || (AudioTone_GetRightError() != 0U))
  {
    FaultManager_RecordI2sErrors(&fault_manager,
                                 AudioTone_GetLeftError(),
                                 AudioTone_GetRightError());
  }

  button_state = HAL_GPIO_ReadPin(VOLUME_BUTTON_GPIO_Port, VOLUME_BUTTON_Pin);
  LOG_Printf("[DIAG] button=OK state=%s\r\n",
             (button_state == GPIO_PIN_RESET) ? "PRESSED" : "RELEASED");
  PowerReport_PrintDemoSummary(imu_ok, i2s_left_ok, i2s_right_ok, power_monitor_ready);
  DataLogger_LogDiagnosticSummary(imu_ok, i2s_left_ok, i2s_right_ok, power_monitor_ready);
  App_CheckDataLoggerFault();
  LOG_Printf("[DIAG] done\r\n");

  previous_mode = SystemMode_Get(&system_mode);
  (void)SystemMode_Set(&system_mode, SYS_MODE_ACTIVE);
  App_ApplyMode(previous_mode, SYS_MODE_ACTIVE);
  AudioTone_SetStereoVolume(AudioVolumeSmoother_GetLeft(&volume_smoother),
                            AudioVolumeSmoother_GetRight(&volume_smoother));
}

static void App_DiagnosticBeep(float left_volume, float right_volume)
{
  AudioTone_SetMute(0U);
  AudioTone_SetStereoVolume(left_volume, right_volume);
  HAL_Delay(DIAG_BEEP_ON_MS);
  AudioTone_SetStereoVolume(0.0f, 0.0f);
  HAL_Delay(DIAG_BEEP_OFF_MS);
}

static void App_GetPowerPolicy(PowerPolicy_t *policy)
{
  PowerPolicy_Get(SystemMode_Get(&system_mode), policy);
}

static uint32_t App_GetFatalFaultFlags(void)
{
  return FaultManager_GetFlags(&fault_manager) & ~((uint32_t)FAULT_SD_LOG);
}

static void App_PrintPowerPolicy(SystemMode_t mode)
{
  PowerPolicy_t policy;

  PowerPolicy_Get(mode, &policy);
  LOG_Printf("[POLICY] imu=%lums tel=%lums audio=%s\r\n",
             (unsigned long)policy.imu_period_ms,
             (unsigned long)policy.telemetry_period_ms,
             (policy.audio_enabled != 0U) ? "on" : "off");
}

static float App_AbsFloat(float value)
{
  if (value < 0.0f)
  {
    return 0.0f - value;
  }

  return value;
}

void HAL_I2S_ErrorCallback(I2S_HandleTypeDef *hi2s)
{
  if (hi2s == &hi2s2)
  {
    FaultManager_SetFlags(&fault_manager, FAULT_I2S_LEFT);
  }
  else if (hi2s == &hi2s3)
  {
    FaultManager_SetFlags(&fault_manager, FAULT_I2S_RIGHT);
  }
}
