/* Flokk - flocklight.js
   Over forest the birds are a few pixels the colour of the trees. Rather than ringing each one, the flock lifts a
   soft pool of light out of the canopy: a fragment shader sums a gaussian per bird (so neighbours melt into one
   cloud), breaks it up with slow dappled noise like sun through leaves, and fades it with how deep in forest each
   bird is. It renders at a quarter of the frame's size - it is all soft - and is laid in just under the birds.
   Where WebGL2 is missing (or only a software stand-in) drawFlyer falls back to a faint per-bird aura.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const FLIGHT = { gl: null, cv: null, prog: null, tried: false, on: false, pts: new Float32Array(48 * 4), n: 0 };
const FLIGHT_MAX = 48;
const FLIGHT_VS = `#version 300 es
layout(location=0) in vec2 corner;
void main() { gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0); }`;
const FLIGHT_FS = `#version 300 es
precision highp float;
uniform vec4 pts[${FLIGHT_MAX}]; // x, y (pixels, top left origin), radius, strength
uniform int n;
uniform vec2 res;
uniform float t;
uniform vec3 tint;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  float g = 0.0, core = 0.0;
  for (int i = 0; i < ${FLIGHT_MAX}; i++) {
    if (i >= n) break;
    vec4 q = pts[i];
    vec2 d = (p - q.xy) / q.z;
    float e = exp(-dot(d, d) * 1.25) * q.w;
    g += e;
    core += e * e;
  }
  if (g < 0.004) discard;
  // light caught between the leaves: two slow octaves drifting past, so the pool shimmers rather than glows
  vec2 s = p * 0.09;
  float dap = 0.62 + 0.55 * vn(s + vec2(t * 0.35, t * 0.18)) * (0.6 + 0.5 * vn(s * 2.3 - vec2(t * 0.5, 0.0)));
  float I = (1.0 - exp(-g * 1.15)) * dap * 0.66;
  vec3 c = mix(tint, vec3(1.0, 0.96, 0.82), clamp(core * 0.6, 0.0, 1.0));
  o = vec4(c * I, I);
}`;
function flightInit() {
  FLIGHT.tried = true;
  const c = document.createElement('canvas');
  let gl = null;
  try {
    gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  } catch {
    gl = null;
  }
  if (!gl) return;
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
    gl.attachShader(p, sh(gl.VERTEX_SHADER, FLIGHT_VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FLIGHT_FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    FLIGHT.prog = p;
  } catch (e) {
    console.warn('Flokk: flock light shader unavailable, using the soft aura', e);
    return;
  }
  gl.bindVertexArray(gl.createVertexArray());
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u = n => gl.getUniformLocation(FLIGHT.prog, n);
  FLIGHT.u = { pts: u('pts'), n: u('n'), res: u('res'), t: u('t'), tint: u('tint') };
  c.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    FLIGHT.gl = null;
  });
  FLIGHT.cv = c;
  FLIGHT.gl = gl;
}
// how deep in forest a bird is, 0..1, eased and sampled a few times a second (forestness is noisy maths)
function flyerForest(b) {
  if (!(b.fqT > T)) {
    b.fqT = T + 0.2 + Math.random() * 0.1;
    b.fqTo = smooth(0.42, 0.66, forestness(b.x, b.y));
  }
  b.fq = (b.fq || 0) + ((b.fqTo || 0) - (b.fq || 0)) * 0.08;
  return b.fq;
}
// air: the frame's [bird, copy] pairs; setK puts the 2D context in that copy's transform. Call before the birds are drawn.
function flightDraw(air, setK) {
  FLIGHT.on = false;
  if (!FLIGHT.tried) flightInit();
  if (!FLIGHT.gl) return;
  const P = FLIGHT.pts,
    S = 4;
  let n = 0;
  for (let i = 0; i < air.length && n < FLIGHT_MAX; i++) {
    const b = air[i][0],
      fq = flyerForest(b);
    if (fq < 0.03) continue;
    setK(air[i][1]);
    const m = ctx.getTransform(),
      K = b.s * (0.95 + 0.04 * b.z);
    P[n * 4] = (m.a * b.x + m.e) / S;
    P[n * 4 + 1] = (m.d * PY(b.y, b.z) + m.f) / S;
    P[n * 4 + 2] = (K * 3.4 * m.a) / S;
    P[n * 4 + 3] = fq * (b === L ? 1.25 : 1);
    n++;
  }
  FLIGHT.on = true; // the shader owns the forest cue this frame, even when no bird is over forest
  if (!n) return;
  const gl = FLIGHT.gl,
    c = FLIGHT.cv,
    w = Math.ceil(cv.width / S),
    h = Math.ceil(cv.height / S);
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(FLIGHT.prog);
  gl.uniform4fv(FLIGHT.u.pts, P);
  gl.uniform1i(FLIGHT.u.n, n);
  gl.uniform2f(FLIGHT.u.res, w, h);
  gl.uniform1f(FLIGHT.u.t, T);
  const nt = LIGHT.night;
  gl.uniform3f(FLIGHT.u.tint, 1.0 - 0.1 * nt, 0.9 - 0.08 * nt, 0.62 + 0.1 * nt);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - 0.4 * nt;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, cv.width, cv.height);
  ctx.restore();
}
