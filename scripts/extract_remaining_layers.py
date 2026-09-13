from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SCREENS = ROOT / "assets" / "screens"
OUTPUT = ROOT / "assets" / "flow"
SPINNER_OUTPUT = ROOT / "assets" / "spinner"


def screen(name: str) -> Image.Image:
    return Image.open(SCREENS / f"{name}.png").convert("RGBA")


def shape_mask(size: tuple[int, int], radius: int) -> Image.Image:
    scale = 4
    width, height = size
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (scale, scale, (width - 1) * scale, (height - 1) * scale),
        radius=radius * scale,
        fill=255,
    )
    return mask.resize(size, Image.Resampling.LANCZOS)


def rounded(source: Image.Image, box: tuple[int, int, int, int], output: str, radius: int) -> None:
    crop = source.crop(box).convert("RGBA")
    crop.putalpha(ImageChops.multiply(crop.getchannel("A"), shape_mask(crop.size, radius)))
    crop.save(OUTPUT / output)


def text_art(source: Image.Image, box: tuple[int, int, int, int], output: str) -> None:
    """Keep the approved display lettering and its dark comic outline."""
    crop = source.crop(box).convert("RGBA")
    rgb = np.asarray(crop)[..., :3].astype(np.int16)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = maximum - minimum

    cream = (maximum > 145) & (saturation < 112) & (red > 132) & (green > 116)
    orange = (red > 145) & (green > 52) & (red > blue * 1.35) & (green > blue * 1.05)
    pink = (red > 125) & (blue > 68) & (red > green * 1.08)
    seed = cream | orange | pink

    labels, count = ndimage.label(seed)
    if count:
        sizes = np.bincount(labels.ravel())
        keep = sizes >= 22
        keep[0] = False
        seed = keep[labels]

    nearby = ndimage.binary_dilation(seed, iterations=17)
    outline = nearby & (maximum < 92)
    mask = ndimage.binary_closing(ndimage.binary_dilation(seed, iterations=1) | outline, iterations=1)
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
    crop.putalpha(alpha)
    crop.save(OUTPUT / output)


def soft_crop(
    source: Image.Image,
    box: tuple[int, int, int, int],
    output: str,
    *,
    horizontal_fade: int = 18,
    vertical_fade: int = 28,
) -> None:
    """Blend complex illustrated groups cleanly into the full-width background."""
    crop = source.crop(box).convert("RGBA")
    width, height = crop.size
    x = np.ones(width, dtype=np.float32)
    y = np.ones(height, dtype=np.float32)

    if horizontal_fade:
        ramp = np.linspace(0, 1, horizontal_fade, dtype=np.float32)
        x[:horizontal_fade] = ramp
        x[-horizontal_fade:] = ramp[::-1]
    if vertical_fade:
        ramp = np.linspace(0, 1, vertical_fade, dtype=np.float32)
        y[:vertical_fade] = ramp
        y[-vertical_fade:] = ramp[::-1]

    alpha = np.minimum.outer(y, x)
    crop.putalpha(Image.fromarray((alpha * 255).astype(np.uint8), "L"))
    crop.save(OUTPUT / output)


def subject_cutout(source: Image.Image, box: tuple[int, int, int, int], output: str) -> None:
    """Extract colourful monster artwork from the dark-purple stage."""
    crop = source.crop(box).convert("RGBA")
    rgb = np.asarray(crop)[..., :3].astype(np.int16)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = maximum - minimum

    warm = (red > 108) & (green > 38) & (red > blue * 1.22)
    blue_subject = (blue > 82) & (green > 62) & (blue > red * 1.08)
    pink_subject = (red > 115) & (blue > 66) & (red > green * 1.08)
    green_subject = (green > 78) & (green > red * 1.05) & (green > blue * 0.9)
    cream = (maximum > 145) & (saturation < 115)
    seed = warm | blue_subject | pink_subject | green_subject | cream

    labels, count = ndimage.label(seed)
    if count:
        sizes = np.bincount(labels.ravel())
        keep = sizes >= 35
        keep[0] = False
        seed = keep[labels]

    mask = ndimage.binary_dilation(seed, iterations=6)
    mask = ndimage.binary_closing(mask, iterations=5)
    labels, count = ndimage.label(mask)
    if count:
        sizes = np.bincount(labels.ravel())
        keep = sizes >= 250
        keep[0] = False
        mask = keep[labels]
    mask = ndimage.binary_fill_holes(mask)
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.65))
    crop.putalpha(alpha)
    crop.save(OUTPUT / output)


def poster_art(
    source: Image.Image,
    quad: tuple[int, int, int, int, int, int, int, int],
    output: str,
) -> None:
    """Straighten one of the approved carousel posters into a reusable card asset."""
    width, height = 390, 780
    poster = source.transform(
        (width, height),
        Image.Transform.QUAD,
        quad,
        resample=Image.Resampling.BICUBIC,
    ).convert("RGBA")

    # The approved posters use clipped comic-book corners rather than a generic
    # rounded rectangle. Keeping that silhouette makes every moving card feel
    # like the original key art instead of an ordinary UI tile.
    inset = 9
    cut = 28
    mask = Image.new("L", poster.size, 0)
    ImageDraw.Draw(mask).polygon(
        [
            (inset + cut, inset),
            (width - inset - cut, inset),
            (width - inset, inset + cut),
            (width - inset, height - inset - cut),
            (width - inset - cut, height - inset),
            (inset + cut, height - inset),
            (inset, height - inset - cut),
            (inset, inset + cut),
        ],
        fill=255,
    )
    poster.putalpha(mask.filter(ImageFilter.GaussianBlur(0.65)))
    poster.save(SPINNER_OUTPUT / output)


