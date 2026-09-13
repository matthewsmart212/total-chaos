from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "assets" / "layers"
HOME = Image.open(ROOT / "assets" / "screens" / "home.png").convert("RGBA")
MODE = Image.open(ROOT / "assets" / "screens" / "mode.png").convert("RGBA")
JOIN = Image.open(ROOT / "assets" / "screens" / "join.png").convert("RGBA")
CHARACTER = Image.open(ROOT / "assets" / "screens" / "character.png").convert("RGBA")


def antialiased_mask(size: tuple[int, int], radius: int, ellipse: bool = False) -> Image.Image:
    scale = 4
    width, height = size
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    bounds = (1 * scale, 1 * scale, (width - 1) * scale, (height - 1) * scale)
    if ellipse:
        draw.ellipse(bounds, fill=255)
    else:
        draw.rounded_rectangle(bounds, radius=radius * scale, fill=255)
    return mask.resize(size, Image.Resampling.LANCZOS)


def rounded_crop(
    source: Image.Image,
    box: tuple[int, int, int, int],
    output: str,
    radius: int,
    *,
    ellipse: bool = False,
) -> None:
    crop = source.crop(box)
    shape_mask = antialiased_mask(crop.size, radius, ellipse)
    source_alpha = crop.getchannel("A")
    crop.putalpha(ImageChops.multiply(source_alpha, shape_mask))
    crop.save(LAYERS / output)


def trim_transparent(source_name: str, output: str, padding: int = 4) -> None:
    image = Image.open(LAYERS / source_name).convert("RGBA")
    # Image generation may leave near-invisible alpha noise around an otherwise
    # clean cutout. Ignore that noise so layout uses the visible artwork bounds.
    visible_alpha = image.getchannel("A").point(lambda value: 255 if value >= 20 else 0)
    bounds = visible_alpha.getbbox()
    if bounds is None:
        raise RuntimeError(f"{source_name} contains no visible pixels")
    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    image.crop((left, top, right, bottom)).save(LAYERS / output)


def orange_cutout(
    source: Image.Image,
    box: tuple[int, int, int, int],
    output: str,
) -> None:
    crop = source.crop(box).convert("RGBA")
    pixels = crop.load()
    mask = Image.new("L", crop.size, 0)
    alpha = mask.load()

    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue, _ = pixels[x, y]
            warmth = min(red - blue, green - blue + 45)
            brightness = max(red, green)
            if red > 95 and green > 45 and warmth > 28 and red > blue * 1.22:
                alpha[x, y] = max(0, min(255, int((brightness - 70) * 2.3)))

    mask = mask.filter(ImageFilter.GaussianBlur(0.35))
    crop.putalpha(mask)
    visible = crop.getchannel("A").getbbox()
    if visible is None:
        raise RuntimeError(f"Could not isolate {output}")
    crop.crop(visible).save(LAYERS / output)


def copy_background(output: str, size: tuple[int, int]) -> None:
    """Give every layered screen its own clean, full-bleed background asset."""
    background = Image.open(LAYERS / "mode-background.png").convert("RGBA")
    background.resize(size, Image.Resampling.LANCZOS).save(LAYERS / output)


def text_art_cutout(
    source: Image.Image,
    box: tuple[int, int, int, int],
    output: str,
    *,
    padding: int = 8,
) -> None:
    """Lift cream/orange display lettering and its dark drop shadow from a design."""
    crop = source.crop(box).convert("RGBA")
    rgb = np.asarray(crop)[..., :3].astype(np.int16)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = maximum - minimum

    cream = (maximum > 145) & (saturation < 105) & (red > 135) & (green > 125)
    orange = (red > 145) & (green > 55) & (red > blue * 1.45) & (green > blue * 1.1)
    seed = cream | orange

    labels, count = ndimage.label(seed)
    if count:
        component_sizes = np.bincount(labels.ravel())
        keep = component_sizes >= 24
        keep[0] = False
        seed = keep[labels]

    near = ndimage.binary_dilation(seed, iterations=17)
    shadow = near & (maximum < 78)
    mask = ndimage.binary_dilation(seed, iterations=1) | shadow
    mask = ndimage.binary_closing(mask, iterations=1)
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.55))
    crop.putalpha(alpha)

    bounds = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bounds is None:
        raise RuntimeError(f"Could not isolate {output}")
    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(crop.width, right + padding)
    bottom = min(crop.height, bottom + padding)
    crop.crop((left, top, right, bottom)).save(LAYERS / output)


