import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "assets" / "layers"
DISPLAY_FONT = ROOT / "node_modules" / "@expo-google-fonts" / "lilita-one" / "400Regular" / "LilitaOne_400Regular.ttf"


def paste(canvas: Image.Image, filename: str, box: tuple[int, int, int, int]) -> None:
    x, y, width, height = box
    asset = Image.open(LAYERS / filename).convert("RGBA")
    asset = asset.resize((width, height), Image.Resampling.LANCZOS)
    canvas.alpha_composite(asset, (x, y))


def render_home(output: Path) -> None:
    canvas = Image.open(LAYERS / "home-background.png").convert("RGBA")
    paste(canvas, "home-sound.png", (30, 46, 122, 122))
    paste(canvas, "home-settings.png", (702, 44, 122, 122))
    paste(canvas, "home-logo.png", (106, 203, 641, 337))

    monster = Image.open(ROOT / "assets" / "monsters" / "grumble.png").convert("RGBA")
    monster = monster.resize((457, 628), Image.Resampling.LANCZOS)
    canvas.alpha_composite(monster, (198, 558))

    paste(canvas, "home-host-button.png", (80, 1240, 693, 179))
    paste(canvas, "home-join-button.png", (84, 1433, 686, 174))
    paste(canvas, "home-player-count.png", (237, 1650, 379, 54))
    canvas.convert("RGB").save(output, quality=94)


def render_mode(output: Path) -> None:
    canvas = Image.open(LAYERS / "mode-background.png").convert("RGBA")
    paste(canvas, "mode-back.png", (22, 72, 123, 110))
    paste(canvas, "mode-title.png", (91, 194, 671, 286))
    paste(canvas, "mode-quick-card.png", (39, 532, 776, 331))
    paste(canvas, "mode-full-card.png", (34, 878, 785, 324))
    paste(canvas, "mode-custom-card.png", (40, 1215, 775, 279))
    paste(canvas, "mode-continue-button.png", (86, 1546, 683, 181))
    canvas.convert("RGB").save(output, quality=94)


def render_join(output: Path) -> None:
    from PIL import ImageDraw, ImageFont

    canvas = Image.open(LAYERS / "join-background.png").convert("RGBA")
    paste(canvas, "join-back.png", (42, 78, 101, 103))
    paste(canvas, "join-title.png", (104, 274, 671, 310))
    paste(canvas, "join-code-panel.png", (25, 684, 825, 501))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(DISPLAY_FONT, 79)
    for letter, center in zip("CH4OS", (128, 283, 438, 593, 748)):
        bounds = draw.textbbox((0, 0), letter, font=font, stroke_width=2)
        width = bounds[2] - bounds[0]
        draw.text((center - width / 2, 859), letter, font=font, fill="#fff8e9", stroke_width=3, stroke_fill="#100019")
    paste(canvas, "join-button.png", (116, 1288, 645, 184))
    canvas.convert("RGB").save(output, quality=94)


def render_character(output: Path) -> None:
    from PIL import ImageDraw, ImageFont

    canvas = Image.open(LAYERS / "character-background.png").convert("RGBA")
    paste(canvas, "character-back.png", (31, 48, 108, 102))
    paste(canvas, "character-title.png", (47, 138, 767, 282))
    paste(canvas, "character-name-panel.png", (103, 448, 647, 181))
    cards = [
        ("grumble", (24, 661, 197, 333)),
        ("gloop", (222, 661, 201, 333)),
        ("brrr", (425, 661, 200, 333)),
        ("peepers", (628, 661, 201, 333)),
        ("dozy", (23, 1006, 198, 329)),
        ("bop", (222, 1006, 201, 329)),
        ("snicker", (425, 1006, 200, 329)),
        ("scraps", (628, 1006, 201, 329)),
    ]
    for name, box in cards:
        paste(canvas, f"character-{name}-card.png", box)
    draw = ImageDraw.Draw(canvas)
    paste(canvas, "character-selection-border.png", (24, 661, 197, 333))
    paste(canvas, "character-selection-check.png", (29, 667, 59, 59))
    name_font = ImageFont.truetype(DISPLAY_FONT, 50)
    draw.text((426, 563), "MATTHIAS", anchor="mm", font=name_font, fill="#fff8e9", stroke_width=2, stroke_fill="#100019")
    paste(canvas, "character-picker.png", (29, 1366, 795, 142))
    draw.text((426, 1435), "GRUMBLE", anchor="mm", font=name_font, fill="#fff8e9", stroke_width=2, stroke_fill="#100019")
    paste(canvas, "character-ready-button.png", (102, 1547, 649, 182))
    canvas.convert("RGB").save(output, quality=94)


parser = argparse.ArgumentParser()
parser.add_argument("output_dir", type=Path)
args = parser.parse_args()
args.output_dir.mkdir(parents=True, exist_ok=True)
render_home(args.output_dir / "layered-home-preview.jpg")
render_mode(args.output_dir / "layered-mode-preview.jpg")
render_join(args.output_dir / "layered-join-preview.jpg")
render_character(args.output_dir / "layered-character-preview.jpg")
