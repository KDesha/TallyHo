from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "app-store-assets" / "raw"
OUTPUT_DIR = ROOT / "app-store-assets" / "iphone-6.5"
IPAD_RAW_DIR = ROOT / "app-store-assets" / "raw-ipad"
IPAD_OUTPUT_DIR = ROOT / "app-store-assets" / "ipad-13"

CANVAS_SIZE = (1242, 2688)
SCREEN_SIZE = (994, 2150)
SCREEN_ORIGIN = (124, 474)

TITLE_FONT = "/System/Library/Fonts/NewYork.ttf"
BODY_FONT = "/Library/Fonts/SF-Pro-Text-Medium.otf"
LABEL_FONT = "/Library/Fonts/SF-Pro-Display-Semibold.otf"

DARK_GREEN = "#173C31"
BODY_GREEN = "#526A60"
ACCENT_GREEN = "#3D7563"
CREAM = "#F8F5ED"

SCREENS = [
    {
        "source": "01-overview.png",
        "output": "01-know-whats-left.png",
        "title": "Know exactly what’s left.",
        "subtitle": "Plan income, bills, and savings in one clear view.",
        "background": "#F4F0E7",
    },
    {
        "source": "02-calendar.png",
        "output": "02-see-every-bill.png",
        "title": "See every bill before it lands.",
        "subtitle": "A calendar organized around your actual pay cycle.",
        "background": "#EFF4EC",
    },
    {
        "source": "03-weekly-plan.png",
        "output": "03-plan-every-paycheck.png",
        "title": "Turn each paycheck into a plan.",
        "subtitle": "Weekly and biweekly cash flow without spreadsheet chaos.",
        "background": "#F5F1E8",
    },
    {
        "source": "04-can-i-buy.png",
        "output": "04-buy-with-confidence.png",
        "title": "Get a straight answer before you spend.",
        "subtitle": "Check the purchase against your plan, buffer, and timing.",
        "background": "#ECF3EC",
    },
    {
        "source": "05-insights.png",
        "output": "05-see-the-patterns.png",
        "title": "See the patterns behind your plan.",
        "subtitle": "Understand spending, savings, and progress at a glance.",
        "background": "#F4EFE8",
    },
]


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius, fill=255)
    return mask


def fit_font(text: str, path: str, maximum: int, minimum: int, width: int) -> ImageFont.FreeTypeFont:
    for size in range(maximum, minimum - 1, -2):
        font = ImageFont.truetype(path, size)
        box = font.getbbox(text)
        if box[2] - box[0] <= width:
            return font
    return ImageFont.truetype(path, minimum)


def make_screenshot(item: dict[str, str]) -> None:
    canvas = Image.new("RGB", CANVAS_SIZE, item["background"])
    draw = ImageDraw.Draw(canvas)

    # Quiet branded texture behind the product UI.
    draw.ellipse((930, -190, 1390, 270), fill="#E1EADF")
    draw.ellipse((-180, 2320, 260, 2760), fill="#E9E0CF")

    label_font = ImageFont.truetype(LABEL_FONT, 30)
    title_font = fit_font(item["title"], TITLE_FONT, 82, 66, 1080)
    body_font = fit_font(item["subtitle"], BODY_FONT, 38, 31, 1080)

    icon = Image.open(ROOT / "www" / "icon.jpeg").convert("RGB").resize((48, 48), Image.Resampling.LANCZOS)
    canvas.paste(icon, (78, 58), rounded_mask((48, 48), 16))
    draw.text((144, 65), "TALLYHO", font=label_font, fill=ACCENT_GREEN)
    draw.text((78, 125), item["title"], font=title_font, fill=DARK_GREEN)
    draw.text((80, 325), item["subtitle"], font=body_font, fill=BODY_GREEN)

    source = Image.open(RAW_DIR / item["source"]).convert("RGB")
    source = source.resize(SCREEN_SIZE, Image.Resampling.LANCZOS)
    mask = rounded_mask(SCREEN_SIZE, 52)

    shadow = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    shadow_shape = Image.new("RGBA", SCREEN_SIZE, (0, 0, 0, 0))
    shadow_shape.putalpha(mask)
    shadow_shape = shadow_shape.filter(ImageFilter.GaussianBlur(20))
    shadow.alpha_composite(shadow_shape, (SCREEN_ORIGIN[0], SCREEN_ORIGIN[1] + 18))
    shadow_tint = Image.new("RGBA", CANVAS_SIZE, (20, 54, 44, 0))
    shadow_tint.putalpha(shadow.getchannel("A").point(lambda value: int(value * 0.20)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow_tint)

    screen_layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    screen_layer.paste(source.convert("RGBA"), SCREEN_ORIGIN, mask)
    screen_draw = ImageDraw.Draw(screen_layer)
    x, y = SCREEN_ORIGIN
    screen_draw.rounded_rectangle(
        (x, y, x + SCREEN_SIZE[0] - 1, y + SCREEN_SIZE[1] - 1),
        52,
        outline="#D5DDD5",
        width=3,
    )
    canvas = Image.alpha_composite(canvas, screen_layer).convert("RGB")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT_DIR / item["output"], "PNG", optimize=True)


