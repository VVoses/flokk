"""Night lights check: python3 tools/night.py TAG [SEASON] [HOUR] [SEED] -> tools/out/survey/TAG_night.png
Three views: farm yard, a vehicle on the road, the train."""
from playwright.sync_api import sync_playwright
from PIL import Image
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag=sys.argv[1];season=int(sys.argv[2]) if len(sys.argv)>2 else 2;hour=float(sys.argv[3]) if len(sys.argv)>3 else 21.5
seed=sys.argv[4] if len(sys.argv)>4 else '424242'
out=os.path.join(root,'tools','out','survey');os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':800})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1200)
    pg.evaluate(f"genWorld({seed})");pg.click('#startBtn');pg.wait_for_timeout(300)
    pg.evaluate(f"(()=>{{dev.calm();dev.season({season},{hour})}})()");pg.wait_for_timeout(900)
    views=[f"dev.hour({hour});dev.to(FARMS[0].cx+60,FARMS[0].cy,1.0)",
      f"dev.hour({hour});TRAFFIC.length=0;spawnVehicle();const v=TRAFFIC[0];v.s=RD.sAt(FARMS[0].cx+400);v.kind='car';dev.to(FARMS[0].cx+400,roadAt(v.s).y,1.2)",
      f"dev.hour({hour});spawnTrain();const x=FARMS[0].cx-300;TRAIN.s=railSAtX(x);dev.to(x,railAt?railAt(TRAIN.s).y:FARMS[0].cy,0.9)"]
    ims=[]
    for i,v in enumerate(views):
        try: pg.evaluate("(()=>{"+v+"})()")
        except Exception as e: print('view',i,e)
        pg.wait_for_timeout(500)
        if i==1: pg.evaluate("(()=>{const v=TRAFFIC[0];if(v)dev.to(v.x,v.y,1.2)})()")
        if i==2: pg.evaluate("(()=>{if(TRAIN){const c=TRAIN.cars[0];dev.to(c.x,c.y,0.9)}})()")
        pg.wait_for_timeout(150)
        f=os.path.join(out,f'{tag}_n{i}.png');pg.screenshot(path=f);ims.append(Image.open(f).convert('RGB'))
    sheet=Image.new('RGB',(1280,800*len(ims)//2+400))
    sheet=Image.new('RGB',(640*len(ims),400))
    for i,im in enumerate(ims):sheet.paste(im.resize((640,400)),(i*640,0))
    sheet.save(os.path.join(out,f'{tag}_night.png'));print('errors:',errs or 'none');b.close()
