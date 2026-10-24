/* Flokk - journal.js
   A quiet field journal of firsts, kept across flights: the first elk at the forest edge, the first
   fieldfare flock, the aurora. Nothing is shown in play but one soft line when something new is seen.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const seenAnimal = k => () => ANIMALS.some(a => a.k === k && !a.hide && !a.dying && inView(a.x, a.y, -40));
const seenWild = sp => () => WILD.flocks.some(F => F.sp === sp && inView(F.x, F.y, -40));
const seenHawk = kind => () => hawks.some(h => h.kind === kind && inView(h.x, h.y, -40));

/* ---- the pictures: small painted scenes, 160 x 100, drawn in code so there is nothing to load ---- */
const poly = (g, pts, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};
const oval = (g, x, y, rx, ry, fill, rot = 0) => {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
};
const stroke = (g, pts, col, w) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
};
// sky gradient and a ground band from y down
function scene(g, top, bot, gy, ground) {
  const gr = g.createLinearGradient(0, 0, 0, gy);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bot);
  g.fillStyle = gr;
  g.fillRect(0, 0, 160, 100);
  if (gy < 100) {
    g.fillStyle = ground;
    g.fillRect(0, gy, 160, 100 - gy);
  }
}
function spruces(g, y, col, n = 9, h = 26) {
  for (let i = 0; i < n; i++) {
    const x = 8 + i * (144 / (n - 1)),
      k = h * (0.7 + 0.3 * Math.sin(i * 2.3));
    poly(
      g,
      [
        [x - k * 0.28, y],
        [x, y - k],
        [x + k * 0.28, y]
      ],
      col
    );
  }
}
const flyer = (g, x, y, s, col, flap = 0.5) => {
  stroke(
    g,
    [
      [x - 5 * s, y - flap * 4 * s],
      [x, y],
      [x + 5 * s, y - flap * 4 * s]
    ],
    col,
    1.4 * s
  );
};
const bigBird = (g, x, y, s, col, tail) => {
  poly(
    g,
    [
      [x - 34 * s, y + 4 * s],
      [x - 12 * s, y - 9 * s],
      [x, y - 3 * s],
      [x + 12 * s, y - 9 * s],
      [x + 34 * s, y + 4 * s],
      [x + 12 * s, y + 1 * s],
      [x, y + 6 * s],
      [x - 12 * s, y + 1 * s]
    ],
    col
  );
  poly(
    g,
    [
      [x - 3 * s, y + 4 * s],
      [x + 3 * s, y + 4 * s],
      [x + 4 * s, y + 14 * s],
      [x - 4 * s, y + 14 * s]
    ],
    tail || col
  );
  oval(g, x, y - 3 * s, 4 * s, 3 * s, col);
};
const ART = {
  elk(g) {
    scene(g, '#8E9A8C', '#C9B9A0', 70, '#4A5B3A');
    spruces(g, 70, '#2F4430', 10, 34);
    oval(g, 78, 58, 20, 10, '#3E2F25');
    oval(g, 64, 50, 10, 8, '#3E2F25');
    poly(
      g,
      [
        [88, 54],
        [104, 52],
        [101, 64],
        [88, 66]
      ],
      '#3E2F25'
    );
    poly(
      g,
      [
        [98, 50],
        [110, 52],
        [108, 58],
        [98, 58]
      ],
      '#4A382C'
    );
    [
      [64, 66],
      [70, 66],
      [86, 66],
      [92, 66]
    ].forEach(([x, y]) =>
      stroke(
        g,
        [
          [x, y],
          [x - 1, 90]
        ],
        '#33271F',
        2.4
      )
    );
    stroke(
      g,
      [
        [100, 52],
        [104, 42],
        [114, 40]
      ],
      '#5B4636',
      2
    );
    poly(
      g,
      [
        [104, 42],
        [116, 36],
        [118, 44],
        [108, 46]
      ],
      '#5B4636'
    );
  },
  deer(g) {
    scene(g, '#A8B7A6', '#E3D8BE', 72, '#6E7F49');
    spruces(g, 72, '#44603F', 8, 22);
    oval(g, 76, 64, 15, 7, '#A76A3C');
    oval(g, 91, 56, 5, 4, '#B07446');
    poly(
      g,
      [
        [88, 50],
        [91, 40],
        [93, 51]
      ],
      '#A76A3C'
    );
    poly(
      g,
      [
        [93, 51],
        [97, 41],
        [97, 53]
      ],
      '#A76A3C'
    );
    oval(g, 64, 64, 3, 4, '#F2E8D6');
    [
      [68, 68],
      [72, 70],
      [82, 70],
      [86, 68]
    ].forEach(([x, y]) =>
      stroke(
        g,
        [
          [x, y],
          [x, 90]
        ],
        '#7E5230',
        1.8
      )
    );
  },
  fox(g) {
    scene(g, '#BFCBD6', '#EEF1F2', 62, '#F2F4F5');
    poly(
      g,
      [
        [0, 62],
        [40, 54],
        [90, 60],
        [160, 52],
        [160, 62]
      ],
      '#DDE3E8'
    );
    oval(g, 78, 68, 17, 8, '#C8602A');
    oval(g, 96, 59, 6, 5, '#D26C32');
    poly(
      g,
      [
        [93, 55],
        [95, 46],
        [99, 54]
      ],
      '#D26C32'
    );
    poly(
      g,
      [
        [98, 60],
        [108, 63],
        [98, 65]
      ],
      '#E8DCC8'
    );
    stroke(
      g,
      [
        [62, 68],
        [44, 62],
        [38, 70]
      ],
      '#C8602A',
      8
    );
    oval(g, 38, 70, 5, 4, '#F4F0E8');
    [
      [70, 74],
      [90, 74]
    ].forEach(([x, y]) =>
      stroke(
        g,
        [
          [x, y],
          [x, 88]
        ],
        '#3A2A20',
        2.4
      )
    );
  },
  hare(g) {
    scene(g, '#B9C5D0', '#E8EAEA', 70, '#C7CEC0');
    oval(g, 78, 68, 15, 11, '#C7B9A6');
    oval(g, 93, 58, 7, 6, '#CFC2B0');
    poly(
      g,
      [
        [90, 54],
        [86, 32],
        [92, 52]
      ],
      '#C7B9A6'
    );
    poly(
      g,
      [
        [94, 53],
        [96, 30],
        [98, 54]
      ],
      '#B8A894'
    );
    oval(g, 64, 72, 5, 5, '#F2EEE6');
    oval(g, 96, 57, 1.4, 1.4, '#222');
  },
  heron(g) {
    scene(g, '#C6D0D2', '#E6E4D6', 74, '#5F8693');
    for (let i = 0; i < 4; i++)
      stroke(
        g,
        [
          [10 + i * 40, 80 + (i % 2) * 6],
          [30 + i * 40, 80 + (i % 2) * 6]
        ],
        'rgba(255,255,255,.35)',
        1
      );
    stroke(
      g,
      [
        [80, 80],
        [80, 50]
      ],
      '#6B6A5C',
      1.6
    );
    oval(g, 84, 46, 9, 6, '#9AA4A6', -0.5);
    stroke(
      g,
      [
        [88, 44],
        [96, 28],
        [92, 22]
      ],
      '#8E989A',
      3.2
    );
    poly(
      g,
      [
        [92, 22],
        [108, 24],
        [92, 26]
      ],
      '#D9B25A'
    );
    poly(
      g,
      [
        [74, 48],
        [60, 56],
        [72, 52]
      ],
      '#7C878A'
    );
  },
  goose(g) {
    scene(g, '#8CA3B7', '#E6D3B8', 100, '#000');
    [
      [80, 30],
      [64, 40],
      [96, 40],
      [48, 50],
      [112, 50],
      [32, 60],
      [128, 60]
    ].forEach(([x, y], i) => flyer(g, x, y, 1.6, '#3F4650', i % 2 ? 0.3 : 0.7));
    spruces(g, 100, '#4C6350', 12, 16);
  },
  gull(g) {
    scene(g, '#7FA1BE', '#D9E6EC', 100, '#000');
    [
      [52, 36, 2.2],
      [92, 28, 1.8],
      [118, 48, 1.4]
    ].forEach(([x, y, s]) => {
      stroke(
        g,
        [
          [x - 14 * s, y + 3 * s],
          [x - 6 * s, y - 2 * s],
          [x, y]
        ],
        '#F4F6F6',
        2.4 * s * 0.6
      );
      stroke(
        g,
        [
          [x, y],
          [x + 6 * s, y - 2 * s],
          [x + 14 * s, y + 3 * s]
        ],
        '#F4F6F6',
        2.4 * s * 0.6
      );
    });
    oval(g, 80, 90, 80, 12, '#4F7C93');
  },
  tractor(g) {
    scene(g, '#B7C9D1', '#EFE6C8', 56, '#8C7A4C');
    for (let i = 0; i < 6; i++)
      stroke(
        g,
        [
          [0, 62 + i * 7],
          [160, 58 + i * 7]
        ],
        'rgba(60,46,26,.45)',
        1.4
      );
    poly(
      g,
      [
        [58, 52],
        [96, 52],
        [96, 64],
        [58, 64]
      ],
      '#B5301F'
    );
    poly(
      g,
      [
        [56, 40],
        [76, 40],
        [76, 54],
        [56, 54]
      ],
      '#B5301F'
    );
    poly(
      g,
      [
        [59, 42],
        [73, 42],
        [73, 51],
        [59, 51]
      ],
      '#A9C6D2'
    );
    oval(g, 66, 66, 11, 11, '#161412');
    oval(g, 66, 66, 5, 5, '#C9B24A');
    oval(g, 98, 70, 6, 6, '#161412');
    oval(g, 98, 70, 2.6, 2.6, '#C9B24A');
    stroke(
      g,
      [
        [100, 48],
        [100, 40]
      ],
      '#2A2826',
      2
    );
  },
  starling(g) {
    scene(g, '#D98F5C', '#F2C98A', 78, '#4A4A32');
    let r = 7;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 90; i++) {
      const t = rnd() * TAU,
        d = Math.sqrt(rnd());
      oval(g, 80 + Math.cos(t) * d * 46 + Math.sin(i) * 6, 36 + Math.sin(t) * d * 18, 1.5, 0.9, '#1E1B1B', rnd());
    }
    oval(g, 120, 52, 1.6, 1, '#1E1B1B');
  },
  linnet(g) {
    scene(g, '#B9D0A4', '#E6EBC6', 100, '#000');
    stroke(
      g,
      [
        [30, 90],
        [60, 62],
        [100, 52],
        [140, 40]
      ],
      '#6E5B3E',
      2
    );
    oval(g, 96, 46, 11, 7, '#8D6A48', -0.3);
    oval(g, 106, 40, 6, 5, '#9A9A98');
    oval(g, 101, 47, 5, 4, '#D86A74');
    poly(
      g,
      [
        [111, 40],
        [116, 42],
        [111, 43]
      ],
      '#D8C9A0'
    );
    poly(
      g,
      [
        [86, 48],
        [70, 56],
        [88, 52]
      ],
      '#6E4E34'
    );
  },
  fieldfare(g) {
    scene(g, '#C2CCC6', '#E8E2CB', 66, '#7D8450');
    oval(g, 78, 62, 14, 8, '#8A5B3A', -0.2);
    oval(g, 90, 55, 6, 5.5, '#8E9A9C');
    oval(g, 84, 66, 7, 4, '#E8D9B8');
    for (let i = 0; i < 5; i++) oval(g, 76 + i * 3, 66 + (i % 2) * 2, 0.9, 0.9, '#3A2C20');
    poly(
      g,
      [
        [95, 55],
        [101, 57],
        [95, 58]
      ],
      '#E0B04A'
    );
    poly(
      g,
      [
        [66, 62],
        [52, 68],
        [68, 66]
      ],
      '#3E3028'
    );
    stroke(
      g,
      [
        [76, 70],
        [76, 80]
      ],
      '#6A5636',
      1.4
    );
    stroke(
      g,
      [
        [82, 70],
        [82, 80]
      ],
      '#6A5636',
      1.4
    );
  },
  bunting(g) {
    scene(g, '#A9BBCD', '#EDF1F3', 70, '#F2F4F6');
    oval(g, 80, 64, 11, 7, '#E6D0A8');
    oval(g, 89, 58, 5.5, 5, '#E9D6B2');
    poly(
      g,
      [
        [70, 62],
        [56, 68],
        [72, 66]
      ],
      '#3A3836'
    );
    poly(
      g,
      [
        [70, 60],
        [62, 64],
        [76, 66]
      ],
      '#FAFAF8'
    );
    poly(
      g,
      [
        [93, 58],
        [98, 60],
        [93, 61]
      ],
      '#D9A83A'
    );
    stroke(
      g,
      [
        [78, 70],
        [78, 78]
      ],
      '#3A3836',
      1.4
    );
    stroke(
      g,
      [
        [84, 70],
        [84, 78]
      ],
      '#3A3836',
      1.4
    );
  },
  hawk(g) {
    scene(g, '#7FA2BF', '#E1E7E2', 100, '#000');
    oval(g, 120, 24, 14, 6, 'rgba(255,255,255,.5)');
    oval(g, 40, 70, 22, 7, 'rgba(255,255,255,.35)');
    bigBird(g, 78, 48, 1.1, '#5A4630', '#7A6446');
  },
  owl(g) {
    scene(g, '#142238', '#2D3E58', 100, '#000');
    oval(g, 128, 22, 11, 11, '#F0EBD0');
    oval(g, 131, 20, 10, 10, '#1B2B44');
    for (let i = 0; i < 14; i++) oval(g, (i * 53) % 160, (i * 29) % 50, 0.8, 0.8, 'rgba(255,255,255,.6)');
    stroke(
      g,
      [
        [0, 80],
        [70, 76],
        [160, 82]
      ],
      '#2A2018',
      5
    );
    oval(g, 76, 62, 14, 17, '#7A6A55');
    oval(g, 76, 54, 12, 11, '#8A7A64');
    poly(
      g,
      [
        [66, 46],
        [68, 36],
        [73, 44]
      ],
      '#7A6A55'
    );
    poly(
      g,
      [
        [86, 46],
        [84, 36],
        [79, 44]
      ],
      '#7A6A55'
    );
    oval(g, 71, 54, 4.4, 4.4, '#F2D878');
    oval(g, 81, 54, 4.4, 4.4, '#F2D878');
    oval(g, 71, 54, 1.8, 1.8, '#111');
    oval(g, 81, 54, 1.8, 1.8, '#111');
    poly(
      g,
      [
        [74, 58],
        [78, 58],
        [76, 63]
      ],
      '#C9A24A'
    );
  },
  eagle(g) {
    scene(g, '#6F93B3', '#D6DFDD', 100, '#000');
    oval(g, 30, 30, 18, 6, 'rgba(255,255,255,.4)');
    bigBird(g, 80, 44, 1.9, '#4B3B2A', '#F0EEE8');
    poly(
      g,
      [
        [86, 40],
        [98, 42],
        [86, 45]
      ],
      '#E2B84A'
    );
  },
  train(g) {
    scene(g, '#B4C6D2', '#E7E3D2', 60, '#7C8A5A');
    spruces(g, 60, '#3D5640', 11, 24);
    poly(
      g,
      [
        [0, 70],
        [160, 70],
        [160, 74],
        [0, 74]
      ],
      '#4A4A48'
    );
    for (let x = 4; x < 160; x += 9)
      poly(
        g,
        [
          [x, 74],
          [x + 4, 74],
          [x + 5, 78],
          [x - 1, 78]
        ],
        '#5A4A38'
      );
    poly(
      g,
      [
        [8, 50],
        [60, 50],
        [60, 70],
        [8, 70]
      ],
      '#2E5C7A'
    );
    poly(
      g,
      [
        [60, 50],
        [78, 52],
        [86, 70],
        [60, 70]
      ],
      '#C23B2A'
    );
    poly(
      g,
      [
        [62, 54],
        [76, 55],
        [80, 62],
        [62, 62]
      ],
      '#E9E2C8'
    );
    for (let i = 0; i < 4; i++)
      poly(
        g,
        [
          [14 + i * 12, 55],
          [22 + i * 12, 55],
          [22 + i * 12, 61],
          [14 + i * 12, 61]
        ],
        '#E9E2C8'
      );
    oval(g, 20, 71, 3, 3, '#202020');
    oval(g, 70, 71, 3, 3, '#202020');
  },
  aurora(g) {
    scene(g, '#0B1624', '#143040', 100, '#000');
    for (let i = 0; i < 20; i++) oval(g, (i * 47) % 160, (i * 23) % 50, 0.7, 0.7, 'rgba(255,255,255,.7)');
    for (let k = 0; k < 3; k++) {
      const gr = g.createLinearGradient(0, 10, 0, 70);
      gr.addColorStop(0, 'rgba(110,240,160,0)');
      gr.addColorStop(0.5, `rgba(110,240,160,${0.45 - k * 0.1})`);
      gr.addColorStop(1, 'rgba(110,240,160,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 40 + k * 8);
      for (let x = 0; x <= 160; x += 10) g.lineTo(x, 36 + k * 8 + Math.sin(x * 0.05 + k) * 12);
      g.lineTo(160, 80);
      g.lineTo(0, 80);
      g.fill();
    }
    poly(
      g,
      [
        [0, 100],
        [0, 76],
        [40, 70],
        [90, 80],
        [130, 68],
        [160, 74],
        [160, 100]
      ],
      '#0A0F14'
    );
    spruces(g, 84, '#070B0E', 12, 18);
  },
  snow(g) {
    scene(g, '#51647A', '#8896A6', 78, '#E8EDF1');
    spruces(g, 78, '#2F3F4A', 9, 28);
    for (let i = 0; i < 46; i++) oval(g, (i * 37) % 160, (i * 61) % 100, 1.4, 1.4, 'rgba(255,255,255,.85)');
  },
  fog(g) {
    scene(g, '#BCC6C6', '#DDE0D8', 100, '#000');
    spruces(g, 78, '#6F8078', 10, 40);
    g.fillStyle = 'rgba(224,228,220,.6)';
    g.fillRect(0, 40, 160, 22);
    spruces(g, 90, '#3F5A4A', 6, 36);
    g.fillStyle = 'rgba(224,228,220,.7)';
    g.fillRect(0, 62, 160, 20);
    oval(g, 80, 96, 90, 14, '#C9CFC4');
  },
  storm(g) {
    scene(g, '#4C5A68', '#7E8B97', 80, '#D8DFE4');
    spruces(g, 80, '#2B3A44', 9, 24);
    for (let i = 0; i < 30; i++)
      stroke(
        g,
        [
          [((i * 41) % 190) - 20, (i * 17) % 90],
          [((i * 41) % 190) - 8, ((i * 17) % 90) + 5]
        ],
        'rgba(255,255,255,.8)',
        1.4
      );
    poly(
      g,
      [
        [0, 86],
        [60, 78],
        [110, 84],
        [160, 76],
        [160, 100],
        [0, 100]
      ],
      'rgba(235,240,244,.9)'
    );
  },
  squall(g) {
    scene(g, '#2C3340', '#5A6370', 78, '#4C6038');
    oval(g, 50, 24, 40, 16, '#262B36');
    oval(g, 108, 20, 46, 18, '#20252E');
    oval(g, 80, 32, 50, 14, '#2D3340');
    poly(
      g,
      [
        [84, 36],
        [74, 58],
        [82, 58],
        [74, 80],
        [96, 52],
        [88, 52],
        [94, 36]
      ],
      '#F5E27A'
    );
    for (let i = 0; i < 24; i++)
      stroke(
        g,
        [
          [(i * 43) % 160, 50 + ((i * 11) % 30)],
          [((i * 43) % 160) - 3, 58 + ((i * 11) % 30)]
        ],
        'rgba(190,210,230,.6)',
        1
      );
  }
};

