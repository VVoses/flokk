/* Flokk - admin.js
   Hidden admin panel: jump straight to a season, hour or weather, for looking around and testing.
   Loaded only when the page is opened with ?debug=1 (see the end of index.html), and even then stays
   out of sight until toggled with Ctrl+Shift+D, so a normal player never sees or loads it.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
(function () {
  function setSeason(s) {
    const hour = CAL.hour;
    CAL.t = s * DAYS_PER_SEASON * DAY_LEN + (((hour - START_HOUR + 24) % 24) / 24) * DAY_LEN;
    calUpdate();
    applySeason(s);
    TRANS.t = 1;
    TRANS.prevG = null;
    TRANS.prevSPR = null;
  }
  function setHour(h) {
    const day = Math.floor(CAL.t / DAY_LEN);
    CAL.t = day * DAY_LEN + (((h - START_HOUR + 24) % 24) / 24) * DAY_LEN;
    calUpdate();
  }
  // pin the wind/fog the way dev.weather() does, so it holds until unpinned
  function pinWeather(o) {
    if (!o) return (WEATHER.pin = null);
    const p = {};
    if (o.s !== undefined) p.sT = WEATHER.s = o.s;
    if (o.ang !== undefined) p.angT = WEATHER.ang = o.ang;
    if (o.fog !== undefined) p.fogT = WEATHER.fog = o.fog;
    WEATHER.pin = p;
    weatherTick(0);
  }
  function clearRain() {
    RAIN.target = RAIN.t = 0;
    RAIN.next = 999;
  }
  function setRain(v) {
    RAIN.target = RAIN.t = v;
    RAIN.next = 999;
  }
  const WEATHER_PRESETS = {
    clear() {
      clearRain();
      pinWeather({ s: 0.5, ang: WEATHER.ang, fog: 0 });
    },
    rain() {
      setRain(0.85);
      pinWeather({ s: 0.9, ang: 0.15, fog: 0 });
    },
    snow() {
      // snowfall itself is automatic in winter (light.js); a stiff wind is what drives it into a visible storm
      setSeason(3);
      pinWeather({ s: 1.3, ang: 0.2, fog: 0 });
    },
    fog() {
      pinWeather({ s: WEATHER.s, ang: WEATHER.ang, fog: 0.85 });
    },
    gale() {
      pinWeather({ s: 1.6, ang: rr(0, TAU), fog: 0 });
    }
  };

  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const HOURS = [
    ['Dawn', 6],
    ['Morning', 9],
    ['Noon', 13],
    ['Evening', 18],
    ['Night', 22],
    ['Midnight', 1]
  ];
  const WEATHERS = [
    ['Clear', 'clear'],
    ['Rain', 'rain'],
    ['Snow', 'snow'],
    ['Fog', 'fog'],
    ['Gale', 'gale']
  ];

  function row(label, buttons, onClick) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:4px 0;flex-wrap:wrap';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = 'width:52px;opacity:0.65;flex:0 0 auto';
    r.appendChild(l);
    for (const [text, val] of buttons) {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText =
        'font:inherit;font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.25);' +
        'background:rgba(255,255,255,0.08);color:#f6f3ea;cursor:pointer';
      b.onclick = () => onClick(val);
      r.appendChild(b);
    }
    return r;
  }

  const panel = document.createElement('div');
  panel.id = 'adminPanel';
  panel.hidden = true;
  panel.style.cssText =
    'position:fixed;left:10px;bottom:10px;z-index:9999;background:rgba(20,26,20,0.86);color:#f6f3ea;' +
    'font:12px/1.3 ui-sans-serif,system-ui,sans-serif;padding:10px 12px;border-radius:8px;' +
    'border:1px solid rgba(255,255,255,0.18);pointer-events:auto;user-select:none;max-width:280px';
  const title = document.createElement('div');
  title.textContent = 'Admin (ctrl+shift+D to hide)';
  title.style.cssText = 'font-weight:600;margin-bottom:6px;opacity:0.85';
  panel.appendChild(title);
  panel.appendChild(
    row(
      'Season',
      SEASON_NAMES.map((n, i) => [n, i]),
      s => setSeason(s)
    )
  );
  panel.appendChild(row('Time', HOURS, h => setHour(h)));
  panel.appendChild(row('Weather', WEATHERS, k => WEATHER_PRESETS[k]()));
  document.body.appendChild(panel);

  addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault();
      panel.hidden = !panel.hidden;
    }
  });
})();
