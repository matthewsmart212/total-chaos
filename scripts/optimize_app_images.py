#!/usr/bin/env python3
"""Optimise image assets that are actually required by the app source."""
from __future__ import annotations

import io
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

ROOT = Path(__file__).resolve().parents[1]
SOURCE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}

PNG_BACKGROUNDS_TO_JPEG = {
    Path('assets/layers/home-background.png'),
    Path('assets/layers/mode-background.png'),
    Path('assets/layers/join-background.png'),
    Path('assets/layers/character-background.png'),
}

JPEG_QUALITY_BY_NAME = {
    'spinner-poster.jpg': 88,
    'background.jpg': 86,
}
LAYER_BACKGROUND_JPEGS = {path.with_suffix('.jpg') for path in PNG_BACKGROUNDS_TO_JPEG}
DEFAULT_JPEG_QUALITY = 84
CONVERTED_BACKGROUND_QUALITY = 88


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as tmp:
        tmp.write(data)
        tmp.flush()
        os.fsync(tmp.fileno())
        temp_name = tmp.name
    os.replace(temp_name, path)


def encoded_png(image: Image.Image, *, palette: bool = False) -> bytes:
    work = image
    if palette:
        if work.mode not in ('RGBA', 'RGB'):
            work = work.convert('RGBA')
        method = Image.Quantize.FASTOCTREE if work.mode == 'RGBA' else Image.Quantize.MEDIANCUT
        work = work.quantize(colors=256, method=method, dither=Image.Dither.NONE)
    out = io.BytesIO()
    work.save(out, format='PNG', optimize=True, compress_level=9)
    return out.getvalue()


def encoded_jpeg(image: Image.Image, quality: int) -> bytes:
    work = ImageOps.exif_transpose(image).convert('RGB')
    out = io.BytesIO()
    work.save(
        out,
        format='JPEG',
        quality=quality,
        optimize=True,
        progressive=True,
        subsampling=1,
    )
    return out.getvalue()


def encoded_webp_lossless(image: Image.Image) -> bytes:
    work = image.convert('RGBA')
    out = io.BytesIO()
    work.save(out, format='WEBP', lossless=True, quality=100, method=4)
    return out.getvalue()


def rgba_array(image: Image.Image):
    return np.asarray(image.convert('RGBA'), dtype=np.int16) if np is not None else None


def webp_candidate_is_safe(original: Image.Image, candidate_bytes: bytes) -> bool:
    if np is None:
        return False
    try:
        original_rgba = rgba_array(original)
        candidate = Image.open(io.BytesIO(candidate_bytes)).convert('RGBA')
        if candidate.size != original.size:
            return False
        candidate_rgba = np.asarray(candidate, dtype=np.int16)
        alpha = original_rgba[:, :, 3]
        visible = alpha > 0
        if not np.array_equal(original_rgba[:, :, 3], candidate_rgba[:, :, 3]):
            return False
        if visible.any() and not np.array_equal(original_rgba[:, :, :3][visible], candidate_rgba[:, :, :3][visible]):
            return False
        return True
    except Exception:
        return False


def palette_candidate_is_safe(original: Image.Image, candidate_bytes: bytes) -> bool:
    if np is None:
        return False
    try:
        candidate = Image.open(io.BytesIO(candidate_bytes)).convert('RGBA')
        if candidate.size != original.size:
            return False
        diff = np.abs(rgba_array(original) - rgba_array(candidate))
        mean = float(diff.mean())
        p99 = float(np.percentile(diff, 99))
        alpha_mean = float(diff[:, :, 3].mean())
        alpha_p99 = float(np.percentile(diff[:, :, 3], 99))
        return mean <= 1.15 and p99 <= 10 and alpha_mean <= 0.55 and alpha_p99 <= 6
    except Exception:
        return False


def optimise_png(path: Path, *, allow_palette: bool = False) -> tuple[int, int, str]:
    before = path.stat().st_size
    original = Image.open(path)
    lossless = encoded_png(original, palette=False)
    best = lossless
    method = 'png-lossless'

    if allow_palette:
        try:
            paletted = encoded_png(original, palette=True)
            if len(paletted) < len(best) and len(paletted) <= before * 0.92 and palette_candidate_is_safe(original, paletted):
                best = paletted
                method = 'png-palette'
        except Exception:
            pass

    if len(best) < before:
        Image.open(io.BytesIO(best)).verify()
        atomic_write(path, best)
    after = path.stat().st_size
    if after >= before:
        method = 'unchanged'
    return before, after, method


