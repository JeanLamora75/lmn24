#!/usr/bin/env python3
"""Generate the official LMN24 multi-resolution favicon from the existing site logo."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
source = root / "apps/frontend/public/logo_lmn24.png"
target = root / "apps/frontend/public/favicon.ico"

with Image.open(source) as original:
    logo = original.convert("RGBA")
    side = max(logo.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    fitted = ImageOps.contain(logo, (side, side), Image.Resampling.LANCZOS)
    square.alpha_composite(fitted, ((side - fitted.width) // 2, (side - fitted.height) // 2))
    square.save(
        target, format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

with Image.open(target) as icon:
    sizes = icon.ico.sizes()
    assert {(16, 16), (32, 32), (48, 48)}.issubset(sizes), sizes

print(f"Generated {target.relative_to(root)} ({target.stat().st_size} bytes, sizes: {sorted(sizes)})")