/* [key, name, what it is, seen-test] */
const JOURNAL = [
  ['elk', 'Elk', 'Elg. It stands at the forest edge at dusk and takes no notice of sparrows.', seenAnimal('moose')],
  [
    'deer',
    'Roe deer',
    'Rådyr. Light on its feet, it freezes in the field before it bolts for cover.',
    seenAnimal('deer')
  ],
  [
    'fox',
    'Fox',
    'Rev. Hunts the field edges and will take a sparrow that sits too long on the ground.',
    seenAnimal('fox')
  ],
  ['hare', 'Hare', 'Hare. Grey in summer, white in winter, and still as a stone until it runs.', seenAnimal('hare')],
  ['heron', 'Heron', 'Gråhegre. Waits on one leg by the shore; it has no interest in you.', seenAnimal('heron')],
  ['goose', 'Geese', 'Gjess. Pass over in long lines, calling, on their way somewhere else.', seenAnimal('goose')],
  ['gull', 'Gulls', 'Måker. Follow the plough and the fishing boats, loud and fearless.', seenAnimal('gull')],
  [
    'tractor',
    'Tractor',
    'Traktor. Turns the earth in spring and brings the crows and gulls in behind.',
    seenAnimal('tractor')
  ],
  [
    'starling',
    'Starlings',
    'Stær. Wheel over a field in hundreds, then drop to feed all at once.',
    seenWild('starling')
  ],
  [
    'linnet',
    'Linnets',
    'Tornirisk. Small and pink-breasted, they feed on seed heads in loose flocks.',
    seenWild('linnet')
  ],
  [
    'fieldfare',
    'Fieldfares',
    'Gråtrost. Winter thrushes from the north, loud over the stubble and the rowan.',
    seenWild('fieldfare')
  ],
  [
    'bunting',
    'Snow buntings',
    'Snøspurv. White flurries over the snow; they arrive when the real winter does.',
    seenWild('bunting')
  ],
  ['hawk', 'Hawk', 'Hauk. Hunts by day, and the whole field goes quiet before it strikes.', seenHawk('hawk')],
  ['owl', 'Owl', 'Ugle. Hunts by ear as much as by eye; a still bird in the dark is not safe.', seenHawk('owl')],
  ['eagle', 'White-tailed eagle', 'Havørn. Rare and enormous. Everything on the ground goes still.', seenHawk('eagle')],
  [
    'train',
    'Train',
    'Tog. The line runs through the parish; it honks at the crossing and does not slow.',
    () => !!TRAIN && trainNear(L.x, L.y, 450)
  ],
  [
    'aurora',
    'Northern lights',
    'Nordlys. Green curtains on long dark nights, a gift to anyone still awake.',
    () => LIGHT.aurora > 0.5
  ],
  [
    'snow',
    'First snow',
    'Første snø. The land goes quiet and every bird shows against the white.',
    () => LIGHT.snow > 0.3
  ],
  ['fog', 'Fog', 'Tåke. Closes the view around the flock; the hawk sees no further than you do.', () => seeK() < 0.55],
  [
    'storm',
    'Winter storm',
    'Snøstorm. Driven snow and a cold that cuts through; only cover saves the flock.',
    () => WEATHER.storm > 0.6
  ],
  [
    'squall',
    'Summer thunderstorm',
    'Tordenbyge. A heavy shower with a hard wind in front; the open is no place to be.',
    () => WEATHER.squall > 0.5
  ]
];
const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
let JOURNAL_SEEN = {};
try {
  JOURNAL_SEEN = JSON.parse(localStorage.getItem('flokk-journal') || '{}');
} catch (e) {
  JOURNAL_SEEN = {};
}
let journalT = 0;
function journalTick(dt) {
  if (st.mode !== 'play' || !L) return;
  journalT -= dt;
  if (journalT > 0) return;
  journalT = 0.7;
  for (const [key, label, , test] of JOURNAL) {
    if (JOURNAL_SEEN[key] || !test()) continue;
    JOURNAL_SEEN[key] = SEASON;
    try {
      localStorage.setItem('flokk-journal', JSON.stringify(JOURNAL_SEEN));
    } catch (e) {
      /* storage unavailable: it is only noted for this visit */
    }
    showHint(`in the journal: ${label.toLowerCase()}`);
    return; // one at a time
  }
}
function drawJournalCard(cv, key) {
  const g = cv.getContext('2d');
  g.setTransform(cv.width / 160, 0, 0, cv.height / 100, 0, 0);
  if (key && ART[key]) ART[key](g);
  else {
    g.fillStyle = '#27382B';
    g.fillRect(0, 0, 160, 100);
    g.fillStyle = 'rgba(246,243,234,.28)';
    g.font = '300 44px sans-serif';
    g.textAlign = 'center';
    g.fillText('?', 80, 64);
  }
}
let journalFocus = null;
function openJournal() {
  const grid = $('journalGrid'),
    { n, total } = journalText();
  grid.textContent = '';
  for (const [key, name, text] of JOURNAL) {
    const seen = JOURNAL_SEEN[key] != null,
      card = document.createElement('figure'),
      cv = document.createElement('canvas'),
      box = document.createElement('div');
    card.className = 'journal-card' + (seen ? '' : ' unseen');
    cv.width = 320;
    cv.height = 200;
    drawJournalCard(cv, seen && key);
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', seen ? name : 'not yet seen');
    box.innerHTML = seen
      ? `<h3>${name}<span>${SEASON_NAMES[JOURNAL_SEEN[key]]}</span></h3><p>${text}</p>`
      : '<h3>Not yet seen</h3><p>Keep flying.</p>';
    card.append(cv, box);
    grid.append(card);
  }
  $('journalCount').textContent = `${n} of ${total}`;
  journalFocus = document.activeElement;
  $('journalOv').hidden = false;
  syncMenuAccess();
  $('journalCloseBtn').focus({ preventScroll: true });
  $('journalOv').querySelector('.journal-panel').scrollTop = 0;
}
function closeJournal() {
  $('journalOv').hidden = true;
  syncMenuAccess();
  if (journalFocus?.isConnected && journalFocus.getClientRects().length) journalFocus.focus();
  else menuControls(activeMenu())[0]?.focus();
}
$('journalBtn').onclick = openJournal;
$('journalCloseBtn').onclick = closeJournal;

