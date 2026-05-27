#include "sim_telemetry.h"
#include "bsp_uart_log.h"

void SimTelemetry_PrintFormat(void)
{
  LOG_Printf("[SIMFMT] SIM,ms,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct\r\n");
  LOG_Printf("[SIMFMT] SIM2,ms,mode,fault_hex,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct\r\n");
  LOG_Printf("[SIMFMT] SIM3,ms,mode,fault_hex,imu_hz,tel_hz,audio_en,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct\r\n");
  LOG_Printf("[SIMFMT] TEL,ms,mode,fault_hex,imu_hz,tel_hz,audio_en,roll_cd,pitch_cd,head,target_l_pct,target_r_pct,smooth_l_pct,smooth_r_pct,bus_mv,shunt_uv,current_cma,power_mw,audio_rail\r\n");
}

void SimTelemetry_Print(uint32_t tick_ms,
                        SystemMode_t mode,
                        uint32_t fault_flags,
                        const PowerPolicy_t *policy,
                        float roll_deg,
                        float pitch_deg,
                        head_state_t head_state,
                        float target_left_volume,
                        float target_right_volume,
                        float smooth_left_volume,
                        float smooth_right_volume)
{
  LOG_Printf("SIM,%lu,%ld,%ld,%s,%lu,%lu,%lu,%lu\r\n",
             (unsigned long)tick_ms,
             (long)SimTelemetry_DegToCentiDeg(roll_deg),
             (long)SimTelemetry_DegToCentiDeg(pitch_deg),
             HeadSM_ToString(head_state),
             (unsigned long)SimTelemetry_VolumeToPercent(target_left_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(target_right_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(smooth_left_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(smooth_right_volume));
  LOG_Printf("SIM2,%lu,%s,%08lX,%ld,%ld,%s,%lu,%lu,%lu,%lu\r\n",
             (unsigned long)tick_ms,
             SystemMode_ToString(mode),
             (unsigned long)fault_flags,
             (long)SimTelemetry_DegToCentiDeg(roll_deg),
             (long)SimTelemetry_DegToCentiDeg(pitch_deg),
             HeadSM_ToString(head_state),
             (unsigned long)SimTelemetry_VolumeToPercent(target_left_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(target_right_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(smooth_left_volume),
             (unsigned long)SimTelemetry_VolumeToPercent(smooth_right_volume));
  if (policy != 0)
  {
    LOG_Printf("SIM3,%lu,%s,%08lX,%lu,%lu,%lu,%ld,%ld,%s,%lu,%lu,%lu,%lu\r\n",
               (unsigned long)tick_ms,
               SystemMode_ToString(mode),
               (unsigned long)fault_flags,
               (unsigned long)PowerPolicy_PeriodToHz(policy->imu_period_ms),
               (unsigned long)PowerPolicy_PeriodToHz(policy->telemetry_period_ms),
               (unsigned long)policy->audio_enabled,
               (long)SimTelemetry_DegToCentiDeg(roll_deg),
               (long)SimTelemetry_DegToCentiDeg(pitch_deg),
               HeadSM_ToString(head_state),
               (unsigned long)SimTelemetry_VolumeToPercent(target_left_volume),
               (unsigned long)SimTelemetry_VolumeToPercent(target_right_volume),
               (unsigned long)SimTelemetry_VolumeToPercent(smooth_left_volume),
               (unsigned long)SimTelemetry_VolumeToPercent(smooth_right_volume));
  }
}

int32_t SimTelemetry_DegToCentiDeg(float deg)
{
  if (deg >= 0.0f)
  {
    return (int32_t)((deg * 100.0f) + 0.5f);
  }

  return (int32_t)((deg * 100.0f) - 0.5f);
}

uint32_t SimTelemetry_VolumeToPercent(float volume)
{
  if (volume < 0.0f)
  {
    volume = 0.0f;
  }

  if (volume > 1.0f)
  {
    volume = 1.0f;
  }

  return (uint32_t)((volume * 100.0f) + 0.5f);
}
