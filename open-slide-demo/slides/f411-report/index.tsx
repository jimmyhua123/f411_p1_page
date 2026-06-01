import type { CSSProperties } from 'react';
import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import { useSlidePageNumber } from '@open-slide/core';

import breadboard from './assets/breadboard.png';
import desktopMain from './assets/desktop-main.png';
import desktopPower from './assets/desktop-power.png';
import schematic1 from './assets/schematic-1.png';
import schematic2 from './assets/schematic-2.png';
import pcbLayout from './assets/pcb-layout.png';
import pcb3d from './assets/pcb-3d.png';

export const design: DesignSystem = {
  palette: { bg: '#f7f9fb', text: '#17202a', accent: '#00857a' },
  fonts: {
    display:
      'Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body:
      'Inter, "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  typeScale: { hero: 104, body: 34 },
  radius: 8,
};

const ink = '#17202a';
const muted = '#5b6773';
const paper = '#f7f9fb';
const panel = '#ffffff';
const line = '#d6dee6';
const teal = '#00857a';
const amber = '#c8891a';
const coral = '#d3543f';
const blue = '#2f6fbb';
const green = '#2d7a46';
const dark = '#1f2b37';

const page: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  background: paper,
  color: ink,
  fontFamily: 'var(--osd-font-body)',
  position: 'relative',
  overflow: 'hidden',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 72,
  lineHeight: 1.08,
  fontWeight: 860,
  letterSpacing: 0,
};

const smallTitle: CSSProperties = {
  margin: 0,
  fontSize: 54,
  lineHeight: 1.12,
  fontWeight: 840,
  letterSpacing: 0,
};

const Footer = () => {
  const { current, total } = useSlidePageNumber();

  return (
    <div
      style={{
        position: 'absolute',
        left: 92,
        right: 92,
        bottom: 48,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: muted,
        fontSize: 22,
      }}
    >
      <span>STM32F411 Head-Tracking Audio</span>
      <span>
        {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
    </div>
  );
};

const Eyebrow = ({ children }: { children: string }) => (
  <div
    style={{
      fontSize: 24,
      letterSpacing: 0,
      color: teal,
      fontWeight: 820,
      marginBottom: 22,
    }}
  >
    {children}
  </div>
);

const Pill = ({ children, color = teal }: { children: string; color?: string }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 42,
      padding: '0 18px',
      borderRadius: 999,
      background: `${color}1A`,
      color,
      fontSize: 22,
      fontWeight: 780,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

const TextList = ({ items, size = 30 }: { items: string[]; size?: number }) => (
  <div style={{ display: 'grid', gap: 18 }}>
    {items.map((item) => (
      <div key={item} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: teal, marginTop: size * 0.48 }} />
        <div style={{ fontSize: size, lineHeight: 1.38, color: ink }}>{item}</div>
      </div>
    ))}
  </div>
);

const Stat = ({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) => (
  <div
    style={{
      background: panel,
      border: `2px solid ${line}`,
      borderRadius: 8,
      padding: 28,
      minHeight: 176,
      boxSizing: 'border-box',
    }}
  >
    <div style={{ width: 56, height: 8, borderRadius: 999, background: color, marginBottom: 24 }} />
    <div style={{ fontSize: 24, color: muted, marginBottom: 12 }}>{label}</div>
    <div style={{ fontSize: 50, fontWeight: 860, lineHeight: 1.02, marginBottom: 12 }}>{value}</div>
    <div style={{ fontSize: 22, lineHeight: 1.36, color: muted }}>{note}</div>
  </div>
);

const ImageFrame = ({
  src,
  label,
  fit = 'cover',
  style,
}: {
  src: string;
  label?: string;
  fit?: CSSProperties['objectFit'];
  style?: CSSProperties;
}) => (
  <div
    style={{
      border: `2px solid ${line}`,
      borderRadius: 8,
      background: panel,
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}
  >
    <img src={src} alt={label ?? ''} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />
    {label ? (
      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 18,
          background: 'rgba(23,32,42,.82)',
          color: '#fff',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    ) : null}
  </div>
);

const Cover: Page = () => (
  <section style={{ ...page, padding: '94px 92px' }}>
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${paper} 0%, ${paper} 48%, #e8f3f1 48%, #e8f3f1 100%)` }} />
    <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '760px 1fr', gap: 58 }}>
      <div style={{ paddingTop: 42 }}>
        <Eyebrow>專題成果報告</Eyebrow>
        <h1 style={{ margin: 0, fontSize: 96, lineHeight: 1.05, fontWeight: 900, letterSpacing: 0 }}>
          STM32F411
          <br />
          頭部追蹤音訊系統
        </h1>
        <p style={{ margin: '38px 0 0', fontSize: 34, lineHeight: 1.44, color: muted }}>
          從 AI 專案設計、麵包板驗證、韌體完成，到桌面監測頁面與 PCB layout 的完整開發流程。
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 42, flexWrap: 'wrap' }}>
          <Pill>MPU6500</Pill>
          <Pill color={blue}>MAX98357A</Pill>
          <Pill color={amber}>INA219</Pill>
          <Pill color={coral}>AO3401</Pill>
        </div>
      </div>
      <ImageFrame src={pcb3d} label="3D PCB preview" fit="contain" style={{ height: 790 }} />
    </div>
    <Footer />
  </section>
);

