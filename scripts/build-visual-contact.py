from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path('.visual-check')
FILES = [ROOT / f'sweep-{i:02d}.jpg' for i in range(1, 13)]

thumb_size = 112
pad = 6
cols, rows = 4, 3
sheet = Image.new('RGB', (
    cols * thumb_size + (cols + 1) * pad,
    rows * thumb_size + (rows + 1) * pad,
), '#100b07')

draw = ImageDraw.Draw(sheet)
for i, path in enumerate(FILES):
    image = Image.open(path).convert('RGB')
    w, h = image.size
    side = min(w, h)
    left = (w - side) // 2
    top = max(0, (h - side) // 2)
    image = image.crop((left, top, left + side, top + side))
    image = ImageOps.fit(image, (thumb_size, thumb_size), method=Image.Resampling.LANCZOS)
    x = pad + (i % cols) * (thumb_size + pad)
    y = pad + (i // cols) * (thumb_size + pad)
    sheet.paste(image, (x, y))
    draw.rectangle((x + 3, y + 3, x + 24, y + 22), fill='#17100c')
    draw.text((x + 8, y + 6), str(i + 1), fill='#f3d6a7')

sheet.save(ROOT / 'levels-contact.jpg', quality=70)

# Tiny XPM representation that can be reviewed directly through GitHub text tools.
keys = list('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~')
preview = sheet.resize((64, 48), Image.Resampling.LANCZOS)
q = preview.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
raw = q.getpalette()[:192]
palette = [tuple(raw[i:i + 3]) for i in range(0, 192, 3)]
pixels = list(q.getdata())

with (ROOT / 'review-levels.xpm').open('w') as f:
    f.write('/* XPM */\nstatic char * review[] = {\n')
    f.write(f'"64 48 {len(palette)} 1",\n')
    for i, (r, g, b) in enumerate(palette):
        f.write(f'"{keys[i]} c #{r:02x}{g:02x}{b:02x}",\n')
    for y in range(48):
        row = ''.join(keys[v] for v in pixels[y * 64:(y + 1) * 64])
        comma = ',' if y < 47 else ''
        f.write(f'"{row}"{comma}\n')
    f.write('};\n')