def erase_light_text(
    image: Image.Image,
    region: tuple[int, int, int, int],
    *,
    dilation: int = 5,
) -> Image.Image:
    """Remove editable white text while preserving the approved panel artwork."""
    result = image.convert("RGBA")
    array = np.asarray(result).copy()
    left, top, right, bottom = region
    region_rgb = array[top:bottom, left:right, :3].astype(np.int16)
    maximum = region_rgb.max(axis=2)
    minimum = region_rgb.min(axis=2)
    light = (maximum > 138) & ((maximum - minimum) < 100)
    mask = ndimage.binary_dilation(light, iterations=dilation)

    for row in range(top, bottom):
        local_row = row - top
        row_mask = mask[local_row]
        if not row_mask.any():
            continue
        samples = array[row, left:right, :3][~row_mask]
        dark_samples = samples[samples.max(axis=1) < 105]
        if len(dark_samples) == 0:
            dark_samples = samples
        fill = np.median(dark_samples, axis=0).astype(np.uint8)
        row_slice = array[row, left:right]
        row_slice[row_mask, :3] = fill
        row_slice[row_mask, 3] = 255

    return Image.fromarray(array, "RGBA")


def save_rounded_image(image: Image.Image, output: str, radius: int) -> None:
    image = image.convert("RGBA")
    image.putalpha(ImageChops.multiply(image.getchannel("A"), antialiased_mask(image.size, radius)))
    image.save(LAYERS / output)


def blank_join_panel() -> None:
    box = (25, 684, 850, 1185)
    panel = JOIN.crop(box).convert("RGBA")
    tile_regions = [
        (58, 194, 145, 303),
        (213, 194, 300, 303),
        (368, 194, 455, 303),
        (523, 194, 610, 303),
        (678, 194, 765, 303),
    ]
    for region in tile_regions:
        panel = erase_light_text(panel, region, dilation=8)
    save_rounded_image(panel, "join-code-panel.png", 48)


def blank_character_name_panel() -> None:
    box = (103, 448, 750, 629)
    panel = CHARACTER.crop(box).convert("RGBA")
    panel = erase_light_text(panel, (115, 70, 540, 166), dilation=8)
    save_rounded_image(panel, "character-name-panel.png", 36)


def blank_character_picker() -> None:
    box = (29, 1366, 824, 1508)
    picker = CHARACTER.crop(box).convert("RGBA")
    picker = erase_light_text(picker, (225, 23, 570, 123), dilation=9)
    save_rounded_image(picker, "character-picker.png", 38)


