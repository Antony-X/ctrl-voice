"""Make a labelled contact sheet from slide-*.png files in a folder."""
import sys, glob, os
from PIL import Image, ImageDraw
folder, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 800
import re
pat = sys.argv[5] if len(sys.argv) > 5 else "slide-*.png"
num = lambda f: [float(x) if x.replace(".", "", 1).isdigit() else x for x in re.findall(r"\d+\.\d+|\d+|\D+", os.path.basename(f))]
files = sorted(glob.glob(os.path.join(folder, pat)), key=num)
ims = [Image.open(f).convert("RGB") for f in files]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 16) + 16, rows * (th + 40) + 16), (60, 60, 60))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    r, c = divmod(i, cols)
    x, y = 16 + c * (tw + 16), 16 + r * (th + 40)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 24))
    d.text((x, y + 4), os.path.basename(files[i]), fill=(255, 255, 255))
sheet.save(out)
print(out, sheet.size)
