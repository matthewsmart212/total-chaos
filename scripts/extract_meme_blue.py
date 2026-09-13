"""Deterministically split the supplied Meme Master designs into reusable art.

No whole-screen image is shipped as an interactive screen. Original references
are kept in designs/meme-master; editable panels, names and timers are native UI.
Run: python scripts/extract_meme_blue.py
Requires Pillow, numpy and scipy (asset tooling only; not app dependencies).
"""
from pathlib import Path
import json
import io
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/meme-master-blue'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = {p.stem.split('-')[0]: Image.open(p).convert('RGBA')
           for p in (ROOT / 'designs/meme-master').glob('*.jpeg')}
manifest = {}


def write_image(image, path, fmt='PNG', **options):
    # Encode completely in memory before one atomic write. Some mounted file
    # systems cannot reliably preserve Pillow's sequence of small IDAT writes.
    data = io.BytesIO()
    image.save(data, format=fmt, **options)
    encoded = data.getvalue()
    Image.open(io.BytesIO(encoded)).verify()
    temporary = path.with_suffix(path.suffix + '.partial')
    with open(temporary, 'wb', buffering=0) as out:
        out.write(encoded)
        os.fsync(out.fileno())
    temporary.replace(path)
    Image.open(path).verify()


def save(image, name, source, box):
    write_image(image, OUT / f'{name}.png', optimize=True)
    manifest[name] = {'source': source, 'box': box, 'size': image.size}


