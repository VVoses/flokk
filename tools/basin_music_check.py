"""Bounded water conservation/reflection and offline music audibility checks."""
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = root / 'tools/out/basin-music'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1000, 'height': 700})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.wait_for_function('!MENU_JOB && birds.length')
    stats = page.evaluate('''() => {
      st.mode='pause';basinInit();WEATHER.s=0;
      const b=BASINS.list[0], pond=BASINS.list[1];
      for(const q of BASINS.list){q.h.fill(0);q.v.fill(0);q.next.fill(0);q.time=0;}
      const k=b.half*b.n+b.half;
      b.h[k]=1;b.h[k+1]=-1;
      const energy=()=>{
        let e=0;
        for(let k=0;k<b.h.length;k++) if(b.mask[k]) {
          e+=.5*b.v[k]*b.v[k];
          for(const q of [k+1,k+b.n]) if(b.mask[q]) e+=.5*35*35/(b.cell*b.cell)*(b.h[k]-b.h[q])**2;
        }
        return e;
      };
      const before=energy();
      for(let i=0;i<300;i++) basinStep(b,1/30);
      let volume=0, velocity=0, finite=true;
      for(let k=0;k<b.h.length;k++) if(b.mask[k]) {
        volume+=b.h[k];velocity+=b.v[k];finite &&= Number.isFinite(b.h[k])&&Number.isFinite(b.v[k]);
      }
      // A constant level next to a shoreline has no spatial acceleration: land reflects, rather than draining it.
      const small={n:5,cell:12,half:2,time:0,count:2,c:LAKE,phase:0,
        h:new Float32Array(25),v:new Float32Array(25),next:new Float32Array(25),mask:new Uint8Array(25)};
      small.mask[12]=small.mask[13]=1;small.h[12]=small.h[13]=1;
      basinStep(small,1/30);
      const noLeak=small.next[12]===0&&small.next[13]===0;
      const sample=basinSample(LAKE.x,LAKE.y),copy=basinSample(LAKE.x-W,LAKE.y);
      return {volume,velocity,finite,decay:energy()/before,noLeak,
        isolated:pond.h.every(v=>v===0),seam:JSON.stringify(sample)===JSON.stringify(copy)};
    }''')
    assert stats['finite'] and abs(stats['volume']) < 1e-5 and abs(stats['velocity']) < 1e-5, stats
    assert stats['decay'] < .05 and stats['isolated'] and stats['noLeak'] and stats['seam'], stats
    print('ok closed-basin volume, damping, no-flux shore, isolation and seam', stats)
    page.evaluate('''st.mode='pause';hideBanner();$('titleOv').hidden=true;syncHud();genWorld(7);dev.season(1,13);growTick(0);
      WEATHER.s=1;WEATHER.gc=.8;WEATHER.gs=.6;basinInit();
      for(let i=0;i<900;i++) basinTick(1/30);''')
    motion = page.evaluate('''() => {
      const b=BASINS.list[0];let active=0, positive=0, negative=0, volume=0;
      for(let k=0;k<b.h.length;k++) if(b.mask[k]) {
        active+=b.force[k]!==0;positive+=b.v[k]>.0001;negative+=b.v[k]<-.0001;volume+=b.h[k];
      }
      return {coverage:active/b.count,positive,negative,volume,
        finite:b.h.every(Number.isFinite)&&b.v.every(Number.isFinite)};
    }''')
    assert 0 < motion['coverage'] < .6 and motion['positive'] > 10 and motion['negative'] > 10, motion
    assert motion['finite'] and abs(motion['volume']) < 1e-4, motion
    print('ok localized forcing, opposing surface motion and wind-driven conservation', motion)
    sheen = page.evaluate('''() => {
      dev.to(LAKE.x,LAKE.y,.95);
      const sum=()=>{let v=0;for(const b of BASINS.list) for(let k=3;k<b.img.data.length;k+=4) v+=b.img.data[k];return v;};
      WEATHER.s=0;drawClosedBasins(ctx);const calm=sum();
      WEATHER.s=1;drawClosedBasins(ctx);const windy=sum();
      return {calm,windy};
    }''')
    assert sheen['windy'] > sheen['calm'], sheen
    print('ok shared gust field adds a wind-dependent water sheen', sheen)
    for name in ['LAKE', 'POND']:
        page.evaluate(f'dev.to({name}.x,{name}.y,.95);render();')
        page.screenshot(path=str(out / (name.lower()+'.png')))
    for season in range(4):
        music = page.evaluate('''async season => {
          SEASON=season;hawks=[];st.mode='pause';muted=true;amb=null;MUS=null;
          ac=new OfflineAudioContext(2,48000*14,48000);
          master=ac.createGain();master.gain.value=.9;master.connect(ac.destination);
          verb=ac.createGain();verb.gain.value=.16;verb.connect(master);
          musicTick();
          const waits=[];
          for(let t=.2;t<13.9;t+=.2) waits.push(ac.suspend(t).then(()=>{musicTick();return ac.resume();}));
          const buffer=await ac.startRendering();await Promise.all(waits);
          const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
          let sum=0,peak=0,first=-1;
          for(let i=0;i<left.length;i++) {
            const a=Math.max(Math.abs(left[i]),Math.abs(right[i]));
            sum+=(left[i]*left[i]+right[i]*right[i])/2;peak=Math.max(peak,a);
            if(first<0&&a>.001) first=i/48000;
          }
          const pcm=new ArrayBuffer(44+left.length*4),d=new DataView(pcm);
          const str=(at,s)=>{for(let i=0;i<s.length;i++) d.setUint8(at+i,s.charCodeAt(i));};
          str(0,'RIFF');d.setUint32(4,pcm.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');
          d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);
          d.setUint32(24,48000,true);d.setUint32(28,192000,true);d.setUint16(32,4,true);d.setUint16(34,16,true);
          str(36,'data');d.setUint32(40,pcm.byteLength-44,true);
          for(let i=0;i<left.length;i++) {d.setInt16(44+i*4,clamp(left[i],-1,1)*32767,true);d.setInt16(46+i*4,clamp(right[i],-1,1)*32767,true);}
          const bytes=new Uint8Array(pcm);let s='';
          for(let i=0;i<bytes.length;i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192));
          return {rms:Math.sqrt(sum/left.length),peak,first,wav:btoa(s)};
        }''', season)
        (out / f'music-{season}.wav').write_bytes(base64.b64decode(music.pop('wav')))
        assert 0 <= music['first'] < 8 and music['rms'] > .0005 and .002 < music['peak'] < .5, music
        print('ok seasonal music onset, RMS and headroom', season, music)
    cues = page.evaluate('''() => {
      const oldAc=ac, oldJingle=seasonJingle, calls=[];
      ac={currentTime:0};seasonJingle=(season,t,echo=-1)=>{calls.push({season,echo});return 4;};
      SEASON=0;CAL.t=0;hawks=[];st.mode='play';
      MUS={bus:{gain:{setTargetAtTime(){}}},key:musicSeasonKey(),arrival:3,echo:0,level:1,busyUntil:0};
      ac.currentTime=3;musicTick();musicTick();const once=calls.length===1;
      ac.currentTime=20;CAL.t=100;musicTick();musicTick();const first=calls.length===2&&calls[1].echo===0;
      st.mode='pause';ac.currentTime=30;CAL.t=210;musicTick();const paused=calls.length===2;
      st.mode='play';hawks=[{state:'dive'}];musicTick();const danger=calls.length===2;
      hawks=[];CAL.t=270;musicTick();const noBacklog=calls.length===3&&MUS.echo===3;
      ac.currentTime=40;SEASON=1;CAL.t=300;musicTick();ac.currentTime=40.5;musicTick();
      const transition=calls.length===4&&calls[3].season===1&&calls[3].echo===-1;
      SEASON=0;CAL.t=0;const keyBefore=musicSeasonKey();CAL.t=1200;
      const newYear=musicSeasonKey()!==keyBefore;
      CAL.t=210;const resumed=musicEchoIndex()===2;
      const oldBanner=seasonBanner,oldMuted=muted;let banners=0;
      seasonBanner=()=>banners++;muted=false;st.mode='play';CAL.t=0;SEASON=0;
      beginSeasonIntro();seasonIntroTick(11.9);ac.currentTime=100;musicTick();
      const delayed=banners===0&&openingSeasonCue.remaining>0;
      st.mode='pause';const left=openingSeasonCue.remaining;seasonIntroTick(5);
      const introPause=openingSeasonCue.remaining===left;
      st.mode='play';seasonIntroTick(.2);const count=calls.length;musicTick();
      const synced=banners===1&&calls.length===count+1&&openingSeasonCue===null;
      muted=true;beginSeasonIntro();seasonIntroTick(12);
      const mutedBanner=banners===2&&openingSeasonCue===null;
      seasonBanner=oldBanner;muted=oldMuted;
      ac=oldAc;seasonJingle=oldJingle;MUS=null;
      return {once,first,paused,danger,noBacklog,transition,newYear,resumed,delayed,introPause,synced,mutedBanner};
    }''')
    assert all(cues.values()), cues
    print('ok composed arrival, calendar echoes, pause/danger gating and no backlog', cues)
    assert not errors, errors
    browser.close()