def character_cards() -> None:
    cards = {
        "grumble": (24, 661, 221, 994),
        "gloop": (222, 661, 423, 994),
        "brrr": (425, 661, 625, 994),
        "peepers": (628, 661, 829, 994),
        "dozy": (23, 1006, 221, 1335),
        "bop": (222, 1006, 423, 1335),
        "snicker": (425, 1006, 625, 1335),
        "scraps": (628, 1006, 829, 1335),
    }
    for name, box in cards.items():
        if name == "grumble":
            continue
        rounded_crop(CHARACTER, box, f"character-{name}-card.png", 30)

    # The approved Grumble card is selected in the source design. Rebuild its
    # neutral card from the same character art so selection can move correctly.
    width, height = 197, 333
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    for y in range(7, height - 7):
        progress = (y - 7) / (height - 14)
        color = (
            int(45 - 13 * progress),
            int(13 - 5 * progress),
            int(67 - 13 * progress),
            255,
        )
        draw.line((8, y, width - 9, y), fill=color)
    shape = antialiased_mask(card.size, 29)
    card.putalpha(shape)
    border = Image.new("RGBA", card.size, (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle((3, 3, width - 4, height - 4), radius=29, outline=(91, 35, 120, 255), width=5)
    card.alpha_composite(border)

    monster = Image.open(ROOT / "assets" / "monsters" / "grumble.png").convert("RGBA")
    monster.thumbnail((166, 236), Image.Resampling.LANCZOS)
    card.alpha_composite(monster, ((width - monster.width) // 2, 31))

    label_source = CHARACTER.crop((42, 934, 207, 986)).convert("RGBA")
    label_rgb = np.asarray(label_source)[..., :3].astype(np.int16)
    label_max = label_rgb.max(axis=2)
    label_min = label_rgb.min(axis=2)
    label_seed = (label_max > 145) & ((label_max - label_min) < 105)
    label_mask = ndimage.binary_dilation(label_seed, iterations=1)
    label_source.putalpha(Image.fromarray((label_mask * 255).astype(np.uint8)))
    label_bounds = label_source.getchannel("A").getbbox()
    if label_bounds:
        label_source = label_source.crop(label_bounds)
        max_width = 158
        if label_source.width > max_width:
            new_height = round(label_source.height * max_width / label_source.width)
            label_source = label_source.resize((max_width, new_height), Image.Resampling.LANCZOS)
        card.alpha_composite(label_source, ((width - label_source.width) // 2, 284))
    card.save(LAYERS / "character-grumble-card.png")


def character_selection_assets() -> None:
    width, height = 197, 333
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (5, 5, width - 6, height - 6),
        radius=25,
        outline=(255, 91, 10, 235),
        width=10,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(7))

    border = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    border.alpha_composite(glow)
    draw = ImageDraw.Draw(border)
    draw.rounded_rectangle(
        (2, 2, width - 3, height - 3),
        radius=27,
        outline=(255, 103, 13, 255),
        width=7,
    )
    draw.rounded_rectangle(
        (7, 7, width - 8, height - 8),
        radius=21,
        outline=(255, 219, 45, 255),
        width=4,
    )
    border.save(LAYERS / "character-selection-border.png")

    # This is the exact orange badge and hand-drawn white tick from the approved
    # mockup. It is moved as an overlay when the selection changes.
    rounded_crop(CHARACTER, (29, 667, 88, 726), "character-selection-check.png", 15)


LAYERS.mkdir(parents=True, exist_ok=True)

# Generated artwork layers: remove transparent padding while preserving alpha.
trim_transparent("home-logo-source.png", "home-logo.png")
trim_transparent("mode-title-source.png", "mode-title.png")

# Exact control artwork extracted from the approved screen designs. Each output is
# an independent transparent image that sits inside a real React Native Pressable.
rounded_crop(HOME, (30, 46, 152, 168), "home-sound.png", 61, ellipse=True)
rounded_crop(HOME, (702, 44, 824, 166), "home-settings.png", 61, ellipse=True)
rounded_crop(HOME, (80, 1240, 773, 1419), "home-host-button.png", 58)
rounded_crop(HOME, (84, 1433, 770, 1607), "home-join-button.png", 56)
orange_cutout(HOME, (228, 1638, 637, 1724), "home-player-count.png")

rounded_crop(MODE, (22, 72, 145, 182), "mode-back.png", 31)
rounded_crop(MODE, (39, 532, 815, 863), "mode-quick-card.png", 62)
rounded_crop(MODE, (34, 878, 819, 1202), "mode-full-card.png", 62)
rounded_crop(MODE, (40, 1215, 815, 1494), "mode-custom-card.png", 62)
rounded_crop(MODE, (86, 1546, 769, 1727), "mode-continue-button.png", 58)

# Join Room: clean background, exact title and button art, with a blank code
# panel so React Native can render and update the live code above it.
copy_background("join-background.png", JOIN.size)
rounded_crop(JOIN, (42, 78, 143, 181), "join-back.png", 32)
text_art_cutout(JOIN, (95, 265, 785, 590), "join-title.png")
blank_join_panel()
rounded_crop(JOIN, (116, 1288, 761, 1472), "join-button.png", 58)

# Character selection: every card and control is now its own pressable image.
copy_background("character-background.png", CHARACTER.size)
rounded_crop(CHARACTER, (31, 48, 139, 150), "character-back.png", 32)
text_art_cutout(CHARACTER, (47, 138, 814, 420), "character-title.png")
blank_character_name_panel()
character_cards()
character_selection_assets()
blank_character_picker()
rounded_crop(CHARACTER, (102, 1547, 751, 1729), "character-ready-button.png", 58)
