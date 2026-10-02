/* Flokk - blades.js
   The grass and the crops are tens of thousands of short curved strokes, rebuilt every frame as the wind moves
   them. Stroking that many curves through the 2D canvas is the single heaviest thing in a frame: the browser
   outlines every one on the CPU. Here they go to the GPU instead: each blade is one small quad whose pixels
   measure their distance to the curve (with round ends, like a round-capped stroke), and the layer is laid
   into the 2D frame in one draw at the place the strokes used to go. Where WebGL2 is missing (or only a
   software stand-in), the same calls fall back to Path2D strokes on the 2D canvas, as before.
   grass.js and crops.js fill "sinks" with blades and seed-head rects, then stroke or fill them in a colour,
   exactly as they would a Path2D; render() opens the layer before the grass and lays it in after the crops.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const BLADES = {
  gl: null,
  cv: null,
  prog: null,
  buf: null,
  inst: new Float32Array(12 * 4096), // per instance: kind, p0, p1, p2, (pad), half width, r, g, b
  n: 0,
  pool: [], // reusable sinks, and how many this frame has handed out
  used: 0,
  on: false, // between begin() and flush(): the GL layer is collecting this frame's blades
  tried: false
};
const BLADE_F = 12;
const BLADE_VS = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 a; // kind, p0
layout(location=2) in vec4 b; // p1, p2
layout(location=3) in vec4 c; // half width, colour
uniform vec2 res;
out vec2 px;
flat out float kind;
flat out vec2 P0;
flat out vec2 P1;
flat out vec2 P2;
flat out float hw;
flat out vec3 col;
void main() {
  kind = a.x; P0 = a.yz; P1 = vec2(a.w, b.x); P2 = b.yz; hw = c.x; col = c.yzw;
  vec2 lo, hi;
  if (kind < 0.5) {
    // a blade: the box round its curve (a quadratic lies inside its control points), plus the stroke and a pixel
    lo = min(min(P0, P1), P2) - (hw + 1.0);
    hi = max(max(P0, P1), P2) + (hw + 1.0);
  } else {
    // a rect from P0 to P1, plus a pixel for its soft edge
    lo = min(P0, P1) - 1.0;
    hi = max(P0, P1) + 1.0;
  }
  px = mix(lo, hi, corner);
  gl_Position = vec4(px / res * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;
const BLADE_FS = `#version 300 es
precision highp float;
in vec2 px;
flat in float kind;
flat in vec2 P0;
flat in vec2 P1;
flat in vec2 P2;
flat in float hw;
flat in vec3 col;
out vec4 o;
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * t);
}
void main() {
  float cov;
  if (kind < 0.5) {
    // distance to the curve, walked as six chords (off the true curve by well under a tenth of a pixel)
    float d = 1e9;
    vec2 q = P0;
    for (int i = 1; i <= 6; i++) {
      float t = float(i) / 6.0;
      vec2 r = mix(mix(P0, P1, t), mix(P1, P2, t), t);
      d = min(d, seg(px, q, r));
      q = r;
    }
    // a pixel-wide ramp across the edge: the same coverage a stroke this wide gets, thin ones included
    cov = clamp(hw + 0.5 - d, 0.0, 1.0);
  } else {
    // the share of this pixel the rect covers
    vec2 lo = min(P0, P1), hi = max(P0, P1);
    vec2 ov = clamp(min(px + 0.5, hi) - max(px - 0.5, lo), 0.0, 1.0);
    cov = ov.x * ov.y;
  }
  if (cov <= 0.0) discard;
  o = vec4(col * cov, cov);
}`;
function bladesInit() {
  BLADES.tried = true;
  const c = document.createElement('canvas');
  let gl = null;
  try {
    gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  } catch {
    gl = null;
  }
  if (!gl) return;
  // a software WebGL would be slower than the 2D strokes it replaces
  const dbg = gl.getExtension('WEBGL_debug_renderer_info'),
    rn = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software/i.test(rn) && !(DEV && DEV.glBlades)) return;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  try {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, BLADE_VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, BLADE_FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    BLADES.prog = p;
  } catch (e) {
    console.warn('Flokk: GPU grass unavailable, drawing it on the 2D canvas', e);
    return;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  BLADES.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, BLADES.buf);
  // twelve floats, read as three vec4s: (kind, p0, p1.x) (p1.y, p2, pad) (half width, colour)
  const stride = BLADE_F * 4;
  for (let i = 0; i < 3; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, stride, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  BLADES.res = gl.getUniformLocation(BLADES.prog, 'res');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  c.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    BLADES.gl = null; // back to the 2D strokes
  });
  BLADES.cv = c;
  BLADES.gl = gl;
}
// start collecting this frame's blades (render(), before the grass)
function bladesBegin() {
  if (!BLADES.tried) bladesInit();
  BLADES.n = BLADES.used = 0;
  BLADES.on = !!BLADES.gl;
}
// draw the collected blades and lay them into the frame (render(), after the crops); leaves ctx as it found it
function bladesFlush() {
  if (!BLADES.on) return;
  BLADES.on = false;
  if (!BLADES.n || !BLADES.gl) return;
  const gl = BLADES.gl,
    c = BLADES.cv;
  if (c.width !== cv.width || c.height !== cv.height) {
    c.width = cv.width;
    c.height = cv.height;
  }
  gl.viewport(0, 0, c.width, c.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(BLADES.prog);
  gl.uniform2f(BLADES.res, c.width, c.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, BLADES.buf);
  gl.bufferData(gl.ARRAY_BUFFER, BLADES.inst.subarray(0, BLADES.n * BLADE_F), gl.STREAM_DRAW);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, BLADES.n);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
/* a batch of blades (quadratic curves from a foot, through a control point, to a tip) and small rects, in the
   current user space, to be stroked or filled in one colour like a Path2D */
