#!/usr/bin/env python3
"""Compose FAV volleyball academy EP.3 card-news finals at 880×1168."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 880, 1168
HOT_PINK = (255, 45, 120)
WHITE = (255, 255, 255)
PANEL_INK = (28, 28, 28)

ROOT = Path(__file__).resolve().parent
ASSETS = Path("/opt/cursor/artifacts/assets")
FONT_DIR = ROOT.parent / "fonts"
OUT_BG = ROOT / "backgrounds"
OUT_FINAL = ROOT / "final"
ART_OUT = Path("/opt/cursor/artifacts/cardnews-ep3")

FONT_XB = FONT_DIR / "Pretendard-ExtraBold.ttf"
FONT_B = FONT_DIR / "Pretendard-Bold.ttf"
FONT_SB = FONT_DIR / "Pretendard-SemiBold.ttf"
FONT_M = FONT_DIR / "Pretendard-Medium.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def fit_bg(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    return im.resize((W, H), Image.Resampling.LANCZOS)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_wrapped_center(
    draw: ImageDraw.ImageDraw,
    text: str,
    top: int,
    fnt: ImageFont.FreeTypeFont,
    fill,
    max_width: int,
    line_gap: int = 8,
) -> int:
    chars = list(text)
    lines: list[str] = []
    cur = ""
    for ch in chars:
        trial = cur + ch
        tw, _ = text_size(draw, trial, fnt)
        if tw <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)

    y = top
    for line in lines:
        tw, th = text_size(draw, line, fnt)
        draw.text(((W - tw) // 2, y), line, font=fnt, fill=fill)
        y += th + line_gap
    return y


def draw_ribbon_text(draw: ImageDraw.ImageDraw, text: str) -> None:
    fnt = font(FONT_B, 28)
    draw.text((28, 48), text, font=fnt, fill=WHITE)


def draw_badge_text(base: Image.Image, text: str, size: int = 22) -> None:
    """Draw white label rotated onto the bottom-right pink brush badge."""
    fnt = font(FONT_SB, size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tw, th = text_size(probe, text, fnt)
    while tw > int(W * 0.40) and size > 14:
        size -= 2
        fnt = font(FONT_SB, size)
        tw, th = text_size(probe, text, fnt)

    pad = 6
    label = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(label).text((pad, pad), text, font=fnt, fill=WHITE + (255,))
    rotated = label.rotate(16, expand=True, resample=Image.Resampling.BICUBIC)
    # Badge centroid ~ (700, 1050) on 880×1168
    rx = int(700 - rotated.width / 2)
    ry = int(1045 - rotated.height / 2)
    rx = max(int(W * 0.52), min(rx, W - rotated.width - 12))
    ry = max(int(H * 0.86), min(ry, int(H * 0.93) - rotated.height))
    base.alpha_composite(rotated, (rx, ry))


def draw_body_bullets(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    top: int,
    fill=WHITE,
    size: int = 23,
) -> int:
    """Body copy in the dark title zone (below headline) so the panel art stays clear."""
    fnt = font(FONT_M, size)
    y = top
    max_w = int(W * 0.84)
    for line in lines:
        bullet = "·  " + line
        y = draw_wrapped_center(draw, bullet, y, fnt, fill, max_w, line_gap=2)
        y += 8
    return y


def draw_button(base: Image.Image, label: str, cy: int) -> None:
    draw = ImageDraw.Draw(base)
    fnt = font(FONT_B, 26)
    tw, th = text_size(draw, label, fnt)
    pad_x, pad_y = 36, 16
    bw, bh = tw + pad_x * 2, th + pad_y * 2
    x0 = (W - bw) // 2
    y0 = cy
    draw.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=bh // 2, fill=HOT_PINK)
    draw.text((x0 + pad_x, y0 + pad_y - 2), label, font=fnt, fill=WHITE)


def draw_wing_mark(base: Image.Image, cx: int, cy: int, scale: float = 1.0) -> None:
    """FAV magenta wing mark on footer (white on hot-pink band)."""
    draw = ImageDraw.Draw(base)
    s = scale
    color = WHITE
    left = [
        (cx, cy),
        (cx - int(28 * s), cy - int(8 * s)),
        (cx - int(52 * s), cy - int(4 * s)),
        (cx - int(40 * s), cy + int(6 * s)),
        (cx - int(18 * s), cy + int(4 * s)),
    ]
    right = [
        (cx, cy),
        (cx + int(28 * s), cy - int(8 * s)),
        (cx + int(52 * s), cy - int(4 * s)),
        (cx + int(40 * s), cy + int(6 * s)),
        (cx + int(18 * s), cy + int(6 * s)),
        (cx + int(18 * s), cy + int(4 * s)),
    ]
    # fix right polygon
    right = [
        (cx, cy),
        (cx + int(28 * s), cy - int(8 * s)),
        (cx + int(52 * s), cy - int(4 * s)),
        (cx + int(40 * s), cy + int(6 * s)),
        (cx + int(18 * s), cy + int(4 * s)),
    ]
    draw.polygon(left, fill=color)
    draw.polygon(right, fill=color)
    r = int(5 * s)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


# Pair by illustration meaning (발/시선/손/몸/클로징) + spotlight cover as card 01 hook.
# Cover uses only EP.3 framing already present in series badge copy — no new marketing lines.
CARDS = [
    {
        # Spotlight ball = series opener; ribbon/badge from shared EP.3 label only
        "id": "01",
        "bg": "ep3-01-bg.png",
        "ribbon": "EP.3",
        "title": "배구부 성장일지",
        "body": [],
        "badge": "배구부 성장일지 EP.3",
        "kind": "cover",
    },
    {
        "id": "02",
        "bg": "ep3-02-bg.png",
        "ribbon": "1단계 · 발",
        "title": "배구가 발부터 들어온다.",
        "body": [
            "계단 오를 때 무릎부터 먼저 굽힌다.",
            "서 있기만 해도 두 발이 어깨너비로 벌어진다.",
            "쉬는 시간에 자꾸 제자리 점프를 한다.",
        ],
        "badge": "배구부 성장일지 EP.3",
        "kind": "stage",
    },
    {
        "id": "03",
        "bg": "ep3-03-bg.png",
        "ribbon": "2단계 · 시선",
        "title": "배구가 시선부터 들어온다.",
        "body": [
            "지나가는 배구 중계 화면에 시선이 멈춘다.",
            "체육관 앞을 지나가면 발이 느려진다.",
            "휴대폰보다 코트를 먼저 본다.",
        ],
        "badge": "배구부 성장일지 EP.3",
        "kind": "stage",
    },
    {
        "id": "04",
        "bg": "ep3-04-bg.png",
        "ribbon": "3단계 · 손",
        "title": "손이 먼저 자세를 기억한다.",
        "body": [
            "한 손에 잡히는 물건이 전부 토스 연습 도구가 된다.",
            "붓을 들면 스파이크, 스마트폰을 들면 세트 자세.",
            "벽에 등을 대고 서 있어도 팔이 먼저 둥글게 모인다.",
        ],
        "badge": "배구부 성장일지 EP.3",
        "kind": "stage",
    },
    {
        "id": "05",
        "bg": "ep3-05-bg.png",
        "ribbon": "4단계 · 몸",
        "title": "몸이 코트의 일부가 된다.",
        "body": [
            "TV에 배구 중계가 나오면 몸이 먼저 움직인다.",
            "좋은 장면이 나오면 같이 소리를 낸다.",
            "잠결에도 리시브하는 꿈을 꾼다.",
        ],
        "badge": "배구부 성장일지 EP.3",
        "kind": "stage",
    },
    {
        "id": "06",
        "bg": "ep3-06-bg.png",
        "ribbon": None,
        "title": "어느새 여기까지 왔다",
        "body": [
            "한 번 빠지면 끝이 없는 운동.",
            "코트 밖에서도 멈추지 못하는 사람이 됐다.",
        ],
        "badge": "다음 이야기가 궁금하다면 팔로우!",
        "button": "1탄 먼저 보기",
        "kind": "closing",
    },
]


def compose(card: dict) -> Image.Image:
    base = fit_bg(ASSETS / card["bg"])
    draw = ImageDraw.Draw(base)

    if card.get("ribbon"):
        draw_ribbon_text(draw, card["ribbon"])

    title_size = 52 if card["kind"] == "cover" else 42
    title_fnt = font(FONT_XB, title_size)
    title_top = int(H * 0.105)
    title_bottom = draw_wrapped_center(
        draw, card["title"], title_top, title_fnt, WHITE, int(W * 0.86), line_gap=8
    )

    if card["body"]:
        # Keep body inside title zone (~below title, above white panel ~34%)
        body_top = title_bottom + 18
        body_size = 21 if len(card["body"]) >= 3 else 23
        draw_body_bullets(draw, card["body"], body_top, fill=WHITE, size=body_size)

    if card.get("button"):
        # Closing CTA sits in lower panel clear zone above badge
        draw_button(base, card["button"], int(H * 0.795))

    if card.get("badge"):
        badge_size = 18 if len(card["badge"]) > 16 else 22
        draw_badge_text(base, card["badge"], size=badge_size)

    draw_wing_mark(base, W // 2, int(H * 0.975), scale=0.85)
    return base.convert("RGB")


def main() -> None:
    OUT_BG.mkdir(parents=True, exist_ok=True)
    OUT_FINAL.mkdir(parents=True, exist_ok=True)
    ART_OUT.mkdir(parents=True, exist_ok=True)

    for i in range(1, 7):
        src = ASSETS / f"ep3-0{i}-bg.png"
        bg = fit_bg(src).convert("RGB")
        bg.save(OUT_BG / f"ep3-0{i}-bg.png", "PNG", optimize=True)

    for card in CARDS:
        out = compose(card)
        name = f"ep3-card-{card['id']}-final.png"
        out.save(OUT_FINAL / name, "PNG", optimize=True)
        out.save(ART_OUT / name, "PNG", optimize=True)
        print("wrote", name, out.size)

    for p in OUT_BG.glob("*.png"):
        Image.open(p).save(ART_OUT / p.name, "PNG", optimize=True)

    print("done")


if __name__ == "__main__":
    main()
