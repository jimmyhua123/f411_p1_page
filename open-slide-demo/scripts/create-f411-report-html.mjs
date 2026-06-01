import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const assetDir = join(root, 'slides', 'f411-report', 'assets');
const out = join(root, 'exports', 'f411-report.html');

const image = (name) => {
  const data = readFileSync(join(assetDir, name)).toString('base64');
  return `data:image/png;base64,${data}`;
};

const img = {
  breadboard: image('breadboard.png'),
  desktopMain: image('desktop-main.png'),
  desktopPower: image('desktop-power.png'),
  schematic1: image('schematic-1.png'),
  schematic2: image('schematic-2.png'),
  pcbLayout: image('pcb-layout.png'),
  pcb3d: image('pcb-3d.png'),
};

const slides = [
  {
    eyebrow: '專題成果報告',
    title: 'STM32F411<br>頭部追蹤音訊系統',
    body: '從 AI 專案設計、麵包板驗證、韌體完成，到桌面監測頁面與 PCB layout 的完整開發流程。',
    image: img.pcb3d,
    imageLabel: '3D PCB preview',
    type: 'cover',
  },
  {
    eyebrow: '開發流程',
    title: '從概念到板級設計',
    type: 'roadmap',
    steps: [
      ['1', 'AI 設計專案', '規劃系統架構、資料流與韌體模組邊界。'],
      ['2', '麵包板接線', '把全部元件接上，驗證感測、音訊、電源與 SD。'],
      ['3', 'AI 輔助韌體', '完成姿態、音訊、模式、故障與 telemetry。'],
      ['4', '桌面 HTML', '與硬體連線成功，顯示狀態並測試功能。'],
      ['5', 'Schematic / PCB', '把模組元件轉為直接 IC 與板級電路連接。'],
    ],
  },
  {
    eyebrow: '系統架構',
    title: '姿態輸入控制雙聲道音訊',
    type: 'architecture',
  },
  {
    eyebrow: '硬體原型',
    title: '麵包板完成全部元件接線',
    body: '先用模組快速驗證電氣與通訊可行性，再把確認可運作的連接轉成 schematic 與 PCB。',
    type: 'split-image',
    image: img.breadboard,
    imageLabel: 'Breadboard prototype',
    bullets: [
      'MPU6500 I2C 姿態感測正常。',
      '左右 MAX98357A 由 I2S2 / I2S3 輸出音訊。',
      'INA219 量測音訊電源軌電壓與電流。',
      'AO3401 控制 LOW_POWER 音訊供電切斷。',
      'MicroSD 可寫入 CSV log。',
    ],
  },
  {
    eyebrow: '韌體完成項目',
    title: '主迴圈整合感測、音訊與電源策略',
    type: 'firmware',
  },
  {
    eyebrow: '頭部控制音訊',
    title: '用姿態改變左右聲道輸出',
    type: 'audio',
  },
  {
    eyebrow: '電源監測與低功耗',
    title: 'AO3401 讓 LOW_POWER 真的切斷音訊電源',
    type: 'power',
  },
  {
    eyebrow: '桌面 HTML Page',
    title: '與硬體連線成功並測試功能正常',
    type: 'desktop',
  },
  {
    eyebrow: '電路圖與 PCB Layout',
    title: '把麵包板模組轉成直接 IC 連接',
    type: 'pcb',
  },
  {
    eyebrow: '驗證結果',
    title: '主要功能皆已完成驗證',
    type: 'evidence',
  },
  {
    eyebrow: '結論',
    title: '完成可展示的嵌入式系統開發流程',
    type: 'conclusion',
  },
];

const colors = ['teal', 'blue', 'amber', 'green', 'coral'];
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const frame = (src, label, cls = '') => `
  <figure class="image-frame ${cls}">
    <img src="${src}" alt="${escapeHtml(label)}">
    <figcaption>${escapeHtml(label)}</figcaption>
  </figure>
`;

const bullets = (items) => `
  <ul class="bullets">
    ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
  </ul>
`;

const stat = (label, value, note, color = 'teal') => `
  <div class="stat ${color}">
    <div class="bar"></div>
    <div class="label">${escapeHtml(label)}</div>
    <div class="value">${escapeHtml(value)}</div>
    <div class="note">${escapeHtml(note)}</div>
  </div>
`;

const footer = (index) => `
  <footer>
    <span>STM32F411 Head-Tracking Audio</span>
    <span>${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</span>
  </footer>
`;

