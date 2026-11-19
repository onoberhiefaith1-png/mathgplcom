"""Authoring-time recovery of the ten-building artwork from the handoff PDF.

The PDF embeds every exterior/core image at its original pixel size, but as an
opaque JPEG flattened onto the white page (the alpha channel was lost when the
PDF was produced). This recovers genuine alpha:

  * background = near-pure-white pixels connected to the image border
    (flood fill), plus large perfectly flat pure-white enclosed regions
    (an open portal or window that showed the transparent background);
  * a narrow feather band around that region gets graded alpha and the white
    matte is un-mixed out of it (F = (P - (1-a)W) / a), so no white rim;
  * every other pixel stays fully opaque and byte-identical, so pale marble,
    limestone and white ornament are never keyed just for being light.
"""
import sys, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

BG_DIST = 10      # max(255-R,255-G,255-B) at or below this = background white
FLAT_DIST = 3     # enclosed region must be this close to pure white...
FLAT_MIN_AREA = 400  # ...and at least this large to count as a see-through opening
LO, HI = 6, 40    # alpha ramp inside the feather band
BAND = 2          # feather band radius in pixels

def recover(src, dst_png, dst_webp):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape
    dist = (255.0 - a).max(axis=2)
    cand = (dist <= BG_DIST).astype(np.uint8) * 255
    pad = Image.fromarray(np.pad(cand, 1, constant_values=255), "L")
    ImageDraw.floodfill(pad, (0, 0), 128, thresh=0)
    region = (np.asarray(pad)[1:-1, 1:-1] == 128)
    # Enclosed, perfectly flat white openings (portals, arch gaps).
    flat = (dist <= FLAT_DIST) & ~region
    lab, n = ndimage.label(flat)
    sizes = ndimage.sum(flat, lab, index=np.arange(1, n + 1)) if n else np.array([])
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= FLAT_MIN_AREA
    extra = keep[lab]
    # grow each opening across its own JPEG-noisy near-white rim
    extra = ndimage.binary_propagation(extra, mask=(dist <= BG_DIST) & ~region)
    openings = int(keep.sum())
    bg = region | extra
    # Drop tiny isolated specks (JPEG ringing) floating in the background.
    lab2, n2 = ndimage.label(~bg)
    if n2:
        sz = ndimage.sum(~bg, lab2, index=np.arange(1, n2 + 1))
        tiny = np.zeros(n2 + 1, bool); tiny[1:] = sz < 80
        bg = bg | tiny[lab2]
    bg_img = Image.fromarray(bg.astype(np.uint8) * 255, "L")
    near = np.asarray(bg_img.filter(ImageFilter.MaxFilter(2 * BAND + 1))) > 0
    band = near & ~bg
    alpha = np.full((h, w), 255.0, np.float32)
    alpha[bg] = 0
    ramp = np.clip((dist - LO) / (HI - LO), 0, 1) * 255
    alpha[band] = ramp[band]
    # Un-mix the white matte from soft band pixels.
    out = a.copy()
    soft = band & (alpha > 5) & (alpha < 250)
    af = (alpha / 255.0)[..., None]
    unmixed = (a - (1 - af) * 255.0) / np.maximum(af, 1e-3)
    out[soft] = np.clip(unmixed[soft], 0, 255)
    # Hidden colour of fully transparent pixels: bleed nearby subject colour so
    # texture filtering never pulls white into the edge.
    rgb = Image.fromarray(out.astype(np.uint8), "RGB")
    solid = Image.fromarray(((alpha >= 250) * 255).astype(np.uint8), "L")
    bleed = Image.composite(rgb, Image.new("RGB", (w, h), (0, 0, 0)), solid)
    for _ in range(3):
        grown = bleed.filter(ImageFilter.MaxFilter(3))
        cur = np.asarray(bleed); mask_known = cur.sum(axis=2) > 0
        bleed = Image.fromarray(np.where(mask_known[..., None], cur, np.asarray(grown)).astype(np.uint8))
    bl = np.asarray(bleed).astype(np.float32)
    zero = alpha <= 5
    out[zero] = bl[zero]
    alpha[zero] = 0
    rgba = np.dstack([out, alpha]).round().clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    img.save(dst_png, optimize=True)
    img.save(dst_webp, "WEBP", quality=90, method=6, exact=False)
    return dict(w=w, h=h, transparent=float((alpha == 0).mean()), soft=float(((alpha > 0) & (alpha < 255)).mean()), openings=openings)

if __name__ == "__main__":
    src, png, webp = sys.argv[1:4]
    print(json.dumps(recover(src, png, webp)))
