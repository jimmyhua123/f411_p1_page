import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = join(process.cwd(), 'exports', 'f411-report.pptx');
const assetDir = join(process.cwd(), 'slides', 'f411-report', 'assets');

const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

const W = 12192000;
const H = 6858000;
const SLIDES = 11;
const emu = (px) => Math.round(px * 635);
const hex = (value) => value.replace('#', '').toUpperCase();
const xml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const colors = {
  bg: 'F7F9FB',
  ink: '17202A',
  muted: '5B6773',
  panel: 'FFFFFF',
  line: 'D6DEE6',
  teal: '00857A',
  amber: 'C8891A',
  coral: 'D3543F',
  blue: '2F6FBB',
  green: '2D7A46',
  dark: '1F2B37',
  light: 'EFF5F8',
};

const media = {
  breadboard: 'breadboard.png',
  desktopMain: 'desktop-main.png',
  desktopPower: 'desktop-power.png',
  schematic1: 'schematic-1.png',
  schematic2: 'schematic-2.png',
  pcbLayout: 'pcb-layout.png',
  pcb3d: 'pcb-3d.png',
};

let shapeId = 1;

function nextShape(name) {
  shapeId += 1;
  return { id: shapeId, name };
}

function rect(x, y, w, h, fill, opts = {}) {
  const { id, name } = nextShape(opts.name ?? 'Rectangle');
  const outline = opts.line
    ? `<a:ln w="${opts.lineWidth ?? 12700}"><a:solidFill><a:srgbClr val="${hex(opts.line)}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
    <a:prstGeom prst="${opts.radius ? 'roundRect' : 'rect'}"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${hex(fill)}"/></a:solidFill>
    ${outline}
  </p:spPr>
</p:sp>`;
}

function textBox(x, y, w, h, text, opts = {}) {
  const { id, name } = nextShape(opts.name ?? 'Text');
  const size = Math.round((opts.size ?? 30) * 100);
  const color = hex(opts.color ?? colors.ink);
  const weight = opts.bold ? '<a:b/>' : '';
  const align = opts.align ? `<a:pPr algn="${opts.align}"/>` : '';
  const paragraphs = String(text)
    .split('\n')
    .map(
      (line) =>
        `<a:p>${align}<a:r><a:rPr lang="zh-TW" sz="${size}" dirty="0">${weight}<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:ea typeface="Microsoft JhengHei"/></a:rPr><a:t>${xml(line)}</a:t></a:r><a:endParaRPr lang="zh-TW" sz="${size}"/></a:p>`,
    )
    .join('');

  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/><a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="${opts.anchor ?? 't'}"/><a:lstStyle/>${paragraphs}</p:txBody>
</p:sp>`;
}

function image(x, y, w, h, relId, name) {
  const { id } = nextShape(name);
  return `<p:pic>
  <p:nvPicPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
  <p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;
}

function imageFrame(x, y, w, h, relId, label) {
  return [
    rect(x, y, w, h, colors.panel, { line: colors.line, radius: true }),
    image(x + 8, y + 8, w - 16, h - 16, relId, label),
    rect(x + 20, y + h - 54, 250, 36, colors.dark, { radius: true }),
    textBox(x + 32, y + h - 48, 225, 24, label, { size: 15, color: 'FFFFFF', bold: true }),
  ].join('');
}

function stat(x, y, w, h, label, value, note, color) {
  return [
    rect(x, y, w, h, colors.panel, { line: colors.line, radius: true }),
    rect(x + 24, y + 24, 50, 8, color, { radius: true }),
    textBox(x + 24, y + 56, w - 48, 32, label, { size: 18, color: colors.muted }),
    textBox(x + 24, y + 92, w - 48, 54, value, { size: 36, bold: true }),
    textBox(x + 24, y + 152, w - 48, h - 160, note, { size: 17, color: colors.muted }),
  ].join('');
}

function bulletList(x, y, w, items, size = 22, gap = 42) {
  return items
    .map((item, index) =>
      [
        rect(x, y + index * gap + 11, 9, 9, colors.teal, { radius: true }),
        textBox(x + 24, y + index * gap, w - 24, gap, item, { size }),
      ].join(''),
    )
    .join('');
}

function footer(n) {
  return [
    textBox(92, 998, 620, 32, 'STM32F411 Head-Tracking Audio', { size: 16, color: colors.muted }),
    textBox(1640, 998, 190, 32, `${String(n).padStart(2, '0')} / ${String(SLIDES).padStart(2, '0')}`, {
      size: 16,
      color: colors.muted,
      align: 'r',
    }),
  ].join('');
}

function title(y, eyebrow, heading, size = 54) {
  return [
    textBox(92, y, 620, 30, eyebrow, { size: 18, color: colors.teal, bold: true }),
    textBox(92, y + 42, 1200, 90, heading, { size, bold: true }),
  ].join('');
}

