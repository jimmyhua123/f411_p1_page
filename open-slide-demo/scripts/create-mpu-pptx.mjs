import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = join(process.cwd(), 'exports', 'mpu-demo.pptx');

const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

const W = 12192000;
const H = 6858000;
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
  bg: 'F5F1E8',
  ink: '1F2A2E',
  muted: '637174',
  panel: 'FFFAF0',
  line: 'D8CFC0',
  accent: '0F8B8D',
  amber: 'D99721',
  coral: 'D95F43',
  green: '417B5A',
  dark: '223236',
  light: 'DCE7E3',
};

let shapeId = 1;

function shapeName(name) {
  shapeId += 1;
  return { id: shapeId, name };
}

function rect(x, y, w, h, fill, opts = {}) {
  const { id, name } = shapeName(opts.name ?? 'Rectangle');
  const line = opts.line
    ? `<a:ln w="${opts.lineWidth ?? 19050}"><a:solidFill><a:srgbClr val="${hex(opts.line)}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';
  const radius = opts.radius ? 'roundRect' : 'rect';

  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
    <a:prstGeom prst="${radius}"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${hex(fill)}"/></a:solidFill>
    ${line}
  </p:spPr>
</p:sp>`;
}

function textBox(x, y, w, h, text, opts = {}) {
  const { id, name } = shapeName(opts.name ?? 'Text');
  const size = Math.round((opts.size ?? 32) * 100);
  const weight = opts.bold ? '<a:b/>' : '';
  const align = opts.align ? `<a:pPr algn="${opts.align}"/>` : '';
  const color = hex(opts.color ?? colors.ink);
  const lines = String(text).split('\n');

  const paragraphs = lines
    .map(
      (line) => `<a:p>${align}<a:r><a:rPr lang="zh-TW" sz="${size}" dirty="0">${weight}<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:ea typeface="Microsoft JhengHei"/></a:rPr><a:t>${xml(line)}</a:t></a:r><a:endParaRPr lang="zh-TW" sz="${size}"/></a:p>`,
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

function line(x1, y1, x2, y2, color, opts = {}) {
  const { id, name } = shapeName(opts.name ?? 'Line');
  return `<p:cxnSp>
  <p:nvCxnSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${emu(Math.min(x1, x2))}" y="${emu(Math.min(y1, y2))}"/><a:ext cx="${emu(Math.abs(x2 - x1))}" cy="${emu(Math.abs(y2 - y1))}"/></a:xfrm>
    <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
    <a:ln w="${opts.width ?? 76200}"><a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill></a:ln>
  </p:spPr>
</p:cxnSp>`;
}

function footer(n) {
  return [
    textBox(120, 988, 620, 40, 'MPU + INA219 telemetry', { size: 18, color: colors.muted }),
    textBox(1600, 988, 200, 40, `0${n} / 03`, { size: 18, color: colors.muted, align: 'r' }),
  ].join('');
}

function signalCard(x, label, value, caption, color) {
  return [
    rect(x, 230, 360, 250, colors.panel, { line: colors.line, radius: true }),
    rect(x + 32, 262, 44, 12, color, { radius: true }),
    textBox(x + 32, 306, 250, 38, label, { size: 21, color: colors.muted }),
    textBox(x + 32, 360, 260, 68, value, { size: 43, bold: true }),
    textBox(x + 32, 444, 270, 58, caption, { size: 19, color: colors.muted }),
  ].join('');
}

function flowNode(x, title, detail, color) {
  return [
    rect(x, 390, 330, 230, colors.panel, { line: colors.line, radius: true }),
    rect(x + 34, 424, 54, 54, color, { radius: true }),
    textBox(x + 34, 496, 250, 50, title, { size: 31, bold: true }),
    textBox(x + 34, 562, 255, 64, detail, { size: 20, color: colors.muted }),
  ].join('');
}

function slide(body) {
  shapeId = 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
      ${rect(0, 0, 1920, 1080, colors.bg)}
      ${body}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

const slide1 = slide([
  rect(1330, 112, 500, 500, colors.line, { radius: true }),
  rect(1434, 216, 292, 292, 'BFCFC7', { radius: true }),
  rect(1504, 286, 152, 152, colors.accent, { radius: true }),
  textBox(120, 130, 600, 52, 'OPEN-SLIDE WITH CODEX', { size: 21, bold: true, color: colors.accent }),
  textBox(120, 230, 980, 260, 'MPU 姿態監測簡報', { size: 96, bold: true }),
  textBox(120, 570, 940, 135, '用 React component 寫投影片，Codex 可以直接新增頁面、調整版面，並在瀏覽器即時預覽。', {
    size: 31,
    color: colors.muted,
  }),
  footer(1),
].join(''));

const slide2 = slide([
  textBox(120, 112, 980, 100, '從感測器到瀏覽器', { size: 64, bold: true }),
  textBox(120, 250, 1040, 90, '範例把 MPU 姿態與 INA219 電力資料整理成一條清楚的展示流程。', {
    size: 27,
    color: colors.muted,
  }),
  flowNode(120, 'Serial', '板端資料流進 Node server', colors.accent),
  textBox(480, 470, 60, 60, '→', { size: 46, bold: true, color: colors.amber }),
  flowNode(560, 'Parser', '轉成姿態角、電壓與電流', colors.amber),
  textBox(920, 470, 60, 60, '→', { size: 46, bold: true, color: colors.amber }),
  flowNode(1000, 'Viewer', 'Web UI 即時更新儀表板', colors.green),
  textBox(1360, 470, 60, 60, '→', { size: 46, bold: true, color: colors.amber }),
  flowNode(1440, 'Slide', '將重點包成可分享簡報', colors.coral),
  footer(2),
].join(''));

const bars = [
  [156, 840, 74, 72, colors.accent],
  [248, 794, 74, 118, colors.amber],
  [340, 816, 74, 96, colors.accent],
  [432, 762, 74, 150, colors.coral],
  [524, 780, 74, 132, colors.accent],
  [616, 742, 74, 170, colors.amber],
  [708, 808, 74, 104, colors.accent],
  [800, 770, 74, 142, colors.coral],
]
  .map(([x, y, w, h, color]) => rect(x, y, w, h, color, { radius: true }))
  .join('');

const slide3 = slide([
  textBox(120, 112, 690, 96, '投影片也是介面', { size: 61, bold: true }),
  textBox(120, 250, 690, 130, 'open-slide 適合把工程狀態、實驗結果、demo 流程做成可維護的簡報。', {
    size: 26,
    color: colors.muted,
  }),
  signalCard(760, 'Pitch', '+12.4°', '姿態角保持穩定', colors.accent),
  signalCard(1148, 'Current', '318mA', '負載變化可追蹤', colors.amber),
  signalCard(1536, 'Voltage', '5.08V', '供電狀態正常', colors.green),
  rect(120, 770, 1680, 210, colors.dark, { line: '33484D', radius: true }),
  bars,
  textBox(1395, 846, 330, 44, 'telemetry sample window', { size: 21, color: colors.light }),
  footer(3),
].join(''));

const files = {
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>3</Slides></Properties>`,
  'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>MPU 姿態監測簡報</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-05-27T08:55:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-27T08:55:00Z</dcterms:modified></cp:coreProperties>`,
  'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst>
  <p:sldSz cx="${W}" cy="${H}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
  'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
</Relationships>`,
  'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
  'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
  'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${NS.a}" name="Codex Theme"><a:themeElements><a:clrScheme name="Codex"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${colors.ink}"/></a:dk2><a:lt2><a:srgbClr val="${colors.bg}"/></a:lt2><a:accent1><a:srgbClr val="${colors.accent}"/></a:accent1><a:accent2><a:srgbClr val="${colors.amber}"/></a:accent2><a:accent3><a:srgbClr val="${colors.green}"/></a:accent3><a:accent4><a:srgbClr val="${colors.coral}"/></a:accent4><a:accent5><a:srgbClr val="${colors.muted}"/></a:accent5><a:accent6><a:srgbClr val="${colors.line}"/></a:accent6><a:hlink><a:srgbClr val="${colors.accent}"/></a:hlink><a:folHlink><a:srgbClr val="${colors.coral}"/></a:folHlink></a:clrScheme><a:fontScheme name="Codex"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Microsoft JhengHei"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Microsoft JhengHei"/></a:minorFont></a:fontScheme><a:fmtScheme name="Codex"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
  'ppt/slides/slide1.xml': slide1,
  'ppt/slides/slide2.xml': slide2,
  'ppt/slides/slide3.xml': slide3,
  'ppt/slides/_rels/slide1.xml.rels': slideRel(),
  'ppt/slides/_rels/slide2.xml.rels': slideRel(),
  'ppt/slides/_rels/slide3.xml.rels': slideRel(),
};

function slideRel() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
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
    const data = Buffer.from(content, 'utf8');
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
