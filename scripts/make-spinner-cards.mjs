// Spinner card assets.
//
//  assets/packed/meme-master-blue/spinner-card.webp
//    Meme Master die-cut card (same silhouette as the other posters). Web
//    renders this with a CSS perspective/rotateY transform and a drop-shadow
//    glow filter.
//
//  assets/packed/spinner/poses/<card>-<pose>.webp   (pose: flat | left | right)
//    Native cannot rely on runtime perspective transforms (iOS renders them
//    clipped), so every card is pre-projected here with the same maths the web
//    transform uses: rotateZ(±4deg) then rotateY(±15deg) under perspective.
//    The Meme Master glow is baked in. All poses share one padded canvas so
//    the app can draw them in a single fixed box.
import fs from 'fs';
import sharp from 'sharp';

const W = 780;
const H = 1560;
const PAD = 110;
const PW = W + PAD * 2;
const PH = H + PAD * 2;
// CSS perspective is 1100px with a 390*scale card; keep the same ratio here.
const PERSPECTIVE = 1100 * (W / (390 * 0.5));
// Poses are projected at full resolution, then written at this fraction. The
// biggest phone draws the padded card at ~690px, so 800px is plenty and keeps
// nine decoded textures under ~40 MB.
const POSE_SCALE = 0.8;
const YAW = (15 * Math.PI) / 180;
const TILT = (4 * Math.PI) / 180;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const OUT_DIR = 'assets/packed/spinner/poses';

const silhouette = [
  [0.02, 0.07],
  [0.87, 0.01],
  [0.99, 0.05],
  [0.98, 0.94],
  [0.9, 0.99],
  [0.07, 0.97],
  [0.01, 0.93],
]
  .map(([x, y]) => `${x * W},${y * H}`)
  .join(' ');

async function memeCard() {
  const png = await sharp('assets/packed/meme-master-blue/spinner-poster.jpg')
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .composite([{
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="${silhouette}" fill="white"/></svg>`),
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();
  await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 4 }).toFile('assets/packed/meme-master-blue/spinner-card.webp');
  return png;
}

function solve(a, b) {
  const n = b.length;
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    [b[c], b[pivot]] = [b[pivot], b[c]];
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k += 1) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / a[i][i]);
}

// Homography mapping destination canvas pixels back to card pixels.
function inverseHomography(src, dst) {
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = dst[i];
    const [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  const h = solve(A, B);
  return [...h, 1];
}

function projectCorners(sign) {
  const yaw = YAW * sign;
  const tilt = TILT * sign;
  return [[0, 0], [W, 0], [W, H], [0, H]].map(([px, py]) => {
    const x = px - W / 2;
    const y = py - H / 2;
    // CSS applies the right-most transform first: rotateZ, then rotateY, then projection.
    const rx = x * Math.cos(tilt) - y * Math.sin(tilt);
    const ry = x * Math.sin(tilt) + y * Math.cos(tilt);
    const yx = rx * Math.cos(yaw);
    const z = -rx * Math.sin(yaw);
    const f = PERSPECTIVE / (PERSPECTIVE - z);
    return [yx * f + PW / 2, ry * f + PH / 2];
  });
}

function warp(card, sign) {
  const out = Buffer.alloc(PW * PH * 4);
  const h = inverseHomography([[0, 0], [W, 0], [W, H], [0, H]], projectCorners(sign));
  for (let y = 0; y < PH; y += 1) {
    for (let x = 0; x < PW; x += 1) {
      const d = h[6] * x + h[7] * y + h[8];
      const sx = (h[0] * x + h[1] * y + h[2]) / d;
      const sy = (h[3] * x + h[4] * y + h[5]) / d;
      if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * PW + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const i00 = (y0 * W + x0) * 4 + c;
        const v =
          card[i00] * (1 - fx) * (1 - fy) +
          card[i00 + 4] * fx * (1 - fy) +
          card[i00 + W * 4] * (1 - fx) * fy +
          card[i00 + W * 4 + 4] * fx * fy;
        out[o + c] = Math.round(v);
      }
    }
  }
  return out;
}

async function glowLayer(alpha, hex, sigma) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return sharp({ create: { width: PW, height: PH, channels: 3, background: { r, g, b } } })
    .joinChannel(alpha)
    .blur(sigma)
    .png()
    .toBuffer();
}

// Matches the web filter: drop-shadow(0 0 7px #46edff) drop-shadow(0 0 17px #a429ff),
// expressed at this canvas resolution (2px per design unit).
async function withGlow(rgba) {
  const raw = { raw: { width: PW, height: PH, channels: 4 } };
  const alpha = await sharp(rgba, raw).extractChannel('alpha').png().toBuffer();
  const purple = await glowLayer(alpha, '#a429ff', 34);
  const cyan = await glowLayer(alpha, '#46edff', 14);
  const card = await sharp(rgba, raw).png().toBuffer();
  return sharp({ create: { width: PW, height: PH, channels: 4, background: transparent } })
    .composite([
      { input: purple, blend: 'over' },
      { input: purple, blend: 'over' },
      { input: cyan, blend: 'over' },
      { input: card, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

async function padFlat(cardPng) {
  return sharp(cardPng)
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: transparent })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function build(name, cardPng, glow) {
  const card = await sharp(cardPng).ensureAlpha().raw().toBuffer();
  const poses = {
    flat: await padFlat(cardPng),
    left: warp(card, -1),
    right: warp(card, 1),
  };
  for (const [pose, rgba] of Object.entries(poses)) {
    const raw = { raw: { width: PW, height: PH, channels: 4 } };
    const image = glow ? sharp(await withGlow(rgba)) : sharp(rgba, raw);
    const file = `${OUT_DIR}/${name}-${pose}.webp`;
    await image
      .resize(Math.round(PW * POSE_SCALE), Math.round(PH * POSE_SCALE))
      .webp({ quality: 90, alphaQuality: 100, effort: 4 })
      .toFile(file);
    console.log(file, fs.statSync(file).size);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const meme = await memeCard();
await build('meme-master', meme, true);
for (const name of ['chaos-tap', 'tipsy-doodles']) {
  const png = await sharp(`assets/packed/spinner/${name}.webp`).resize(W, H).ensureAlpha().png().toBuffer();
  await build(name, png, false);
}
