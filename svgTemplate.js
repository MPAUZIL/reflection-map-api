/**
 * Generates the Personal Reflection Map SVG with injected percentage values.
 * All visual design is fixed — only the 8 percentage numbers change.
 *
 * Layout (two mirrored halves):
 *   LEFT  = "Me"  (user_*  fields)
 *   RIGHT = "Other" (other_* fields)
 *
 * Each half has 4 radial bars arranged in a compass-like dial:
 *   Top    = Objective   (what was said / what was wanted)
 *   Right  = Facts       (observable information)
 *   Bottom = Emotion     (feelings)
 *   Left   = Interpretation (meaning given)
 */

function clamp(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// Convert a percentage (0-100) into a bar length inside a defined range
function barLen(pct, maxLen = 90) {
  return (clamp(pct) / 100) * maxLen;
}

// Arc path for radial bar (thin donut segment)
function arcPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const s = toRad(startAngle);
  const e = toRad(endAngle);
  const x1 = cx + innerR * Math.cos(s);
  const y1 = cy + innerR * Math.sin(s);
  const x2 = cx + outerR * Math.cos(s);
  const y2 = cy + outerR * Math.sin(s);
  const x3 = cx + outerR * Math.cos(e);
  const y3 = cy + outerR * Math.sin(e);
  const x4 = cx + innerR * Math.cos(e);
  const y4 = cy + innerR * Math.sin(e);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 ${large} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 ${large} 0 ${x1} ${y1} Z`;
}

// Build one radial gauge "petal" given centre, direction angle, and fill %
function petal(cx, cy, angleDeg, pct, color, trackColor = '#e8ecf0') {
  const minR = 38;
  const maxR = 118;
  const halfSpan = 28; // half the angular width of each petal
  const fillR = minR + ((maxR - minR) * clamp(pct)) / 100;

  const startAngle = angleDeg - halfSpan;
  const endAngle   = angleDeg + halfSpan;

  const track = arcPath(cx, cy, minR, maxR, startAngle, endAngle);
  const fill  = arcPath(cx, cy, minR, fillR, startAngle, endAngle);

  return `
    <path d="${track}" fill="${trackColor}" opacity="0.35"/>
    <path d="${fill}"  fill="${color}" opacity="0.92"/>
  `;
}

// Label positioned outside the dial
function label(cx, cy, angleDeg, text, subtext, color) {
  const r = 134;
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  const anchor = Math.abs(Math.cos(rad)) < 0.1
    ? 'middle'
    : Math.cos(rad) > 0 ? 'start' : 'end';
  const dy = Math.sin(rad) > 0.1 ? 14 : (Math.sin(rad) < -0.1 ? -6 : 0);

  return `
    <text x="${x}" y="${y + dy}" text-anchor="${anchor}"
          font-family="'DM Sans', 'Segoe UI', sans-serif" font-size="11"
          font-weight="600" fill="${color}" letter-spacing="0.5">${text}</text>
    <text x="${x}" y="${y + dy + 13}" text-anchor="${anchor}"
          font-family="'DM Sans', 'Segoe UI', sans-serif" font-size="9.5"
          fill="${color}" opacity="0.65">${subtext}%</text>
  `;
}

// Percentage text inside the dial near centre
function centerStats(cx, cy, values, colors) {
  // tiny quadrant labels at inner ring
  const positions = [
    { angle: -90, v: values[0], label: 'OBJ' },
    { angle:   0, v: values[1], label: 'FACT' },
    { angle:  90, v: values[2], label: 'EMO' },
    { angle: 180, v: values[3], label: 'INT' },
  ];
  return positions.map(({ angle, v, label: lbl }, i) => {
    const r = 24;
    const rad = (angle * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    return `
      <text x="${x}" y="${y - 2}" text-anchor="middle"
            font-family="'DM Sans', sans-serif" font-size="7"
            fill="${colors[i]}" font-weight="700" opacity="0.8">${lbl}</text>
      <text x="${x}" y="${y + 8}" text-anchor="middle"
            font-family="'DM Sans', sans-serif" font-size="8.5"
            fill="${colors[i]}" font-weight="700">${Math.round(v)}</text>
    `;
  }).join('');
}

function buildDial(cx, cy, values, palette, title, subtitle) {
  // angles: top=−90, right=0, bottom=90, left=180
  const angles    = [-90, 0, 90, 180];
  const labels    = ['Objective', 'Facts', 'Emotion', 'Interpretation'];
  const sublabels = ['What you wanted', 'Observable info', 'How you felt', 'Meaning given'];

  const petals = values.map((v, i) =>
    petal(cx, cy, angles[i], v, palette[i])
  ).join('');

  const lbls = labels.map((l, i) =>
    label(cx, cy, angles[i], l, values[i], palette[i])
  ).join('');

  const stats = centerStats(cx, cy, values, palette);

  // Centre circle
  const centre = `
    <circle cx="${cx}" cy="${cy}" r="34" fill="white" opacity="0.96"
            filter="url(#shadow)"/>
    <circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#d0d8e4" stroke-width="1"/>
    ${stats}
  `;

  // Title above dial
  const titleEl = `
    <text x="${cx}" y="${cy - 168}" text-anchor="middle"
          font-family="'DM Serif Display', 'Georgia', serif" font-size="17"
          fill="#1a2340" letter-spacing="0.3">${title}</text>
    <text x="${cx}" y="${cy - 151}" text-anchor="middle"
          font-family="'DM Sans', sans-serif" font-size="10"
          fill="#6b7a99" letter-spacing="1.5" font-weight="500">${subtitle}</text>
  `;

  return `${titleEl}${petals}${centre}${lbls}`;
}

function generateSVG(data) {
  const {
    user_objective, user_facts, user_interpretation, user_emotion,
    other_objective, other_facts, other_interpretation, other_emotion,
  } = data;

  // Colour palettes — left (user) warm, right (other) cool
  const userPalette  = ['#e05c2a', '#f0a030', '#e84060', '#c03080'];
  const otherPalette = ['#2a7de0', '#30b4f0', '#2ab890', '#6050d0'];

  const W = 820, H = 480;
  const leftCX  = 210, CY = 240;
  const rightCX = 610;

  const userVals  = [user_objective, user_facts, user_emotion, user_interpretation].map(clamp);
  const otherVals = [other_objective, other_facts, other_emotion, other_interpretation].map(clamp);

  const leftDial  = buildDial(leftCX,  CY, userVals,  userPalette,  'Me', 'MY PERSPECTIVE');
  const rightDial = buildDial(rightCX, CY, otherVals, otherPalette, 'Other', 'THEIR PERSPECTIVE');

  // Divider
  const divider = `
    <line x1="${W/2}" y1="40" x2="${W/2}" y2="${H - 40}"
          stroke="#c8d2e0" stroke-width="1.5" stroke-dasharray="6 4"/>
    <text x="${W/2}" y="${H/2 - 10}" text-anchor="middle"
          font-family="'DM Sans', sans-serif" font-size="9"
          fill="#8898b8" letter-spacing="2">vs</text>
  `;

  // Legend bar at bottom
  const legendItems = [
    { color: '#e05c2a', label: 'Objective' },
    { color: '#f0a030', label: 'Facts' },
    { color: '#e84060', label: 'Emotion' },
    { color: '#c03080', label: 'Interpretation' },
  ];
  const legend = legendItems.map((item, i) => {
    const x = 120 + i * 145;
    return `
      <rect x="${x}" y="${H - 26}" width="10" height="10" rx="2" fill="${item.color}" opacity="0.85"/>
      <text x="${x + 14}" y="${H - 18}" font-family="'DM Sans', sans-serif"
            font-size="9.5" fill="#6b7a99">${item.label}</text>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1a2340" flood-opacity="0.10"/>
    </filter>
    <filter id="softglow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#f7f9fc"/>
      <stop offset="100%" stop-color="#eef1f7"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)" rx="16"/>
  <rect width="${W}" height="${H}" fill="none" rx="16" stroke="#d0d8e8" stroke-width="1.5"/>

  <!-- Subtle background circles for depth -->
  <circle cx="${leftCX}"  cy="${CY}" r="150" fill="#e05c2a" opacity="0.03"/>
  <circle cx="${rightCX}" cy="${CY}" r="150" fill="#2a7de0" opacity="0.03"/>

  <!-- Title bar -->
  <text x="${W/2}" y="28" text-anchor="middle"
        font-family="'DM Serif Display', 'Georgia', serif" font-size="15"
        fill="#8898b8" letter-spacing="3">PERSONAL REFLECTION MAP</text>

  ${divider}

  <!-- Dials -->
  <g>${leftDial}</g>
  <g>${rightDial}</g>

  <!-- Legend -->
  ${legend}
</svg>`;
}

module.exports = { generateSVG };