def maybe_convert_png_to_webp(path: Path) -> tuple[Path, int, int, str]:
    before = path.stat().st_size
    original = Image.open(path)
    candidate = encoded_webp_lossless(original)
    if len(candidate) >= before * 0.97:
        return path, before, before, 'kept-png'
    if not webp_candidate_is_safe(original, candidate):
        return path, before, before, 'kept-png'
    new_path = path.with_suffix('.webp')
    Image.open(io.BytesIO(candidate)).verify()
    atomic_write(new_path, candidate)
    replace_require_path(path.relative_to(ROOT), new_path.relative_to(ROOT))
    path.unlink()
    return new_path, before, new_path.stat().st_size, 'png-to-lossless-webp'


def optimise_jpeg(path: Path, *, quality: int | None = None) -> tuple[int, int, str]:
    before = path.stat().st_size
    original = Image.open(path)
    rel = path.relative_to(ROOT)
    q = quality or (CONVERTED_BACKGROUND_QUALITY if rel in LAYER_BACKGROUND_JPEGS else JPEG_QUALITY_BY_NAME.get(path.name, DEFAULT_JPEG_QUALITY))
    best = encoded_jpeg(original, q)
    if len(best) < before:
        Image.open(io.BytesIO(best)).verify()
        atomic_write(path, best)
    after = path.stat().st_size
    return before, after, f'jpeg-q{q}' if after < before else 'unchanged'


def source_files() -> Iterable[Path]:
    for path in ROOT.rglob('*'):
        if path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        parts = set(path.parts)
        if 'node_modules' in parts or '.git' in parts or 'dist' in parts:
            continue
        yield path


def required_image_paths() -> set[Path]:
    required: set[Path] = set()
    pattern = re.compile(r"require\(['\"]([^'\"]+)['\"]\)")
    for source in source_files():
        text = source.read_text(errors='ignore')
        for match in pattern.finditer(text):
            raw = match.group(1)
            if not raw.startswith('.'):
                continue
            path = (source.parent / raw).resolve()
            try:
                rel = path.relative_to(ROOT)
            except ValueError:
                continue
            if rel.suffix.lower() in IMAGE_EXTENSIONS and (ROOT / rel).exists():
                required.add(rel)
    return required


def replace_require_path(old_rel: Path, new_rel: Path) -> None:
    old_text = './' + old_rel.as_posix()
    new_text = './' + new_rel.as_posix()
    for source in source_files():
        text = source.read_text(errors='ignore')
        if old_text in text:
            source.write_text(text.replace(old_text, new_text))


def convert_background_pngs(required: set[Path], report: list[dict]) -> set[Path]:
    updated = set(required)
    for rel in sorted(PNG_BACKGROUNDS_TO_JPEG & required):
        source = ROOT / rel
        target_rel = rel.with_suffix('.jpg')
        target = ROOT / target_rel
        before = source.stat().st_size
        image = Image.open(source)
        data = encoded_jpeg(image, CONVERTED_BACKGROUND_QUALITY)
        Image.open(io.BytesIO(data)).verify()
        atomic_write(target, data)
        replace_require_path(rel, target_rel)
        source.unlink()
        after = target.stat().st_size
        updated.remove(rel)
        updated.add(target_rel)
        report.append({
            'path': rel.as_posix(),
            'new_path': target_rel.as_posix(),
            'before': before,
            'after': after,
            'method': f'png-to-jpeg-q{CONVERTED_BACKGROUND_QUALITY}',
        })
    return updated


def main() -> None:
    report: list[dict] = []
    required = required_image_paths()
    required = convert_background_pngs(required, report)

    for rel in sorted(required):
        path = ROOT / rel
        suffix = rel.suffix.lower()
        if suffix == '.png':
            before, after, method = optimise_png(path, allow_palette=False)
            new_path, webp_before, webp_after, webp_method = maybe_convert_png_to_webp(path)
            if webp_method == 'png-to-lossless-webp':
                report.append({
                    'path': rel.as_posix(),
                    'new_path': new_path.relative_to(ROOT).as_posix(),
                    'before': webp_before,
                    'after': webp_after,
                    'method': webp_method,
                })
                continue
        elif suffix in {'.jpg', '.jpeg'}:
            before, after, method = optimise_jpeg(path)
        else:
            continue
        report.append({'path': rel.as_posix(), 'before': before, 'after': after, 'method': method})

    before_total = sum(item['before'] for item in report)
    after_total = sum(item['after'] for item in report)
    saved = before_total - after_total
    changed = [item for item in report if item['after'] < item['before'] or 'new_path' in item]
    print(json.dumps({
        'optimised_files': len(changed),
        'processed_files': len(report),
        'before_bytes': before_total,
        'after_bytes': after_total,
        'saved_bytes': saved,
        'saved_percent': round(saved / before_total * 100, 2) if before_total else 0,
        'largest_savings': sorted(
            changed,
            key=lambda item: item['before'] - item['after'],
            reverse=True,
        )[:20],
    }, indent=2))


if __name__ == '__main__':
    main()