def cut(source, box, name, radius=None, ellipse=False, key=False, shadow=2, white=False, text_only=False):
    im = SOURCES[source].crop(box)
    w, h = im.size
    if key:
        rgb = np.asarray(im)[..., :3].astype(float)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        seed = ((r > 66) & (r > b * .44)) | ((g > 78) & (g > b * .52))
        if white:
            seed = (r > 170) & (g > 170) & (b > 170)
        if text_only:
            seed = ((r > 145) & (g > 140) & (b > 135)) | ((r > 160) & (g > 70) & (r > b*1.6))
            # Keep only the actual title/crown, not the enclosing neon panel.
            seed[:85, :158] = False
            seed[:85, 295:] = False
        labels, count = ndimage.label(seed)
        sizes = np.bincount(labels.ravel())
        keep = sizes >= 10
        keep[0] = False
        seed = keep[labels]
        seed = ndimage.binary_closing(seed, iterations=1)
        seed = ndimage.binary_fill_holes(seed)
        if text_only:
            near = ndimage.binary_dilation(seed, iterations=9)
            seed |= near & (r < 70) & (g < 45)
        if shadow:
            seed = ndimage.binary_dilation(seed, iterations=shadow)
        mask = Image.fromarray((seed * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(.45))
        im.putalpha(mask)
    if radius is not None or ellipse:
        mask = Image.new('L', (w*4, h*4))
        d = ImageDraw.Draw(mask)
        if ellipse:
            d.ellipse((2, 2, w*4-2, h*4-2), fill=255)
        else:
            d.rounded_rectangle((2, 2, w*4-2, h*4-2), radius=radius*4, fill=255)
        mask = mask.resize((w, h), Image.Resampling.LANCZOS)
        im.putalpha(mask)
    save(im, name, source, box)


def photo(source, quad, name, size):
    # QUAD order: top-left, bottom-left, bottom-right, top-right.
    im = SOURCES[source].transform(size, Image.Transform.QUAD, quad,
                                   resample=Image.Resampling.BICUBIC)
    write_image(im.convert('RGB'), OUT / f'{name}.jpg', 'JPEG', quality=94, optimize=True)
    manifest[name] = {'source': source, 'quad': quad, 'size': size}


cut('03', (176, 8, 538, 233), 'brand', key=True, shadow=1)
cut('01', (24, 131, 211, 271), 'brand-sticker', key=True, shadow=3)
cut('01', (128, 261, 576, 608), 'intro-title', key=True, shadow=2, text_only=True)
cut('01', (0, 612, 709, 1180), 'intro-cast', key=True, shadow=4)
cut('01', (15, 533, 121, 629), 'speech-question', key=True, shadow=3)
cut('01', (575, 537, 692, 635), 'speech-lol', key=True, shadow=3)
cut('01', (91, 1206, 619, 1335), 'button-how-to', radius=54)
cut('01', (194, 1353, 517, 1421), 'let-memes-begin', key=True, shadow=1)
cut('02', (148, 310, 566, 420), 'how-to-title', key=True, shadow=7)
cut('02', (480, 304, 681, 466), 'gloop-peek', key=True, shadow=3)
cut('02', (148, 302, 684, 466), 'how-to-hero', key=True, shadow=3)
cut('02', (125, 1226, 589, 1359), 'button-got-it', radius=61)
cut('03', (184, 252, 529, 315), 'write-title', radius=31)
cut('06', (164, 246, 554, 314), 'pick-title', radius=33)
cut('07', (148, 240, 562, 319), 'winning-title', radius=38)
cut('05', (61, 321, 652, 443), 'judge-title', key=True, shadow=1)
cut('08', (70, 463, 640, 582), 'scores-title', key=True, shadow=1, white=True)
cut('08', (130, 204, 589, 471), 'trophy-bop', key=True, shadow=3)
cut('08', (108, 1298, 600, 1402), 'button-next-round', radius=50)
cut('06', (36, 1322, 390, 1427), 'button-vote', radius=49)
cut('06', (404, 1325, 681, 1426), 'button-next-meme', radius=34)
cut('03', (569, 1288, 684, 1401), 'button-send', ellipse=True)
cut('07', (63, 452, 207, 591), 'winner-crown', key=True, shadow=3)

photo('03', (79,541, 57,1090, 632,1110, 644,557), 'meme-gaming', (720,720))
photo('04', (73,460, 73,833, 640,833, 640,460), 'meme-pool', (900,592))
photo('06', (79,525, 66,985, 627,996, 640,543), 'meme-party', (720,580))
photo('07', (86,598, 94,973, 614,956, 608,580), 'meme-work', (720,524))

# Anonymous reveal is a separate illustration, never a baked timer or player row.
cut('05', (9, 493, 701, 934), 'anonymous-cards', key=True, shadow=3)

for name, box in [
    ('love', (80,1215,196,1332)), ('laugh',(224,1215,342,1332)),
    ('mood',(369,1215,487,1332)), ('lol',(510,1215,629,1332)),
]:
    cut('04', box, f'reaction-{name}', ellipse=True)

for name, box in [
    ('grumble',(20,1172,102,1255)), ('gloop',(103,1172,184,1255)),
    ('brrr',(185,1171,268,1255)), ('peepers',(269,1172,352,1255)),
    ('dozy',(353,1171,435,1255)), ('bop',(436,1170,520,1255)),
    ('snicker',(521,1171,603,1255)), ('scraps',(604,1171,689,1255)),
]:
    cut('05', box, f'avatar-{name}', ellipse=True)

for name, source, box in [
    ('funny-thoughts','03',(19,232,168,379)),
    ('chaos-legends','03',(568,207,704,432)),
    ('good-memes','03',(492,379,647,513)),
    ('same-brainrot','03',(17,1385,155,1509)),
    ('chaos-always','03',(565,1422,689,1525)),
    ('more-memes','08',(12,1410,117,1517)),
]:
    cut(source, box, f'doodle-{name}', key=True, shadow=0)

(OUT / 'asset-map.json').write_text(json.dumps(manifest, indent=2)+'\n')
# Match the carousel's collectible poster to this game's new identity.
write_image(SOURCES['01'].crop((0, 120, 709, 1190)).convert('RGB'), OUT / 'spinner-poster.jpg', 'JPEG', quality=94, optimize=True)
for path in OUT.iterdir():
    if path.suffix in ('.png', '.jpg'):
        Image.open(path).verify()
print(f'Extracted {len(manifest)} independent assets into {OUT}')