/* ---- the marked birds on the end cards: a stone with the day on it for each one lost, the bird on a post
   for each one that lived through ---- */
function markPicture(r) {
  const cv = document.createElement('canvas');
  cv.width = 168;
  cv.height = 200;
  const g = cv.getContext('2d'),
    m = MARKS[r.i];
  g.scale(2, 2);
  const c1 = m.c1 || '#54402C',
    c2 = m.c2 || '#7A6048',
    c3 = m.c3 || '#62574D',
    bird = (x, y, s) => {
      stroke(
        g,
        [
          [x - 2 * s, y],
          [x - 2 * s, y + 5 * s]
        ],
        '#8A6A4A',
        1.1
      );
      stroke(
        g,
        [
          [x + 2 * s, y],
          [x + 2 * s, y + 5 * s]
        ],
        '#8A6A4A',
        1.1
      );
      poly(
        g,
        [
          [x - 6 * s, y - 8 * s],
          [x - 15 * s, y - 4 * s],
          [x - 14 * s, y - 1 * s],
          [x - 5 * s, y - 4 * s]
        ],
        c1
      );
      oval(g, x, y - 6 * s, 8 * s, 5.5 * s, c2, -0.15);
      oval(g, x + 1.5 * s, y - 4 * s, 5 * s, 3 * s, '#BCA88C');
      oval(g, x - 2 * s, y - 8 * s, 6 * s, 3 * s, c1, -0.2);
      oval(g, x + 6 * s, y - 12 * s, 3.8 * s, 3.8 * s, c3);
      oval(g, x + 7.4 * s, y - 11 * s, 2 * s, 1.5 * s, '#CFC4B2');
      oval(g, x + 7.4 * s, y - 13 * s, 0.8 * s, 0.8 * s, '#111');
      poly(
        g,
        [
          [x + 9.5 * s, y - 12.5 * s],
          [x + 13 * s, y - 11.5 * s],
          [x + 9.5 * s, y - 10.5 * s]
        ],
        '#D8B25A'
      );
    };
  // dusk ground
  const sky = g.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, 'rgba(24,38,32,0)');
  sky.addColorStop(1, 'rgba(24,38,32,.55)');
  g.fillStyle = sky;
  g.fillRect(0, 0, 84, 100);
  if (r.fate) {
    // the stone
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath();
    g.ellipse(42, 90, 28, 5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#8D928D';
    g.beginPath();
    g.moveTo(22, 90);
    g.lineTo(22, 52);
    g.arc(42, 52, 20, Math.PI, 0);
    g.lineTo(62, 90);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.beginPath();
    g.moveTo(22, 90);
    g.lineTo(22, 52);
    g.arc(42, 52, 20, Math.PI, Math.PI * 1.5);
    g.lineTo(42, 90);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(90,110,70,.55)';
    g.beginPath();
    g.ellipse(30, 89, 9, 3, 0, 0, TAU);
    g.ellipse(58, 89, 6, 2.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#4A4F4A';
    g.textAlign = 'center';
    g.font = '600 9px sans-serif';
    g.fillText('day', 42, 66);
    g.font = '600 20px sans-serif';
    g.fillText(String(r.day), 42, 84);
    stroke(
      g,
      [
        [34, 72],
        [50, 72]
      ],
      'rgba(74,79,74,.5)',
      0.8
    );
    bird(42, 36, 1.35);
    // grass
    for (let i = 0; i < 7; i++)
      stroke(
        g,
        [
          [10 + i * 11, 94],
          [8 + i * 11 + (i % 2) * 5, 88]
        ],
        '#5F7A45',
        1.2
      );
  } else {
    stroke(
      g,
      [
        [42, 94],
        [42, 58]
      ],
      '#6F5B40',
      4
    );
    stroke(
      g,
      [
        [26, 58],
        [58, 58]
      ],
      '#6F5B40',
      4
    );
    bird(42, 58, 1.35);
    for (let i = 0; i < 7; i++)
      stroke(
        g,
        [
          [10 + i * 11, 96],
          [8 + i * 11 + (i % 2) * 5, 90]
        ],
        '#5F7A45',
        1.2
      );
  }
  return cv;
}
function renderMarks(el) {
  el.textContent = '';
  for (const r of st.marks || []) {
    const fig = document.createElement('figure'),
      cap = document.createElement('figcaption');
    cap.textContent = MARKS[r.i].name;
    fig.setAttribute('aria-label', `${MARKS[r.i].name} ${r.fate ? `${r.fate}, day ${r.day}` : 'lived through'}`);
    fig.append(markPicture(r), cap);
    el.append(fig);
  }
}
function journalText() {
  const n = JOURNAL.filter(([k]) => JOURNAL_SEEN[k] != null).length;
  return { n, total: JOURNAL.length };
}