const Roadmap: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>開發流程</Eyebrow>
    <h2 style={titleStyle}>從概念到板級設計</h2>
    <div style={{ marginTop: 62, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 22 }}>
      {[
        ['1', 'AI 設計專案', '規劃系統架構、資料流與韌體模組邊界。', teal],
        ['2', '麵包板接線', '把全部元件接上，驗證感測、音訊、電源與 SD。', blue],
        ['3', 'AI 輔助韌體', '完成姿態、音訊、模式、故障與 telemetry。', amber],
        ['4', '桌面 HTML', '與硬體連線成功，顯示狀態並測試功能。', green],
        ['5', 'Schematic / PCB', '把模組元件轉為直接 IC 與板級電路連接。', coral],
      ].map(([num, title, body, color]) => (
        <div key={num} style={{ background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: 28, minHeight: 420 }}>
          <div style={{ width: 58, height: 58, borderRadius: 12, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 850, marginBottom: 28 }}>
            {num}
          </div>
          <div style={{ fontSize: 34, fontWeight: 840, lineHeight: 1.16, marginBottom: 22 }}>{title}</div>
          <div style={{ fontSize: 25, lineHeight: 1.42, color: muted }}>{body}</div>
        </div>
      ))}
    </div>
    <Footer />
  </section>
);

const SystemArchitecture: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>系統架構</Eyebrow>
    <h2 style={titleStyle}>姿態輸入控制雙聲道音訊</h2>
    <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '520px 1fr', gap: 48 }}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Stat label="Controller" value="STM32F411" note="HAL / CubeMX 初始化，App_MainLoop 排程" color={teal} />
        <Stat label="Sensor" value="MPU6500" note="I2C1 讀取 raw accel，計算 roll / pitch" color={blue} />
        <Stat label="Audio" value="2x I2S DMA" note="I2S2 / I2S3 驅動左右 MAX98357A" color={amber} />
      </div>
      <div style={{ background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: 38 }}>
        <pre style={{ margin: 0, fontSize: 30, lineHeight: 1.5, color: ink, fontFamily: 'Consolas, "Cascadia Mono", monospace' }}>
{`MPU6500 raw data
  -> roll / pitch calculation
  -> low-pass filter
  -> head state machine
  -> audio control
  -> volume smoother
  -> I2S DMA output

Telemetry / CSV:
  -> desktop HTML page
  -> log analysis`}
        </pre>
      </div>
    </div>
    <Footer />
  </section>
);

const Breadboard: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '650px 1fr', gap: 54, alignItems: 'start' }}>
      <div>
        <Eyebrow>硬體原型</Eyebrow>
        <h2 style={smallTitle}>麵包板完成全部元件接線</h2>
        <p style={{ margin: '30px 0 36px', fontSize: 30, lineHeight: 1.45, color: muted }}>
          先用模組快速驗證電氣與通訊可行性，再把確認可運作的連接轉成 schematic 與 PCB。
        </p>
        <TextList
          items={[
            'MPU6500 I2C 姿態感測正常。',
            '左右 MAX98357A 由 I2S2 / I2S3 輸出音訊。',
            'INA219 量測音訊電源軌電壓與電流。',
            'AO3401 控制 LOW_POWER 音訊供電切斷。',
            'MicroSD 可寫入 CSV log。',
          ]}
        />
      </div>
      <ImageFrame src={breadboard} label="Breadboard prototype" fit="contain" style={{ height: 820 }} />
    </div>
    <Footer />
  </section>
);