def make_ipad_screenshot(item: dict[str, str]) -> None:
    canvas_size = (2048, 2732)
    screen_size = (1780, 1854)
    screen_origin = (134, 752)
    canvas = Image.new("RGB", canvas_size, item["background"])
    draw = ImageDraw.Draw(canvas)

    draw.ellipse((1570, -300, 2280, 410), fill="#E1EADF")
    draw.ellipse((-260, 2380, 330, 2970), fill="#E9E0CF")

    label_font = ImageFont.truetype(LABEL_FONT, 50)
    title_font = fit_font(item["title"], TITLE_FONT, 126, 94, 1800)
    body_font = fit_font(item["subtitle"], BODY_FONT, 58, 46, 1800)

    icon = Image.open(ROOT / "www" / "icon.jpeg").convert("RGB").resize((78, 78), Image.Resampling.LANCZOS)
    canvas.paste(icon, (120, 86), rounded_mask((78, 78), 24))
    draw.text((226, 98), "TALLYHO", font=label_font, fill=ACCENT_GREEN)
    draw.text((120, 205), item["title"], font=title_font, fill=DARK_GREEN)
    draw.text((122, 506), item["subtitle"], font=body_font, fill=BODY_GREEN)

    source = Image.open(IPAD_RAW_DIR / item["source"]).convert("RGB")
    source = source.resize(screen_size, Image.Resampling.LANCZOS)
    mask = rounded_mask(screen_size, 44)

    shadow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    shadow_shape = Image.new("RGBA", screen_size, (0, 0, 0, 0))
    shadow_shape.putalpha(mask)
    shadow_shape = shadow_shape.filter(ImageFilter.GaussianBlur(26))
    shadow.alpha_composite(shadow_shape, (screen_origin[0], screen_origin[1] + 22))
    shadow_tint = Image.new("RGBA", canvas_size, (20, 54, 44, 0))
    shadow_tint.putalpha(shadow.getchannel("A").point(lambda value: int(value * 0.20)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow_tint)

    screen_layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    screen_layer.paste(source.convert("RGBA"), screen_origin, mask)
    screen_draw = ImageDraw.Draw(screen_layer)
    x, y = screen_origin
    screen_draw.rounded_rectangle(
        (x, y, x + screen_size[0] - 1, y + screen_size[1] - 1),
        44,
        outline="#D5DDD5",
        width=4,
    )
    canvas = Image.alpha_composite(canvas, screen_layer).convert("RGB")

    IPAD_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(IPAD_OUTPUT_DIR / item["output"], "PNG", optimize=True)


def main() -> None:
    for screen in SCREENS:
        make_screenshot(screen)
        make_ipad_screenshot(screen)


if __name__ == "__main__":
    main()
