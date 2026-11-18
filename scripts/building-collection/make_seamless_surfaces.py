"""Authoring-time: make generated interior surface art wrap without a seam.

Edge cross-fade: the last B pixels are faded into the first B, and the tile is
shortened by B, so the right edge continues straight into the left edge (and
bottom into top for floors and ceilings). Walls only wrap horizontally — their
skirting and cornice must stay at the bottom and top.
"""
import sys, glob, os
import numpy as np
from PIL import Image
B = 64
def wrap(a, axis):
    n = a.shape[axis]
    t = np.linspace(0, 1, B, dtype=np.float32)
    shape = [1, 1, 1]; shape[axis] = B; t = t.reshape(shape)
    head = np.take(a, range(0, B), axis=axis)
    tail = np.take(a, range(n - B, n), axis=axis)
    mid = np.take(a, range(B, n - B), axis=axis)
    blended = tail * (1 - t) + head * t
    return np.concatenate([blended, mid], axis=axis)
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, "*.jpg"))):
    name = os.path.basename(f)[:-4]
    a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
    a = wrap(a, 1)
    if not name.endswith("-wall"):
        a = wrap(a, 0)
    im = Image.fromarray(a.round().clip(0, 255).astype(np.uint8))
    im.save(os.path.join(dst, name + ".webp"), "WEBP", quality=84, method=6)
    print(name, im.size, os.path.getsize(os.path.join(dst, name + ".webp")))