function renderSlide(slide, index) {
  const head = `
    <div class="eyebrow">${escapeHtml(slide.eyebrow)}</div>
    <h1>${slide.title}</h1>
  `;

  let content = '';
  if (slide.type === 'cover') {
    content = `
      <section class="page cover">
        <div class="cover-copy">
          ${head}
          <p>${escapeHtml(slide.body)}</p>
          <div class="pills">
            <span>MPU6500</span><span>MAX98357A</span><span>INA219</span><span>AO3401</span>
          </div>
        </div>
        ${frame(slide.image, slide.imageLabel, 'cover-image')}
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'roadmap') {
    content = `
      <section class="page">
        ${head}
        <div class="roadmap">
          ${slide.steps
            .map(
              ([num, title, body], stepIndex) => `
                <article class="step ${colors[stepIndex]}">
                  <div class="num">${num}</div>
                  <h2>${escapeHtml(title)}</h2>
                  <p>${escapeHtml(body)}</p>
                </article>
              `,
            )
            .join('')}
        </div>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'architecture') {
    content = `
      <section class="page">
        ${head}
        <div class="two-col">
          <div class="stack">
            ${stat('Controller', 'STM32F411', 'HAL / CubeMX 初始化，App_MainLoop 排程。', 'teal')}
            ${stat('Sensor', 'MPU6500', 'I2C1 讀取 raw accel，計算 roll / pitch。', 'blue')}
            ${stat('Audio', '2x I2S DMA', 'I2S2 / I2S3 驅動左右 MAX98357A。', 'amber')}
          </div>
          <pre>MPU6500 raw data
  -> roll / pitch calculation
  -> low-pass filter
  -> head state machine
  -> audio control
  -> volume smoother
  -> I2S DMA output

Telemetry / CSV
  -> desktop HTML page
  -> log analysis</pre>
        </div>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'split-image') {
    content = `
      <section class="page split">
        <div>
          ${head}
          <p class="lead">${escapeHtml(slide.body)}</p>
          ${bullets(slide.bullets)}
        </div>
        ${frame(slide.image, slide.imageLabel, 'big-image')}
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'firmware') {
    content = `
      <section class="page">
        ${head}
        <div class="two-col">
          <pre class="dark">Reset
  -> main()
  -> HAL / peripheral init
  -> App_Init()
  -> while (1)
       -> App_MainLoop()

App_MainLoop
  button / fault / power
  IMU read / filter
  head state
  audio target
  telemetry / CSV</pre>
          ${bullets([
            'ACTIVE、MUTED、LOW_POWER、DIAGNOSTIC、FAULT 模式。',
            'CENTER、LEFT、RIGHT、DOWN、UP 頭部狀態機。',
            'roll-based stereo panning 與 HEAD_DOWN mute。',
            'fault flags、LED 狀態、按鍵短按與長按。',
            'SIM / SIM2 / SIM3 / PWR telemetry 與 MicroSD CSV。',
          ])}
        </div>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'audio') {
    content = `
      <section class="page">
        ${head}
        <div class="stats-four">
          ${stat('CENTER', 'L=1.00 R=1.00', 'roll 接近 0 度，左右聲道正常輸出。', 'teal')}
          ${stat('LEFT', 'R 降低', 'roll < -25 度，右聲道降到約 30%。', 'blue')}
          ${stat('RIGHT', 'L 降低', 'roll > 25 度，左聲道降到約 30%。', 'amber')}
          ${stat('DOWN', 'Mute', 'pitch < -35 度，左右目標音量歸零。', 'coral')}
        </div>
        <div class="wide-note">
          <strong>防抖設計</strong><span>使用 enter / exit 門檻 hysteresis，避免頭部角度在邊界附近來回切換。</span>
          <strong>音量保護</strong><span>使用 volume smoother 降低音量變化造成的 click / pop。</span>
        </div>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'power') {
    content = `
      <section class="page">
        ${head}
        <div class="two-col">
          <pre>5V_AUDIO_IN
  -> INA219 VIN+
  -> INA219 VIN-
  -> AO3401 Source
  -> AO3401 Drain
  -> 5V_AUDIO_SW
  -> MAX98357A VIN

PB8 -> level shifter -> Gate</pre>
          <div class="stack">
            ${stat('ACTIVE 20%', '18.0 mA', '音訊輸出時的音訊電源軌電流。', 'teal')}
            ${stat('HEAD_DOWN', '5.6 mA', '軟體靜音仍有模組待機消耗。', 'amber')}
            ${stat('LOW_POWER', '~0 mA', 'AO3401 關閉後接近 0 mA，AUDIO_RAIL_CUTOFF=PASS。', 'green')}
          </div>
        </div>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'desktop') {
    content = `
      <section class="page">
        ${head}
        <div class="image-grid two">
          ${frame(img.desktopMain, 'Main dashboard')}
          ${frame(img.desktopPower, 'Power monitor')}
        </div>
        <p class="caption-line">頁面可讀取 telemetry，顯示 IMU 姿態、頭部方向、音訊狀態與 INA219 power 監測結果。</p>
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'pcb') {
    content = `
      <section class="page">
        ${head}
        <div class="image-grid three">
          ${frame(img.schematic1, 'Schematic 1')}
          ${frame(img.schematic2, 'Schematic 2')}
          ${frame(img.pcb3d, '3D PCB')}
        </div>
        ${frame(img.pcbLayout, 'PCB layout', 'layout-wide')}
        ${footer(index)}
      </section>
    `;
  } else if (slide.type === 'evidence') {
    const rows = [
      ['MPU6500 IMU', 'WHO_AM_I read'],
      ['Roll / pitch', 'Telemetry and log fields'],
      ['Dual audio', 'I2S2 / I2S3 DMA'],
      ['Head state', 'CENTER / LEFT / RIGHT / DOWN / UP'],
      ['Audio rail cutoff', 'AO3401 + INA219, PASS'],
      ['MicroSD logging', 'LOG000.CSV, 133 rows'],
      ['UART telemetry', 'SIM / SIM2 / SIM3 / PWR'],
      ['Desktop page', 'Hardware connected and tested'],
      ['PCB design', 'Schematic + layout + 3D preview'],
    ];
    content = `
      <section class="page">
        ${head}
        <div class="evidence">
          ${rows
            .map(
              ([title, body], i) => `
                <article class="${colors[i % colors.length]}">
                  <div class="bar"></div>
                  <h2>${escapeHtml(title)}</h2>
                  <p>${escapeHtml(body)}</p>
                </article>
              `,
            )
            .join('')}
        </div>
        ${footer(index)}
      </section>
    `;
  } else {
    content = `
      <section class="page conclusion">
        <div>
          ${head}
          <p class="lead">本專案已從 AI 設計、麵包板驗證、韌體實作、桌面監測，到 schematic 與 PCB layout 完成閉環。最重要的成果是 LOW_POWER 模式由軟體靜音進一步做到硬體切斷音訊電源軌。</p>
          ${bullets([
            '軟體靜音約 5.6 mA，硬體切斷後接近 0 mA。',
            '桌面 HTML page 已能讀取硬體 telemetry。',
            'PCB layout 已把外接模組轉為板級 IC 連接。',
          ])}
        </div>
        <div class="stack">
          ${stat('Next', 'PCB 實板', '後續可進行製板、焊接與上電測試。', 'teal')}
          ${stat('Improve', 'Log / UI', '擴充電流趨勢圖、fault history 與完整測試流程。', 'amber')}
          ${stat('Optional', 'Sensor fusion', '若需要完整 3D 姿態，可加入 gyro fusion 或 yaw 估測。', 'blue')}
        </div>
        ${footer(index)}
      </section>
    `;
  }

  return content;
}

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>STM32F411 頭部追蹤音訊系統報告</title>
<style>
@page { size: 1920px 1080px; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #17202a;
  font-family: "Microsoft JhengHei", "Noto Sans TC", "Segoe UI", system-ui, sans-serif;
}
.page {
  width: 1920px;
  height: 1080px;
  position: relative;
  overflow: hidden;
  padding: 86px 92px;
  background: #f7f9fb;
  break-after: page;
  page-break-after: always;
}
.page:last-child { break-after: auto; page-break-after: auto; }
footer {
  position: absolute;
  left: 92px;
  right: 92px;
  bottom: 48px;
  display: flex;
  justify-content: space-between;
  color: #5b6773;
  font-size: 22px;
}
.eyebrow { font-size: 24px; color: #00857a; font-weight: 820; margin-bottom: 22px; }
h1 { margin: 0; font-size: 72px; line-height: 1.08; font-weight: 860; letter-spacing: 0; }
.cover {
  display: grid;
  grid-template-columns: 760px 1fr;
  gap: 58px;
  background: linear-gradient(90deg, #f7f9fb 0%, #f7f9fb 48%, #e8f3f1 48%, #e8f3f1 100%);
}
.cover h1 { font-size: 96px; line-height: 1.05; font-weight: 900; }
.cover p, .lead { margin: 38px 0 0; font-size: 34px; line-height: 1.44; color: #5b6773; }
.cover-copy { padding-top: 42px; }
.pills { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 42px; }
.pills span {
  height: 42px;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(0,133,122,.12);
  color: #00857a;
  font-size: 22px;
  font-weight: 780;
}
.image-frame {
  margin: 0;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  position: relative;
}
.image-frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
.image-frame figcaption {
  position: absolute;
  left: 20px;
  bottom: 18px;
  background: rgba(23,32,42,.82);
  color: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 20px;
  font-weight: 700;
}
.cover-image { height: 790px; }
.roadmap { margin-top: 62px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 22px; }
.step {
  background: #fff;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  min-height: 420px;
  padding: 28px;
}
.num {
  width: 58px;
  height: 58px;
  border-radius: 12px;
  background: #00857a;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 850;
  margin-bottom: 28px;
}
.step.blue .num { background: #2f6fbb; }
.step.amber .num { background: #c8891a; }
.step.green .num { background: #2d7a46; }
.step.coral .num { background: #d3543f; }
.step h2 { font-size: 34px; line-height: 1.16; margin: 0 0 22px; }
.step p { font-size: 25px; line-height: 1.42; color: #5b6773; margin: 0; }
.two-col { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 34px; }
.split { display: grid; grid-template-columns: 650px 1fr; gap: 54px; align-items: start; }
.big-image { height: 820px; }
.stack { display: grid; gap: 20px; }
.stat {
  background: #fff;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  padding: 28px;
  min-height: 176px;
}
.stat .bar, .evidence .bar { width: 56px; height: 8px; border-radius: 999px; background: #00857a; margin-bottom: 24px; }
.stat .label { font-size: 24px; color: #5b6773; margin-bottom: 12px; }
.stat .value { font-size: 50px; font-weight: 860; line-height: 1.02; margin-bottom: 12px; }
.stat .note { font-size: 22px; line-height: 1.36; color: #5b6773; }
.stat.blue .bar, .blue .bar { background: #2f6fbb; }
.stat.amber .bar, .amber .bar { background: #c8891a; }
.stat.green .bar, .green .bar { background: #2d7a46; }
.stat.coral .bar, .coral .bar { background: #d3543f; }
pre {
  margin: 0;
  background: #fff;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  padding: 50px;
  font-size: 30px;
  line-height: 1.48;
  font-family: Consolas, "Cascadia Mono", monospace;
  white-space: pre-wrap;
}
pre.dark { background: #1f2b37; color: #eff5f8; border: 0; }
.bullets { margin: 36px 0 0; padding: 0; list-style: none; display: grid; gap: 18px; }
.bullets li { font-size: 30px; line-height: 1.38; padding-left: 30px; position: relative; }
.bullets li::before {
  content: "";
  position: absolute;
  left: 0;
  top: .62em;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #00857a;
}
.stats-four { margin-top: 58px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.wide-note {
  margin-top: 42px;
  background: #fff;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  padding: 28px 34px;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 22px 26px;
  font-size: 30px;
}
.wide-note span { color: #5b6773; }
.image-grid { margin-top: 40px; display: grid; gap: 28px; }
.image-grid.two { grid-template-columns: 1fr 1fr; }
.image-grid.two .image-frame { height: 655px; }
.image-grid.three { grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
.image-grid.three .image-frame { height: 320px; }
.layout-wide { height: 390px; margin-top: 24px; }
.caption-line { margin: 26px 0 0; font-size: 28px; line-height: 1.38; color: #5b6773; }
.evidence { margin-top: 46px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.evidence article {
  background: #fff;
  border: 2px solid #d6dee6;
  border-radius: 8px;
  padding: 24px;
  min-height: 132px;
}
.evidence h2 { margin: 0 0 10px; font-size: 30px; }
.evidence p { margin: 0; font-size: 23px; color: #5b6773; line-height: 1.32; }
.conclusion { display: grid; grid-template-columns: 1fr 580px; gap: 64px; align-items: center; }
.conclusion h1 { font-size: 78px; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
${slides.map(renderSlide).join('\n')}
</body>
</html>`;

mkdirSync(join(root, 'exports'), { recursive: true });
writeFileSync(out, html, 'utf8');
console.log(out);