OUTPUT.mkdir(parents=True, exist_ok=True)
SPINNER_OUTPUT.mkdir(parents=True, exist_ok=True)

# Host lobby
host = screen("host-lobby")
rounded(host, (25, 30, 135, 136), "host-back.png", 28)
rounded(host, (711, 30, 826, 137), "host-invite-icon.png", 28)
text_art(host, (180, 104, 675, 270), "host-title.png")
rounded(host, (108, 279, 744, 502), "host-room-panel.png", 55)
text_art(host, (250, 499, 610, 576), "host-ready-count.png")
for index, box in enumerate(
    [
        (42, 576, 812, 712),
        (42, 714, 812, 851),
        (42, 854, 812, 991),
        (42, 994, 812, 1131),
        (42, 1133, 812, 1271),
        (42, 1274, 812, 1413),
    ],
    start=1,
):
    rounded(host, box, f"host-player-{index}.png", 34)
rounded(host, (84, 1435, 770, 1610), "host-start.png", 52)
rounded(host, (150, 1617, 703, 1766), "host-invite.png", 43)

# Player waiting lobby
player = screen("player-lobby")
text_art(player, (88, 106, 722, 282), "player-title.png")
rounded(player, (128, 742, 666, 868), "player-name.png", 34)
rounded(player, (28, 892, 766, 1624), "player-wait-panel.png", 52)
rounded(player, (54, 1665, 742, 1902), "player-ready.png", 66)

# Poster carousel
spinner = screen("spinner")
text_art(spinner, (32, 124, 822, 296), "spinner-title.png")
rounded(spinner, (136, 1604, 719, 1792), "spinner-button.png", 58)
poster_art(
    spinner,
    (243, 469, 243, 1234, 613, 1234, 613, 469),
    "meme-master.png",
)
poster_art(
    spinner,
    (88, 573, 63, 1131, 230, 1174, 230, 546),
    "tipsy-doodles.png",
)
poster_art(
    spinner,
    (621, 568, 621, 1198, 798, 1147, 795, 623),
    "chaos-tap.png",
)

# Round reveal
round_screen = screen("round")
rounded(round_screen, (229, 94, 624, 184), "round-pill.png", 25)
text_art(round_screen, (79, 185, 775, 532), "round-title.png")
soft_crop(round_screen, (42, 548, 814, 1560), "round-hero.png", horizontal_fade=22, vertical_fade=28)
rounded(round_screen, (75, 1572, 778, 1765), "round-button.png", 60)

# Winner reveal
winner = screen("winner")
text_art(winner, (48, 118, 810, 362), "winner-title.png")
subject_cutout(winner, (170, 338, 696, 972), "winner-monster.png")
rounded(winner, (41, 973, 814, 1198), "winner-score.png", 47)
text_art(winner, (342, 1198, 514, 1274), "winner-votes-title.png")
for index, box in enumerate(
    [
        (27, 1283, 183, 1511),
        (188, 1283, 345, 1511),
        (350, 1283, 508, 1511),
        (512, 1283, 670, 1511),
        (674, 1283, 831, 1511),
    ],
    start=1,
):
    rounded(winner, box, f"winner-vote-{index}.png", 24)
rounded(winner, (44, 1547, 809, 1738), "winner-button.png", 56)

# Overall standings
standings = screen("standings")
text_art(standings, (77, 103, 779, 358), "standings-title.png")
text_art(standings, (250, 362, 606, 444), "standings-round.png")
for index, box in enumerate(
    [
        (31, 469, 821, 669),
        (31, 686, 821, 851),
        (31, 859, 821, 1027),
        (31, 1034, 821, 1196),
        (31, 1202, 821, 1365),
        (31, 1373, 821, 1535),
    ],
    start=1,
):
    rounded(standings, box, f"standings-row-{index}.png", 36)
rounded(standings, (78, 1571, 776, 1751), "standings-button.png", 56)

# Party progression
progress = screen("progress")
text_art(progress, (72, 105, 803, 370), "progress-title.png")
soft_crop(progress, (24, 414, 829, 1532), "progress-track.png", horizontal_fade=22, vertical_fade=24)
rounded(progress, (53, 1572, 803, 1754), "progress-button.png", 56)

# Final podium
podium = screen("podium")
text_art(podium, (87, 87, 789, 430), "podium-title.png")
soft_crop(podium, (24, 414, 830, 1406), "podium-results.png", horizontal_fade=20, vertical_fade=24)
rounded(podium, (53, 1403, 803, 1590), "podium-play.png", 57)
rounded(podium, (78, 1607, 780, 1737), "podium-share.png", 42)
