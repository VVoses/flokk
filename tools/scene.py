"""Scripted headless run of the game.
usage: python3 tools/scene.py [--size WxH] [--nostart] STEP...
steps:  js:CODE        evaluate CODE in the page (dev.* helpers available; result printed if not undefined)
        wait:MS        let the game run
        key:CODE:MS    hold a key (e.g. key:KeyD:1500)
        shot:NAME      screenshot to tools/out/NAME.png
Prints page errors at the end (exit code 1 if any)."""
from playwright.sync_api import sync_playwright
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out=os.path.join(root,'tools','out');os.makedirs(out,exist_ok=True)
args=sys.argv[1:];w,h=1100,700;start=True
if args and args[0]=='--size':w,h=map(int,args[1].split('x'));args=args[2:]
if args and args[0]=='--nostart':start=False;args=args[1:]
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':w,'height':h})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1200)
    if start:pg.click('#startBtn');pg.wait_for_timeout(400)
    for s in args:
        kind,_,rest=s.partition(':')
        if kind=='js':
            r=pg.evaluate(f"(()=>{{const r=(()=>{{return {rest}}})();return r===undefined?null:JSON.stringify(r)}})()")
            if r is not None:print(r)
        elif kind=='wait':pg.wait_for_timeout(int(rest))
        elif kind=='key':k,ms=rest.split(':');pg.keyboard.down(k);pg.wait_for_timeout(int(ms));pg.keyboard.up(k)
        elif kind=='shot':pg.screenshot(path=os.path.join(out,rest+'.png'));print('shot',rest)
    print('errors:',errs or 'none');b.close();sys.exit(1 if errs else 0)
