#!/usr/bin/env python3
"""Pack an RGBA art sheet into the chess renderer's six-column, two-row atlas.

Input: the project-owned alpha sheet derived from the user's Ottoman playing
piece reference (1000168995), SHA-256
73e55899b9fd80e73b13af76db14afb28ba98183d893e4f250ac32a502794d45.
The upper row supplies the one master silhouette per role; the lower row in
the source is deliberately ignored. Export only colour differences between
the teams, keeping the resized alpha masks bit-for-bit identical.
Usage: python design/build-ottoman-figures-v162.py input.png output.webp
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


CELL = 160
ROLES = 'rnbqkp'
# Deliberate relative heights: the sultan should read as the king at phone size.
HEIGHTS = dict(zip(ROLES, (133, 142, 144, 139, 153, 121), strict=True))
WIDTH_SCALE = dict(zip(ROLES, (1.20, 1.17, 1.05, 1.28, 1.18, 1.26), strict=True))


def fade(values, start, end):
    t = np.clip((values - start) / (end - start), 0, 1)
    return t * t * (3 - 2 * t)


def colours(source, role):
    rgba = np.asarray(source).copy()
    rgb = rgba[:, :, :3] / 255
    red, green, blue = rgb.transpose((2, 0, 1))
    lum = red * .2126 + green * .7152 + blue * .0722
    y = np.linspace(0, 1, source.height)[:, None]
    saturation = (rgb.max(axis=2) - rgb.min(axis=2)) / (rgb.max(axis=2) + .005)

    crimson = fade(red - green - (green - blue) * .84, .018, .19) * fade(.74 - lum, .08, .3)
    emerald = fade(green - red, -.019, .087) * fade(green - blue, -.052, .075)
    pedestal = fade(y, .91, .98)
    carve = fade(lum, .22, .64) * (1 - fade(saturation, .32, .68))
    armour = {
        'r': fade(y, .12, .19) * (1 - fade(y, .82, .90)),
        'n': fade(y, .19, .35) * (1 - fade(y, .86, .94)),
        'b': fade(y, .29, .44) * (1 - fade(y, .86, .94)),
        'q': np.full_like(y, .11),
        'k': .56 * fade(y, .21, .36) + .13,
        'p': .18 * fade(y, .13, .46),
    }[role]

    # Rendered highlights and tiny brass tooling remain visible in the dark set.
    ink = np.stack((.040 + .28 * lum**2, .046 + .31 * lum**2, .065 + .33 * lum**2), axis=2)
    wine = np.stack((.080 + .64 * lum, .019 + .235 * lum, .030 + .31 * lum), axis=2)
    jade = np.stack((.036 + .23 * lum, .074 + .52 * lum, .056 + .31 * lum), axis=2)
    light = rgb.copy()
    if role in 'kp':
        # Keep pale headgear and the sultan's mantle; the fabrics are the cue.
        blend = ((1 - pedestal) * fade(y, .19, .40) * crimson * (.85 if role == 'p' else .73))[:, :, None]
        light = light * (1 - blend) + jade * blend

    mask = (carve * armour * .93)[:, :, None]
    dark = rgb * (1 - mask) + ink * mask
    blend = (np.maximum(emerald * .92, pedestal * emerald) * (1 - .15 * fade(lum, .5, .85)))[:, :, None]
    dark = dark * (1 - blend) + wine * blend
    if role in 'kp':
        blend = (.3 * fade(y, .22, .5) * crimson * (1 - pedestal))[:, :, None]
        dark = dark * (1 - blend) + wine * blend

    def coloured(new_rgb):
        pixels = rgba.copy()
        pixels[:, :, :3] = np.rint(np.clip(new_rgb, 0, 1) * 255).astype(np.uint8)
        return Image.fromarray(pixels)

    return coloured(light), coloured(dark)


def pack(source_path, output_path):
    source = Image.open(source_path).convert('RGBA')
    row = np.asarray(source)[:source.height // 2 - 9].copy()
    labels, _ = ndimage.label(row[:, :, 3] > 24, np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    pieces = [i for i in sizes.argsort()[::-1] if i and sizes[i] > row.shape[0] * 24]
    if len(pieces) != len(ROLES):
        raise ValueError(f'Expected 6 separated alpha silhouettes, found {len(pieces)}')
    pieces.sort(key=lambda piece: np.where(labels == piece)[1].min())
    # Voronoi partition separates the elephant tusks from the vizier's base,
    # whose x bounds overlap in the art sheet. Retain original antialiased edges.
    distances, xy = ndimage.distance_transform_edt(~np.isin(labels, pieces), return_indices=True)
    nearest = labels[xy[0], xy[1]]
    atlas = Image.new('RGBA', (CELL * len(ROLES), CELL * 2))
    for col, (role, piece) in enumerate(zip(ROLES, pieces, strict=True)):
        member = (nearest == piece) & (distances <= 3)
        cutout = row.copy()
        cutout[:, :, 3] = np.where(member, cutout[:, :, 3], 0)
        cutout = Image.fromarray(cutout)
        cutout = cutout.crop(cutout.getbbox(alpha_only=True))
        h = HEIGHTS[role]
        w = round(cutout.width * h / cutout.height * WIDTH_SCALE[role])
        for team, texture in enumerate(colours(cutout, role)):
            texture = texture.resize((w, h), resample=Image.Resampling.LANCZOS)
            atlas.paste(texture, (col * CELL + (CELL - w) // 2, (team + 1) * CELL - h - 3))

    atlas.save(output_path, format='WEBP', quality=91, method=6)
    alpha = np.asarray(Image.open(output_path))[:, :, 3]
    assert np.array_equal(alpha[:CELL], alpha[CELL:]), 'White and black must have identical silhouettes'


if __name__ == '__main__':
    pack(Path(sys.argv[1]), Path(sys.argv[2]))