const Firmware: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>韌體完成項目</Eyebrow>
    <h2 style={titleStyle}>主迴圈整合感測、音訊與電源策略</h2>
    <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
      <div style={{ background: dark, color: '#eff5f8', borderRadius: 8, padding: 36 }}>
        <pre style={{ margin: 0, fontSize: 27, lineHeight: 1.48, fontFamily: 'Consolas, "Cascadia Mono", monospace' }}>
{`Reset
  -> main()
  -> HAL / peripheral init
  -> App_Init()
  -> while (1)
       -> App_MainLoop()

App_MainLoop:
  button / fault / power
  IMU read / filter
  head state
  audio target
  telemetry / CSV`}
        </pre>
      </div>
      <div style={{ background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: 36 }}>
        <TextList
          size={28}
          items={[
            'ACTIVE、MUTED、LOW_POWER、DIAGNOSTIC、FAULT 模式。',
            'CENTER、LEFT、RIGHT、DOWN、UP 頭部狀態機。',
            'roll-based stereo panning 與 HEAD_DOWN mute。',
            'fault flags、LED 狀態、按鍵短按與長按。',
            'SIM / SIM2 / SIM3 / PWR telemetry 與 MicroSD CSV。',
          ]}
        />
      </div>
    </div>
    <Footer />
  </section>
);