function bladeSink() {
  if (!BLADES.on) return { path: new Path2D() };
  // the GL sinks are kept and reused frame to frame, so filling them allocates nothing
  const P = BLADES.pool;
  let S = P[BLADES.used];
  if (!S) S = P[BLADES.used] = { path: null, q: new Float32Array(6 * 1024), n: 0, r: new Float32Array(4 * 256), m: 0 };
  BLADES.used++;
  S.n = S.m = 0;
  return S;
}
const growF32 = (a, need) => {
  let len = a.length;
  while (len < need) len *= 2;
  const b = new Float32Array(len);
  b.set(a);
  return b;
};
function sinkBlade(S, x0, y0, x1, y1, x2, y2) {
  if (S.path) {
    S.path.moveTo(x0, y0);
    S.path.quadraticCurveTo(x1, y1, x2, y2);
    return;
  }
  const o = S.n++ * 6;
  if (o + 6 > S.q.length) S.q = growF32(S.q, o + 6);
  const q = S.q;
  q[o] = x0;
  q[o + 1] = y0;
  q[o + 2] = x1;
  q[o + 3] = y1;
  q[o + 4] = x2;
  q[o + 5] = y2;
}
function sinkRect(S, x, y, w, h) {
  if (S.path) return S.path.rect(x, y, w, h);
  const o = S.m++ * 4;
  if (o + 4 > S.r.length) S.r = growF32(S.r, o + 4);
  const r = S.r;
  r[o] = x;
  r[o + 1] = y;
  r[o + 2] = w;
  r[o + 3] = h;
}
function bladeRoom(k) {
  if ((BLADES.n + k) * BLADE_F > BLADES.inst.length) BLADES.inst = growF32(BLADES.inst, (BLADES.n + k) * BLADE_F);
}
const RGB01 = new Map();
const rgb01 = s => {
  let c = RGB01.get(s);
  if (!c) {
    if (RGB01.size > 512) RGB01.clear();
    const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(s);
    RGB01.set(s, (c = [m[1] / 255, m[2] / 255, m[3] / 255]));
  }
  return c;
};
// stroke the sink's blades with round ends, colour col ('rgb(r,g,b)'), lineWidth w in user units
function sinkStroke(S, col, w) {
  if (S.path) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke(S.path);
    ctx.lineCap = 'butt';
    return;
  }
  if (!S.n) return;
  // user space to device pixels: the upright world is only ever scaled and shifted
  const m = ctx.getTransform(),
    a = m.a,
    d = m.d,
    e = m.e,
    f = m.f,
    [r, g, b] = rgb01(col),
    hw = 0.5 * w * a,
    q = S.q;
  bladeRoom(S.n);
  const I = BLADES.inst;
  let o = BLADES.n * BLADE_F;
  for (let i = 0; i < S.n; i++, o += BLADE_F) {
    const s = i * 6;
    I[o] = 0;
    I[o + 1] = a * q[s] + e;
    I[o + 2] = d * q[s + 1] + f;
    I[o + 3] = a * q[s + 2] + e;
    I[o + 4] = d * q[s + 3] + f;
    I[o + 5] = a * q[s + 4] + e;
    I[o + 6] = d * q[s + 5] + f;
    I[o + 7] = 0;
    I[o + 8] = hw;
    I[o + 9] = r;
    I[o + 10] = g;
    I[o + 11] = b;
  }
  BLADES.n += S.n;
}
// fill the sink's rects in colour col
function sinkFill(S, col) {
  if (S.path) {
    ctx.fillStyle = col;
    ctx.fill(S.path);
    return;
  }
  if (!S.m) return;
  const m = ctx.getTransform(),
    a = m.a,
    d = m.d,
    e = m.e,
    f = m.f,
    [r, g, b] = rgb01(col),
    R = S.r;
  bladeRoom(S.m);
  const I = BLADES.inst;
  let o = BLADES.n * BLADE_F;
  for (let i = 0; i < S.m; i++, o += BLADE_F) {
    const s = i * 4;
    I[o] = 1;
    I[o + 1] = a * R[s] + e;
    I[o + 2] = d * R[s + 1] + f;
    I[o + 3] = a * (R[s] + R[s + 2]) + e;
    I[o + 4] = d * (R[s + 1] + R[s + 3]) + f;
    I[o + 5] = I[o + 6] = I[o + 7] = 0;
    I[o + 8] = 0;
    I[o + 9] = r;
    I[o + 10] = g;
    I[o + 11] = b;
  }
  BLADES.n += S.m;
}
