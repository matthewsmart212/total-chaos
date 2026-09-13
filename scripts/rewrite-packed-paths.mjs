import fs from 'fs';
import path from 'path';

const root = process.cwd();
const map = JSON.parse(fs.readFileSync(path.join(root, 'assets/packed/rewrite-map.json'), 'utf8'));
const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'packed') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (codeExts.has(path.extname(ent.name))) acc.push(p);
  }
  return acc;
}

const files = walk(root);
let updates = 0;
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const original = text;
  for (const { from, to } of map) {
    text = text.split(`./${from}`).join(`./${to}`);
    text = text.split(`../${from}`).join(`../${to}`);
  }
  if (text !== original) {
    fs.writeFileSync(file, text);
    updates += 1;
  }
}
console.log(`updated ${updates} files`);