const HeadAudio: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>頭部控制音訊</Eyebrow>
    <h2 style={titleStyle}>用姿態改變左右聲道輸出</h2>
    <div style={{ marginTop: 58, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
      <Stat label="CENTER" value="L=1.00 R=1.00" note="roll 接近 0 度，左右聲道正常輸出。" color={teal} />
      <Stat label="LEFT" value="R 降低" note="roll < -25 度，右聲道降到約 30%。" color={blue} />
      <Stat label="RIGHT" value="L 降低" note="roll > 25 度，左聲道降到約 30%。" color={amber} />
      <Stat label="DOWN" value="Mute" note="pitch < -35 度，左右目標音量歸零。" color={coral} />
    </div>
    <div style={{ marginTop: 42, background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: '28px 34px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 26, alignItems: 'center', fontSize: 30 }}>
        <strong>防抖設計</strong>
        <span style={{ color: muted }}>使用 enter / exit 門檻 hysteresis，避免頭部角度在邊界附近來回切換。</span>
        <strong>音量保護</strong>
        <span style={{ color: muted }}>使用 volume smoother 降低音量變化造成的 click / pop。</span>
      </div>
    </div>
    <Footer />
  </section>
);

const Power: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>電源監測與低功耗</Eyebrow>
    <h2 style={titleStyle}>AO3401 讓 LOW_POWER 真的切斷音訊電源</h2>
    <div style={{ marginTop: 52, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
      <div style={{ background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: 36 }}>
        <pre style={{ margin: 0, fontSize: 28, lineHeight: 1.48, fontFamily: 'Consolas, "Cascadia Mono", monospace' }}>
{`5V_AUDIO_IN
  -> INA219 VIN+
  -> INA219 VIN-
  -> AO3401 Source
  -> AO3401 Drain
  -> 5V_AUDIO_SW
  -> MAX98357A VIN

PB8 -> level shifter -> Gate`}
        </pre>
      </div>
      <div style={{ display: 'grid', gap: 22 }}>
        <Stat label="ACTIVE 20%" value="18.0 mA" note="音訊輸出時的音訊電源軌電流。" color={teal} />
        <Stat label="HEAD_DOWN" value="5.6 mA" note="軟體靜音仍有模組待機消耗。" color={amber} />
        <Stat label="LOW_POWER" value="~0 mA" note="AO3401 關閉後接近 0 mA，AUDIO_RAIL_CUTOFF=PASS。" color={green} />
      </div>
    </div>
    <Footer />
  </section>
);

const Desktop: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>桌面 HTML Page</Eyebrow>
    <h2 style={titleStyle}>與硬體連線成功並測試功能正常</h2>
    <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
      <ImageFrame src={desktopMain} label="Main dashboard" fit="contain" style={{ height: 655 }} />
      <ImageFrame src={desktopPower} label="Power monitor" fit="contain" style={{ height: 655 }} />
    </div>
    <div style={{ marginTop: 26, fontSize: 28, lineHeight: 1.38, color: muted }}>
      頁面可讀取 telemetry，顯示 IMU 姿態、頭部方向、音訊狀態與 INA219 power 監測結果。
    </div>
    <Footer />
  </section>
);

const Pcb: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>電路圖與 PCB Layout</Eyebrow>
    <h2 style={titleStyle}>把麵包板模組轉成直接 IC 連接</h2>
    <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
      <ImageFrame src={schematic1} label="Schematic 1" fit="contain" style={{ height: 320 }} />
      <ImageFrame src={schematic2} label="Schematic 2" fit="contain" style={{ height: 320 }} />
      <ImageFrame src={pcb3d} label="3D PCB" fit="contain" style={{ height: 320 }} />
    </div>
    <ImageFrame src={pcbLayout} label="PCB layout" fit="contain" style={{ height: 390, marginTop: 24 }} />
    <Footer />
  </section>
);

const Evidence: Page = () => (
  <section style={{ ...page, padding: '86px 92px' }}>
    <Eyebrow>驗證結果</Eyebrow>
    <h2 style={titleStyle}>主要功能皆已完成驗證</h2>
    <div style={{ marginTop: 46, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
      {[
        ['MPU6500 IMU', 'WHO_AM_I read', teal],
        ['Roll / pitch', 'Telemetry and log fields', blue],
        ['Dual audio', 'I2S2 / I2S3 DMA', amber],
        ['Head state', 'CENTER / LEFT / RIGHT / DOWN / UP', green],
        ['Audio rail cutoff', 'AO3401 + INA219, PASS', coral],
        ['MicroSD logging', 'LOG000.CSV, 133 rows', teal],
        ['UART telemetry', 'SIM / SIM2 / SIM3 / PWR', blue],
        ['Desktop page', 'Hardware connected and tested', amber],
        ['PCB design', 'Schematic + layout + 3D preview', green],
      ].map(([title, body, color]) => (
        <div key={title} style={{ background: panel, border: `2px solid ${line}`, borderRadius: 8, padding: 24, minHeight: 132 }}>
          <div style={{ width: 42, height: 8, borderRadius: 999, background: color, marginBottom: 18 }} />
          <div style={{ fontSize: 30, fontWeight: 820, marginBottom: 10 }}>{title}</div>
          <div style={{ fontSize: 23, color: muted, lineHeight: 1.32 }}>{body}</div>
        </div>
      ))}
    </div>
    <Footer />
  </section>
);

const Conclusion: Page = () => (
  <section style={{ ...page, padding: '92px 92px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 580px', gap: 64, alignItems: 'center', height: '840px' }}>
      <div>
        <Eyebrow>結論</Eyebrow>
        <h2 style={{ ...titleStyle, fontSize: 78 }}>完成可展示的嵌入式系統開發流程</h2>
        <p style={{ margin: '34px 0 0', fontSize: 32, lineHeight: 1.48, color: muted }}>
          本專案已從 AI 設計、麵包板驗證、韌體實作、桌面監測，到 schematic 與 PCB layout 完成閉環。最重要的成果是 LOW_POWER 模式由軟體靜音進一步做到硬體切斷音訊電源軌。
        </p>
        <div style={{ marginTop: 40 }}>
          <TextList
            size={28}
            items={[
              '軟體靜音約 5.6 mA，硬體切斷後接近 0 mA。',
              '桌面 HTML page 已能讀取硬體 telemetry。',
              'PCB layout 已把外接模組轉為板級 IC 連接。',
            ]}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 24 }}>
        <Stat label="Next" value="PCB 實板" note="後續可進行製板、焊接與上電測試。" color={teal} />
        <Stat label="Improve" value="Log / UI" note="擴充電流趨勢圖、fault history 與完整測試流程。" color={amber} />
        <Stat label="Optional" value="Sensor fusion" note="若需要完整 3D 姿態，可加入 gyro fusion 或 yaw 估測。" color={blue} />
      </div>
    </div>
    <Footer />
  </section>
);

export const meta: SlideMeta = {
  title: 'STM32F411 頭部追蹤音訊系統報告',
  createdAt: '2026-06-01T00:00:00.000Z',
};

export default [Cover, Roadmap, SystemArchitecture, Breadboard, Firmware, HeadAudio, Power, Desktop, Pcb, Evidence, Conclusion] satisfies Page[];
