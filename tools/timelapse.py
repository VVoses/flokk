"""One place through a day: python3 tools/timelapse.py TAG SEASON "h1,h2,..." [SEED]  -> tools/out/survey/TAG_day.png"""
from playwright.sync_api import sync_playwright
from PIL import Image
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag,season,hours=sys.argv[1],int(sys.argv[2]),[float(h) for h in sys.argv[3].split(',')];seed=sys.argv[4] if len(sys.argv)>4 else '424242'
out=os.path.join(root,'tools','out','survey');os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':800})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1200)
    pg.evaluate(f"genWorld({seed})");pg.click('#startBtn');pg.wait_for_timeout(300)
    ims=[]
    for h in hours:
        pg.evaluate(f"(()=>{{dev.calm();dev.season({season},{h});dev.to(FARMS[0].cx+150,FARMS[0].cy-40,1.0)}})()");pg.wait_for_timeout(900)
        pg.evaluate(f"(()=>{{dev.hour({h});dev.to(FARMS[0].cx+150,FARMS[0].cy-40,1.0)}})()");pg.wait_for_timeout(250)
        f=os.path.join(out,f'{tag}_h{h}.png');pg.screenshot(path=f);ims.append(Image.open(f).convert('RGB').resize((427,267)))
    cols=3;rows=(len(ims)+cols-1)//cols;sheet=Image.new('RGB',(427*cols,267*rows))
    for i,im in enumerate(ims):sheet.paste(im,((i%cols)*427,(i//cols)*267))
    sheet.save(os.path.join(out,f'{tag}_day.png'));print('errors:',errs or 'none');b.close()