function slide(body, n) {
  shapeId = 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
      ${rect(0, 0, 1920, 1080, colors.bg)}
      ${body}
      ${footer(n)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRel(images = []) {
  const imageRels = images
    .map(
      (name, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media[name]}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRels}</Relationships>`;
}

const slideData = [
  {
    images: ['pcb3d'],
    body: [
      rect(930, 0, 990, 1080, 'E8F3F1'),
      textBox(92, 130, 520, 34, '專題成果報告', { size: 20, color: colors.teal, bold: true }),
      textBox(92, 210, 740, 220, 'STM32F411\n頭部追蹤音訊系統', { size: 72, bold: true }),
      textBox(92, 495, 780, 150, '從 AI 專案設計、麵包板驗證、韌體完成，到桌面監測頁面與 PCB layout 的完整開發流程。', {
        size: 25,
        color: colors.muted,
      }),
      imageFrame(1040, 145, 760, 760, 'rId2', '3D PCB preview'),
      stat(92, 720, 170, 125, 'Sensor', 'MPU6500', '姿態輸入', colors.teal),
      stat(286, 720, 190, 125, 'Audio', 'MAX98357A', '雙 I2S', colors.blue),
      stat(500, 720, 160, 125, 'Power', 'INA219', '電源監測', colors.amber),
      stat(684, 720, 160, 125, 'Switch', 'AO3401', '電源切斷', colors.coral),
    ].join(''),
  },
  {
    body: [
      title(78, '開發流程', '從概念到板級設計', 52),
      ...[
        ['1', 'AI 設計專案', '規劃系統架構、資料流與韌體模組邊界。', colors.teal],
        ['2', '麵包板接線', '把全部元件接上，驗證感測、音訊、電源與 SD。', colors.blue],
        ['3', 'AI 輔助韌體', '完成姿態、音訊、模式、故障與 telemetry。', colors.amber],
        ['4', '桌面 HTML', '與硬體連線成功，顯示狀態並測試功能。', colors.green],
        ['5', 'Schematic / PCB', '把模組元件轉為直接 IC 與板級電路連接。', colors.coral],
      ].map(([num, head, body, color], i) =>
        [
          rect(92 + i * 352, 310, 320, 430, colors.panel, { line: colors.line, radius: true }),
          rect(120 + i * 352, 342, 58, 58, color, { radius: true }),
          textBox(138 + i * 352, 354, 30, 34, num, { size: 22, color: 'FFFFFF', bold: true, align: 'ctr' }),
          textBox(120 + i * 352, 430, 260, 70, head, { size: 27, bold: true }),
          textBox(120 + i * 352, 535, 250, 135, body, { size: 20, color: colors.muted }),
        ].join(''),
      ),
    ].join(''),
  },
  {
    body: [
      title(78, '系統架構', '姿態輸入控制雙聲道音訊', 52),
      stat(92, 255, 460, 168, 'Controller', 'STM32F411', 'HAL / CubeMX 初始化，App_MainLoop 排程。', colors.teal),
      stat(92, 455, 460, 168, 'Sensor', 'MPU6500', 'I2C1 讀取 raw accel，計算 roll / pitch。', colors.blue),
      stat(92, 655, 460, 168, 'Audio', '2x I2S DMA', 'I2S2 / I2S3 驅動左右 MAX98357A。', colors.amber),
      rect(650, 255, 1120, 568, colors.panel, { line: colors.line, radius: true }),
      textBox(
        705,
        305,
        1010,
        460,
        'MPU6500 raw data\n  -> roll / pitch calculation\n  -> low-pass filter\n  -> head state machine\n  -> audio control\n  -> volume smoother\n  -> I2S DMA output\n\nTelemetry / CSV\n  -> desktop HTML page\n  -> log analysis',
        { size: 27, color: colors.ink },
      ),
    ].join(''),
  },
  {
    images: ['breadboard'],
    body: [
      textBox(92, 86, 520, 30, '硬體原型', { size: 18, color: colors.teal, bold: true }),
      textBox(92, 132, 570, 130, '麵包板完成全部元件接線', { size: 44, bold: true }),
      textBox(92, 292, 590, 110, '先用模組快速驗證電氣與通訊可行性，再把確認可運作的連接轉成 schematic 與 PCB。', {
        size: 23,
        color: colors.muted,
      }),
      bulletList(92, 455, 610, ['MPU6500 I2C 姿態感測正常。', '左右 MAX98357A 由 I2S2 / I2S3 輸出音訊。', 'INA219 量測音訊電源軌電壓與電流。', 'AO3401 控制 LOW_POWER 音訊供電切斷。', 'MicroSD 可寫入 CSV log。'], 22, 48),
      imageFrame(745, 92, 1070, 820, 'rId2', 'Breadboard prototype'),
    ].join(''),
  },
  {
    body: [
      title(78, '韌體完成項目', '主迴圈整合感測、音訊與電源策略', 48),
      rect(92, 255, 815, 570, colors.dark, { radius: true }),
      textBox(
        135,
        305,
        740,
        470,
        'Reset\n  -> main()\n  -> HAL / peripheral init\n  -> App_Init()\n  -> while (1)\n       -> App_MainLoop()\n\nApp_MainLoop\n  button / fault / power\n  IMU read / filter\n  head state\n  audio target\n  telemetry / CSV',
        { size: 24, color: colors.light },
      ),
      rect(955, 255, 820, 570, colors.panel, { line: colors.line, radius: true }),
      bulletList(1000, 315, 720, ['ACTIVE、MUTED、LOW_POWER、DIAGNOSTIC、FAULT 模式。', 'CENTER、LEFT、RIGHT、DOWN、UP 頭部狀態機。', 'roll-based stereo panning 與 HEAD_DOWN mute。', 'fault flags、LED 狀態、按鍵短按與長按。', 'SIM / SIM2 / SIM3 / PWR telemetry 與 MicroSD CSV。'], 24, 74),
    ].join(''),
  },
  {
    body: [
      title(78, '頭部控制音訊', '用姿態改變左右聲道輸出', 52),
      stat(92, 285, 410, 215, 'CENTER', 'L=1.00 R=1.00', 'roll 接近 0 度，左右聲道正常輸出。', colors.teal),
      stat(522, 285, 410, 215, 'LEFT', 'R 降低', 'roll < -25 度，右聲道降到約 30%。', colors.blue),
      stat(952, 285, 410, 215, 'RIGHT', 'L 降低', 'roll > 25 度，左聲道降到約 30%。', colors.amber),
      stat(1382, 285, 410, 215, 'DOWN', 'Mute', 'pitch < -35 度，左右目標音量歸零。', colors.coral),
      rect(92, 580, 1700, 210, colors.panel, { line: colors.line, radius: true }),
      textBox(135, 625, 250, 45, '防抖設計', { size: 27, bold: true }),
      textBox(380, 625, 1320, 45, '使用 enter / exit 門檻 hysteresis，避免頭部角度在邊界附近來回切換。', { size: 25, color: colors.muted }),
      textBox(135, 700, 250, 45, '音量保護', { size: 27, bold: true }),
      textBox(380, 700, 1320, 45, '使用 volume smoother 降低音量變化造成的 click / pop。', { size: 25, color: colors.muted }),
    ].join(''),
  },
  {
    body: [
      title(78, '電源監測與低功耗', 'AO3401 讓 LOW_POWER 真的切斷音訊電源', 47),
      rect(92, 260, 800, 560, colors.panel, { line: colors.line, radius: true }),
      textBox(
        140,
        315,
        705,
        430,
        '5V_AUDIO_IN\n  -> INA219 VIN+\n  -> INA219 VIN-\n  -> AO3401 Source\n  -> AO3401 Drain\n  -> 5V_AUDIO_SW\n  -> MAX98357A VIN\n\nPB8 -> level shifter -> Gate',
        { size: 25 },
      ),
      stat(955, 260, 820, 160, 'ACTIVE 20%', '18.0 mA', '音訊輸出時的音訊電源軌電流。', colors.teal),
      stat(955, 460, 820, 160, 'HEAD_DOWN', '5.6 mA', '軟體靜音仍有模組待機消耗。', colors.amber),
      stat(955, 660, 820, 160, 'LOW_POWER', '~0 mA', 'AO3401 關閉後接近 0 mA，AUDIO_RAIL_CUTOFF=PASS。', colors.green),
    ].join(''),
  },
  {
    images: ['desktopMain', 'desktopPower'],
    body: [
      title(78, '桌面 HTML Page', '與硬體連線成功並測試功能正常', 50),
      imageFrame(92, 245, 835, 560, 'rId2', 'Main dashboard'),
      imageFrame(960, 245, 835, 560, 'rId3', 'Power monitor'),
      textBox(92, 845, 1500, 42, '頁面可讀取 telemetry，顯示 IMU 姿態、頭部方向、音訊狀態與 INA219 power 監測結果。', {
        size: 22,
        color: colors.muted,
      }),
    ].join(''),
  },
  {
    images: ['schematic1', 'schematic2', 'pcb3d', 'pcbLayout'],
    body: [
      title(78, '電路圖與 PCB Layout', '把麵包板模組轉成直接 IC 連接', 49),
      imageFrame(92, 250, 550, 285, 'rId2', 'Schematic 1'),
      imageFrame(682, 250, 550, 285, 'rId3', 'Schematic 2'),
      imageFrame(1272, 250, 520, 285, 'rId4', '3D PCB'),
      imageFrame(92, 565, 1700, 360, 'rId5', 'PCB layout'),
    ].join(''),
  },
  {
    body: [
      title(78, '驗證結果', '主要功能皆已完成驗證', 52),
      ...[
        ['MPU6500 IMU', 'WHO_AM_I read', colors.teal],
        ['Roll / pitch', 'Telemetry and log fields', colors.blue],
        ['Dual audio', 'I2S2 / I2S3 DMA', colors.amber],
        ['Head state', 'CENTER / LEFT / RIGHT / DOWN / UP', colors.green],
        ['Audio rail cutoff', 'AO3401 + INA219, PASS', colors.coral],
        ['MicroSD logging', 'LOG000.CSV, 133 rows', colors.teal],
        ['UART telemetry', 'SIM / SIM2 / SIM3 / PWR', colors.blue],
        ['Desktop page', 'Hardware connected and tested', colors.amber],
        ['PCB design', 'Schematic + layout + 3D preview', colors.green],
      ].map(([head, body, color], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 92 + col * 580;
        const y = 275 + row * 185;
        return [
          rect(x, y, 530, 145, colors.panel, { line: colors.line, radius: true }),
          rect(x + 24, y + 24, 44, 8, color, { radius: true }),
          textBox(x + 24, y + 50, 465, 40, head, { size: 24, bold: true }),
          textBox(x + 24, y + 94, 465, 36, body, { size: 18, color: colors.muted }),
        ].join('');
      }),
    ].join(''),
  },
  {
    body: [
      textBox(92, 105, 520, 30, '結論', { size: 18, color: colors.teal, bold: true }),
      textBox(92, 162, 1040, 155, '完成可展示的嵌入式系統開發流程', { size: 58, bold: true }),
      textBox(
        92,
        350,
        950,
        145,
        '本專案已從 AI 設計、麵包板驗證、韌體實作、桌面監測，到 schematic 與 PCB layout 完成閉環。最重要的成果是 LOW_POWER 模式由軟體靜音進一步做到硬體切斷音訊電源軌。',
        { size: 25, color: colors.muted },
      ),
      bulletList(92, 555, 930, ['軟體靜音約 5.6 mA，硬體切斷後接近 0 mA。', '桌面 HTML page 已能讀取硬體 telemetry。', 'PCB layout 已把外接模組轉為板級 IC 連接。'], 24, 58),
      stat(1160, 180, 580, 180, 'Next', 'PCB 實板', '後續可進行製板、焊接與上電測試。', colors.teal),
      stat(1160, 410, 580, 180, 'Improve', 'Log / UI', '擴充電流趨勢圖、fault history 與完整測試流程。', colors.amber),
      stat(1160, 640, 580, 180, 'Optional', 'Sensor fusion', '若需要完整 3D 姿態，可加入 gyro fusion 或 yaw 估測。', colors.blue),
    ].join(''),
  },
];

const files = {
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideData.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
</Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${SLIDES}</Slides></Properties>`,
  'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>STM32F411 頭部追蹤音訊系統報告</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-06-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-01T00:00:00Z</dcterms:modified></cp:coreProperties>`,
  'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideData.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>
  <p:sldSz cx="${W}" cy="${H}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
  'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideData.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n  ')}
</Relationships>`,
  'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
  'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
  'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${NS.a}" name="Codex Theme"><a:themeElements><a:clrScheme name="Codex"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${colors.ink}"/></a:dk2><a:lt2><a:srgbClr val="${colors.bg}"/></a:lt2><a:accent1><a:srgbClr val="${colors.teal}"/></a:accent1><a:accent2><a:srgbClr val="${colors.amber}"/></a:accent2><a:accent3><a:srgbClr val="${colors.green}"/></a:accent3><a:accent4><a:srgbClr val="${colors.coral}"/></a:accent4><a:accent5><a:srgbClr val="${colors.blue}"/></a:accent5><a:accent6><a:srgbClr val="${colors.line}"/></a:accent6><a:hlink><a:srgbClr val="${colors.teal}"/></a:hlink><a:folHlink><a:srgbClr val="${colors.coral}"/></a:folHlink></a:clrScheme><a:fontScheme name="Codex"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Microsoft JhengHei"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Microsoft JhengHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="Codex"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
};

slideData.forEach((entry, index) => {
  files[`ppt/slides/slide${index + 1}.xml`] = slide(entry.body, index + 1);
  files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRel(entry.images ?? []);
});

for (const file of Object.values(media)) {
  files[`ppt/media/${file}`] = readFileSync(join(assetDir, file));
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function makeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const header = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuffer.length),
      u16(0),
      nameBuffer,
    ]);
    local.push(header, data);

    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBuffer.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBuffer,
      ]),
    );

    offset += header.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(central.length),
    u16(central.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...local, ...central, end]);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, makeZip(files));
console.log(out);
