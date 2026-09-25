"""Visual survey: one fixed land, many seasons/times/places. Writes tools/out/survey/<tag>_*.png and contact sheets.
usage: python3 tools/survey.py TAG [SEED]"""
from playwright.sync_api import sync_playwright
from PIL import Image
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag=sys.argv[1] if len(sys.argv)>1 else 'a';seed=sys.argv[2] if len(sys.argv)>2 else '424242'
out=os.path.join(root,'tools','out','survey');os.makedirs(out,exist_ok=True)
SPOT={
 'farm':"[FARMS[0].cx,FARMS[0].cy-60]",
 'lake':"[LAKE.x,LAKE.y+LAKE.r*.7]",
 'forest':"(()=>{for(let i=0;i<3000;i++){const x=Math.random()*W,y=900+Math.random()*1400;if(forestness(x,y)>.62&&forestness(x,y+300)<.5&&!inWater(x,y,300))return[x,y+150]}return[W/2,1200]})()",
 'north':"[W*.37,120]",
 'shore':"[W*.6,shoreY(W*.6)-200]",
 'rail':"(()=>{const p=RAIL[(RAIL.length/2)|0];return[p[0],p[1]]})()",
}
shots=[('farm',s,h,1.0) for s in range(4) for h in (8,15,20)]+[('farm',1,23,1.0),('farm',3,23,1.0),('farm',0,5,1.0)]
shots+=[(k,1,12,1.0) for k in ('lake','forest','north','shore','rail')]+[('lake',3,12,1.0),('forest',2,12,1.0),('farm',1,12,0.6),('farm',1,12,1.9)]
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':800})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1200)
    pg.evaluate(f"genWorld({seed});landLabels()")
    pg.click('#startBtn');pg.wait_for_timeout(400)
    files=[]
    for i,(spot,s,h,z) in enumerate(shots):
        pg.evaluate(f"(()=>{{dev.calm();dev.season({s},{h});const p={SPOT[spot]};dev.to(p[0],p[1],{z});}})()")
        pg.wait_for_timeout(1800)
        pg.evaluate(f"(()=>{{const p={SPOT[spot]};dev.to(p[0],p[1],{z});}})()");pg.wait_for_timeout(250)
        f=os.path.join(out,f'{tag}_{i:02d}_{spot}_s{s}_h{h}_z{z}.png');pg.screenshot(path=f);files.append(f)
    # the screens
    pg.evaluate("dev.season(1,16)");pg.keyboard.press('Escape');pg.wait_for_timeout(500)
    f=os.path.join(out,f'{tag}_ui_pause.png');pg.screenshot(path=f);files.append(f)
    b.close()
    # contact sheets of 6
    for k in range(0,len(files),6):
        ims=[Image.open(f).convert('RGB').resize((640,400)) for f in files[k:k+6]]
        sheet=Image.new('RGB',(1280,1200),'black')
        for j,im in enumerate(ims):sheet.paste(im,((j%2)*640,(j//2)*400))
        sheet.save(os.path.join(out,f'{tag}_sheet{k//6}.png'))
    print(len(files),'shots; errors:',errs or 'none')
