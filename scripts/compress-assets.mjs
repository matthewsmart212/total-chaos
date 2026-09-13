import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.join(process.cwd(), 'assets');
const packedRoot = path.join(root, 'packed');
const MAX_EDGE = 1920;
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'packed') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (exts.has(path.extname(ent.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

function isIcon(rel) {
  return /(?:^|\/)(icon|favicon|android-icon-)/i.test(rel);
}

const files = walk(root);
let saved = 0;
const changed = [];
const map = [];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const before = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const image = sharp(file, { failOn: 'none', sequentialRead: true });
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const needsResize = Math.max(width, height) > MAX_EDGE;
  let pipeline = sharp(file, { failOn: 'none', sequentialRead: true }).rotate();

  if (needsResize) {
    pipeline = pipeline.resize({
      width: width >= height ? MAX_EDGE : undefined,
      height: height > width ? MAX_EDGE : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let destRel = rel;
  let output;
  if (ext === '.jpg' || ext === '.jpeg') {
    output = await pipeline
      .jpeg({ quality: 88, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
  } else if (isIcon(rel)) {
    output = await pipeline.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  } else {
    destRel = rel.replace(/\.png$/i, '.webp');
    output = await pipeline
      .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toBuffer();
  }

  const usePacked = output.length < before * 0.97;
  const outRel = usePacked ? destRel : rel;
  const outPath = path.join(packedRoot, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, usePacked ? output : fs.readFileSync(file));
  const after = fs.statSync(outPath).size;
  saved += Math.max(0, before - after);
  map.push({ from: `assets/${rel}`, to: `assets/packed/${outRel}` });
  if (after < before) {
    changed.push({ file: rel, before, after, resized: needsResize });
  }
}

changed.sort((a, b) => (b.before - b.after) - (a.before - a.after));
fs.writeFileSync(path.join(packedRoot, 'rewrite-map.json'), JSON.stringify(map, null, 2));
console.log(JSON.stringify({
  packed: map.length,
  changed: changed.length,
  savedBytes: saved,
  savedMB: +(saved / 1024 / 1024).toFixed(2),
  top: changed.slice(0, 12).map((item) => ({
    file: item.file,
    kb: `${Math.round(item.before / 1024)} -> ${Math.round(item.after / 1024)}`,
  })),
}, null, 2));
