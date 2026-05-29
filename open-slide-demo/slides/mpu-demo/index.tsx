import type { CSSProperties } from 'react';
import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import { useSlidePageNumber } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#f5f1e8', text: '#1f2a2e', accent: '#0f8b8d' },
  fonts: {
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  typeScale: { hero: 148, body: 36 },
  radius: 10,
};

const ink = '#1f2a2e';
const muted = '#637174';
const panel = '#fffaf0';
const line = '#d8cfc0';
const amber = '#d99721';
const coral = '#d95f43';
const green = '#417b5a';

const page: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  fontFamily: 'var(--osd-font-body)',
  position: 'relative',
  overflow: 'hidden',
};

const Footer = () => {
  const { current, total } = useSlidePageNumber();

  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 62,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: muted,
        fontSize: 24,
      }}
    >
      <span>MPU + INA219 telemetry</span>
      <span>
        {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
    </div>
  );
};

const CircuitMark = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      right: 90,
      top: 70,
      width: 620,
      height: 620,
      opacity: 0.9,
    }}
  >
    <svg viewBox="0 0 620 620" width="620" height="620" role="img">
      <circle cx="310" cy="310" r="206" fill="none" stroke={line} strokeWidth="34" />
      <circle cx="310" cy="310" r="112" fill="none" stroke="#bfcfc7" strokeWidth="26" />
      <path d="M310 104V20M310 600v-84M104 310H20M600 310h-84" stroke={ink} strokeWidth="18" strokeLinecap="round" />
      <path d="M456 164l62-62M102 518l62-62M164 164l-62-62M518 518l-62-62" stroke={amber} strokeWidth="18" strokeLinecap="round" />
      <circle cx="310" cy="310" r="46" fill="var(--osd-accent)" />
      <circle cx="310" cy="310" r="18" fill={panel} />
    </svg>
  </div>
);

const SignalCard = ({
  label,
  value,
  caption,
  color,
}: {
  label: string;
  value: string;
  caption: string;
  color: string;
}) => (
  <div
    style={{
      width: 360,
      minHeight: 250,
      border: `3px solid ${line}`,
      borderRadius: 'var(--osd-radius)',
      background: panel,
      padding: 32,
      boxSizing: 'border-box',
    }}
  >
    <div style={{ width: 44, height: 12, borderRadius: 999, background: color, marginBottom: 34 }} />
    <div style={{ fontSize: 28, color: muted, marginBottom: 18 }}>{label}</div>
    <div style={{ fontSize: 58, fontWeight: 850, lineHeight: 1.05, marginBottom: 22 }}>{value}</div>
    <div style={{ fontSize: 25, lineHeight: 1.45, color: muted }}>{caption}</div>
  </div>
);

const FlowNode = ({ title, detail, color }: { title: string; detail: string; color: string }) => (
  <div
    style={{
      width: 330,
      height: 230,
      borderRadius: 'var(--osd-radius)',
      background: panel,
      border: `3px solid ${line}`,
      padding: 34,
      boxSizing: 'border-box',
    }}
  >
    <div style={{ width: 54, height: 54, borderRadius: 12, background: color, marginBottom: 26 }} />
    <div style={{ fontSize: 42, fontWeight: 820, marginBottom: 18 }}>{title}</div>
    <div style={{ fontSize: 27, lineHeight: 1.42, color: muted }}>{detail}</div>
  </div>
);

const Cover: Page = () => (
  <section style={{ ...page, padding: '132px 120px' }}>
    <CircuitMark />
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1120 }}>
      <div style={{ fontSize: 28, color: 'var(--osd-accent)', fontWeight: 780, marginBottom: 46 }}>
        OPEN-SLIDE WITH CODEX
      </div>
      <h1
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 'var(--osd-size-hero)',
          lineHeight: 0.98,
          fontWeight: 900,
          letterSpacing: 0,
          margin: 0,
        }}
      >
        MPU 姿態監測簡報
      </h1>
      <p style={{ fontSize: 42, lineHeight: 1.42, color: muted, maxWidth: 940, margin: '54px 0 0' }}>
        用 React component 寫投影片，Codex 可以直接新增頁面、調整版面，並在瀏覽器即時預覽。
      </p>
    </div>
    <Footer />
  </section>
);

const Pipeline: Page = () => (
  <section style={{ ...page, padding: '118px 120px' }}>
    <h2 style={{ fontSize: 86, lineHeight: 1.08, margin: 0, fontWeight: 880 }}>從感測器到瀏覽器</h2>
    <p style={{ fontSize: 36, lineHeight: 1.45, color: muted, width: 1040, margin: '32px 0 78px' }}>
      範例把 MPU 姿態與 INA219 電力資料整理成一條清楚的展示流程。
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
      <FlowNode title="Serial" detail="板端資料流進 Node server" color="var(--osd-accent)" />
      <div style={{ fontSize: 64, color: amber, fontWeight: 800 }}>→</div>
      <FlowNode title="Parser" detail="轉成姿態角、電壓與電流" color={amber} />
      <div style={{ fontSize: 64, color: amber, fontWeight: 800 }}>→</div>
      <FlowNode title="Viewer" detail="Web UI 即時更新儀表板" color={green} />
      <div style={{ fontSize: 64, color: amber, fontWeight: 800 }}>→</div>
      <FlowNode title="Slide" detail="將重點包成可分享簡報" color={coral} />
    </div>
    <Footer />
  </section>
);

const Dashboard: Page = () => (
  <section style={{ ...page, padding: '112px 120px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 80 }}>
      <div style={{ width: 690 }}>
        <h2 style={{ fontSize: 82, lineHeight: 1.08, margin: 0, fontWeight: 880 }}>投影片也是介面</h2>
        <p style={{ fontSize: 35, lineHeight: 1.48, color: muted, margin: '34px 0 0' }}>
          open-slide 適合把工程狀態、實驗結果、demo 流程做成可維護的簡報。
        </p>
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        <SignalCard label="Pitch" value="+12.4°" caption="姿態角保持穩定" color="var(--osd-accent)" />
        <SignalCard label="Current" value="318mA" caption="負載變化可追蹤" color={amber} />
        <SignalCard label="Voltage" value="5.08V" caption="供電狀態正常" color={green} />
      </div>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 142,
        height: 210,
        borderRadius: 'var(--osd-radius)',
        background: '#223236',
        border: '3px solid #33484d',
        display: 'flex',
        alignItems: 'end',
        gap: 18,
        padding: '30px 36px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 74, height: 72, background: '#4fb0a8', borderRadius: 6 }} />
      <div style={{ width: 74, height: 118, background: '#d99721', borderRadius: 6 }} />
      <div style={{ width: 74, height: 96, background: '#4fb0a8', borderRadius: 6 }} />
      <div style={{ width: 74, height: 150, background: '#d95f43', borderRadius: 6 }} />
      <div style={{ width: 74, height: 132, background: '#4fb0a8', borderRadius: 6 }} />
      <div style={{ width: 74, height: 170, background: '#d99721', borderRadius: 6 }} />
      <div style={{ width: 74, height: 104, background: '#4fb0a8', borderRadius: 6 }} />
      <div style={{ width: 74, height: 142, background: '#d95f43', borderRadius: 6 }} />
      <div style={{ marginLeft: 'auto', color: '#dce7e3', fontSize: 28, alignSelf: 'center' }}>
        telemetry sample window
      </div>
    </div>
    <Footer />
  </section>
);

export const meta: SlideMeta = {
  title: 'MPU 姿態監測簡報',
  createdAt: '2026-05-27T08:47:28.882Z',
};

export default [Cover, Pipeline, Dashboard] satisfies Page[];
