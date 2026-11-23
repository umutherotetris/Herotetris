"""Pack the rendered transparent tiles into a single lightweight WebP."""
from pathlib import Path
from PIL import Image, ImageChops
import sys

TILE = 144
SOURCE = Path(sys.argv[1])
TARGET = Path(sys.argv[2])

art = Image.new('RGBA', (6*TILE, 2*TILE))
for col, kind in enumerate('rnbqkp'):
    teams = []
    for row, side in enumerate(('w', 'b')):
        image = Image.open(SOURCE / f'{side}{kind}.png').convert('RGBA')
        assert image.size == (TILE, TILE), (kind, side, image.size)
        box = image.getchannel('A').getbbox()
        assert box and box[0] >= 2 and box[1] >= 2 and box[2] <= TILE-2 and box[3] <= TILE-2, (kind, side, box)
        teams.append(image)
        art.paste(image, (col*TILE, row*TILE))
    assert ImageChops.difference(teams[0].getchannel('A'), teams[1].getchannel('A')).getbbox() is None, kind
    assert ImageChops.difference(teams[0].convert('RGB'), teams[1].convert('RGB')).getbbox(), kind

art.save(TARGET, format='WEBP', quality=88, method=6, alpha_quality=100)
print(f'{TARGET}: {art.width} × {art.height}, {TARGET.stat().st_size:,} bytes, 12 tiles, no clipping, exact paired silhouettes')
