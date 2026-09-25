"""One place in all four seasons: python3 tools/seasons.py TAG [HOUR] [X,Y,ZOOM] [SEED] -> tools/out/survey/TAG_seasons.png
Default place: just south-east of the main farm."""
from playwright.sync_api import sync_playwright
from PIL import Image
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag=sys.argv[1];hour=float(sys.argv[2]) if len(sys.argv)>2 else 12
where=sys.argv[3] if len(sys.argv)>3 else 'FARMS[0].cx+200,FARMS[0].cy+120,0.8'
seed=sys.argv[4] if len(sys.argv)>4 else '424242'
out=os.path.join(root,'tools','out','survey');os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':800})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1200)
    pg.evaluate(f"genWorld({seed})");pg.click('#startBtn');pg.wait_for_timeout(300)
    ims=[]
    for s in range(4):
        pg.evaluate(f"(()=>{{dev.calm();dev.season({s},{hour});dev.to({where})}})()");pg.wait_for_timeout(2200)
        pg.evaluate(f"(()=>{{dev.to({where})}})()");pg.wait_for_timeout(200)
        f=os.path.join(out,f'{tag}_s{s}.png');pg.screenshot(path=f);ims.append(Image.open(f).convert('RGB').resize((640,400)))
    sheet=Image.new('RGB',(1280,800))
    for i,im in enumerate(ims):sheet.paste(im,((i%2)*640,(i//2)*400))
    sheet.save(os.path.join(out,f'{tag}_seasons.png'));print('errors:',errs or 'none');b.close()
