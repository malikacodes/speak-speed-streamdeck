// Draws the dial's touch strip and the key as SVG text. It only draws, it
// never talks to Stream Deck or to macOS, so the tests can read what it
// made.
import { SPEEDS, label } from "./speeds.js";

const PINK = "#f2a7c3";
const DIM = "#5c5c62";
const FONT = "-apple-system, Helvetica, sans-serif";

// Pure black, to match the deck. Anything lighter shows up as a gray
// square next to the keys around it.
const BLACK = "#000000";

// A small crossed-out ear, for when nothing is being read. It's the ear
// from my Option + Esc key, in gray, with a line through it. The shape is
// 24 by 24, and x, y and size say where it goes and how big.
function quietEar(x, y, size) {
  return [
    `<g transform="translate(${x},${y}) scale(${size / 24})" fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" stroke="${DIM}" stroke-width="2"/>`,
    `<path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" stroke="${DIM}" stroke-width="2"/>`,
    // The line gets a black edge first, so it cuts through the ear and
    // doesn't just blend into it.
    `<path d="M3.5 3.5l17 17" stroke="${BLACK}" stroke-width="5"/>`,
    `<path d="M3.5 3.5l17 17" stroke="${DIM}" stroke-width="2"/>`,
    "</g>",
  ].join("");
}

// The strip above the dial, 200 by 100 pixels: the speed, and five dots
// with the current one filled in.
//   speed    what to show
//   reading  false when nothing is being read, which dims everything
//            and adds the crossed-out ear
//   notice   a short message that takes over the strip for a moment
export function drawStrip({ speed, reading, notice }) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" font-family="${FONT}">`,
    `<rect width="200" height="100" fill="${BLACK}"/>`,
  ];

  if (notice) {
    parts.push(`<text x="100" y="56" fill="#ffffff" font-size="15" text-anchor="middle">${notice}</text>`);
  } else {
    parts.push(`<text x="100" y="56" fill="${reading ? "#ffffff" : DIM}" font-size="34" font-weight="600" text-anchor="middle">${label(speed)}</text>`);
    if (!reading) parts.push(quietEar(164, 8, 26));
    SPEEDS.forEach((each, i) => {
      const on = each === speed;
      parts.push(`<circle cx="${68 + i * 16}" cy="80" r="4" fill="${on && reading ? PINK : on ? "#8a8a90" : "#2c2c30"}"/>`);
    });
  }

  parts.push("</svg>");
  return parts.join("");
}

// The key, 144 by 144 pixels: the speed in the middle, and the key's two
// picks along the bottom with the one I'm on in pink. When nothing is
// being read, the crossed-out ear sits at the top.
export function drawKey({ speed, reading, one, two }) {
  const pick = (each, x) =>
    `<text x="${x}" y="122" fill="${each === speed && reading ? PINK : DIM}" font-size="20" font-weight="600" text-anchor="middle">${label(each)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144" font-family="${FONT}">`,
    `<rect width="144" height="144" fill="${BLACK}"/>`,
    `<text x="72" y="76" fill="${reading ? "#ffffff" : DIM}" font-size="38" font-weight="600" text-anchor="middle">${label(speed)}</text>`,
    reading ? "" : quietEar(59, 10, 26),
    pick(one, 40),
    pick(two, 104),
    "</svg>",
  ].join("");
}
