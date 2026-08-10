from pathlib import Path
from PIL import Image
import json

src = Path('assets/workshop/goals/ball_blue.png')
out = Path('.visual-check')
out.mkdir(exist_ok=True)

img = Image.open(src).convert('RGBA')
alpha = img.getchannel('A')
bbox = alpha.getbbox()
meta = {
    'size': img.size,
    'alpha_bbox': bbox,
    'bbox_width_ratio': round((bbox[2]-bbox[0]) / img.width, 4) if bbox else 0,
    'bbox_height_ratio': round((bbox[3]-bbox[1]) / img.height, 4) if bbox else 0,
    'center_alpha': alpha.getpixel((img.width//2, img.height//2)),
}
(out / 'ball-alpha.json').write_text(json.dumps(meta, indent=2))

# Composite alpha over a checkerboard so transparent padding / holes are visible.
cell = 20
bg = Image.new('RGB', img.size, '#d8d8d8')
p = bg.load()
for y in range(img.height):
    for x in range(img.width):
        if ((x//cell)+(y//cell)) % 2:
            p[x,y] = (242,242,242)
rgba_bg = bg.convert('RGBA')
rgba_bg.alpha_composite(img)
preview = rgba_bg.convert('RGB').resize((48,48), Image.Resampling.LANCZOS)
q = preview.quantize(colors=48, method=Image.Quantize.MEDIANCUT)
keys = list('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~')
raw = q.getpalette()[:144]
palette = [tuple(raw[i:i+3]) for i in range(0,144,3)]
pixels = list(q.getdata())
with (out / 'review-ball.xpm').open('w') as f:
    f.write('/* XPM */\nstatic char * review[] = {\n')
    f.write(f'"48 48 {len(palette)} 1",\n')
    for i,(r,g,b) in enumerate(palette):
        f.write(f'"{keys[i]} c #{r:02x}{g:02x}{b:02x}",\n')
    for y in range(48):
        row = ''.join(keys[v] for v in pixels[y*48:(y+1)*48])
        comma = ',' if y < 47 else ''
        f.write(f'"{row}"{comma}\n')
    f.write('};\n')
