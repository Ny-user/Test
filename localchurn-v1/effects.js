// Post-processing effects applied to Butterchurn's final frame, in the spirit
// of MilkDrop 3's mirror modes and color filters.
//
// Butterchurn can render each frame into an offscreen texture and then draw it
// to the canvas through `renderer.outputShader` (its FXAA path, toggled with
// setOutputAA). EffectsPass takes the place of that shader, so the effects cost
// one full-screen pass inside Butterchurn's own WebGL context, and nothing at
// all when every effect is at its default.

export const DEFAULT_EFFECTS = {
  enabled: true,
  // Geometry
  mirror: 'none', // 'none' | 'horizontal' | 'vertical' | 'quad'
  flipX: false,
  flipY: false,
  kaleidoscope: 0, // segments; < 2 = off
  pixelate: 0, // block size in pixels; < 2 = off
  rgbSplit: 0, // 0..1
  echo: 0, // 0..1
  // Filters
  invert: false,
  solarize: false,
  burn: false,
  brighten: false,
  darken: false,
  edges: false,
  // Color
  hue: 0, // degrees
  hueCycle: 0, // degrees per second
  saturation: 1,
  contrast: 1,
  brightness: 1,
  posterize: 0, // levels; < 2 = off
  vignette: 0, // 0..1
};

export function isEffectsActive(effects) {
  if (!effects.enabled) {
    return false;
  }
  return Object.keys(DEFAULT_EFFECTS).some(
    (key) => key !== 'enabled' && effects[key] !== DEFAULT_EFFECTS[key]
  );
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 uv;
void main(void) {
  gl_Position = vec4(aPos, 0.0, 1.0);
  uv = aPos * 0.5 + 0.5;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision mediump sampler2D;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;

uniform vec2 uFlip;
uniform vec2 uMirror;
uniform float uKaleido;
uniform float uPixelate;
uniform float uRgbSplit;
uniform float uEcho;

uniform float uInvert;
uniform float uSolarize;
uniform float uBurn;
uniform float uBrighten;
uniform float uDarken;
uniform float uEdges;

uniform float uHue;
uniform float uHueSpeed;
uniform float uSaturation;
uniform float uContrast;
uniform float uBrightness;
uniform float uPosterize;
uniform float uVignette;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

// Reflect coordinates back into [0, 1] instead of clamping at the edges.
vec2 mirrorWrap(vec2 p) {
  return 1.0 - abs(1.0 - mod(p, 2.0));
}

vec2 geometry(vec2 p) {
  if (uFlip.x > 0.5) p.x = 1.0 - p.x;
  if (uFlip.y > 0.5) p.y = 1.0 - p.y;
  // Mirror: the left / top half is reflected onto the other half.
  if (uMirror.x > 0.5 && p.x > 0.5) p.x = 1.0 - p.x;
  if (uMirror.y > 0.5 && p.y < 0.5) p.y = 1.0 - p.y;

  if (uKaleido > 1.5) {
    vec2 c = (p - 0.5) * vec2(uAspect, 1.0);
    float seg = 6.28318530718 / uKaleido;
    float a = mod(atan(c.y, c.x), seg);
    a = abs(a - 0.5 * seg);
    c = length(c) * vec2(cos(a), sin(a));
    p = mirrorWrap(c / vec2(uAspect, 1.0) + 0.5);
  }

  if (uPixelate > 1.5) {
    vec2 block = uPixelate * uTexel;
    p = (floor(p / block) + 0.5) * block;
  }
  return p;
}

// Always sample the full-resolution level: geometry effects create UV
// discontinuities that would otherwise select blurry mip levels at seams.
vec3 tex(vec2 p) {
  return textureLod(uTexture, p, 0.0).rgb;
}

vec3 sampleColor(vec2 p) {
  if (uRgbSplit > 0.0) {
    vec2 off = (p - 0.5) * uRgbSplit;
    return vec3(tex(p + off).r, tex(p).g, tex(p - off).b);
  }
  return tex(p);
}

float edgeStrength(vec2 p) {
  vec2 t = uTexel * 1.5;
  float tl = dot(tex(p + vec2(-t.x,  t.y)), LUMA);
  float tc = dot(tex(p + vec2( 0.0,  t.y)), LUMA);
  float tr = dot(tex(p + vec2( t.x,  t.y)), LUMA);
  float ml = dot(tex(p + vec2(-t.x,  0.0)), LUMA);
  float mr = dot(tex(p + vec2( t.x,  0.0)), LUMA);
  float bl = dot(tex(p + vec2(-t.x, -t.y)), LUMA);
  float bc = dot(tex(p + vec2( 0.0, -t.y)), LUMA);
  float br = dot(tex(p + vec2( t.x, -t.y)), LUMA);
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  return length(vec2(gx, gy));
}

vec3 hueRotate(vec3 c, float angle) {
  const vec3 k = vec3(0.57735026919);
  float ca = cos(angle);
  return c * ca + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - ca);
}

void main(void) {
  vec2 p = geometry(uv);
  vec3 col = sampleColor(p);

  if (uEcho > 0.0) {
    // MilkDrop-style video echo: a zoomed copy blended over the frame.
    vec2 q = (p - 0.5) / 1.4 + 0.5;
    col = mix(col, sampleColor(q), uEcho);
  }

  if (uEdges > 0.5) {
    // Neon outlines, tinted with the local color.
    float e = clamp(edgeStrength(p) * 4.0, 0.0, 1.0);
    float peak = max(max(col.r, col.g), max(col.b, 0.15));
    col = e * col / peak;
  }

  // MilkDrop's classic post-effects, applied in MilkDrop's order.
  if (uBrighten > 0.5) col = 1.0 - (1.0 - col) * (1.0 - col);
  if (uDarken > 0.5) col = col * col;
  if (uSolarize > 0.5) col = col * (1.0 - col) * 4.0;
  if (uBurn > 0.5) col = clamp(1.0 - (1.0 - col) / (col * 0.9 + 0.1), 0.0, 1.0);
  if (uInvert > 0.5) col = 1.0 - col;

  float hue = uHue + uHueSpeed * uTime;
  if (hue != 0.0) col = hueRotate(col, hue);
  col = mix(vec3(dot(col, LUMA)), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  col *= uBrightness;
  col = clamp(col, 0.0, 1.0);

  if (uPosterize > 1.5) {
    col = min(floor(col * uPosterize) / (uPosterize - 1.0), 1.0);
  }

  if (uVignette > 0.0) {
    float d = length((uv - 0.5) * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5);
    col *= 1.0 - uVignette * smoothstep(0.35, 1.0, d);
  }

  fragColor = vec4(col, 1.0);
}`;

const UNIFORMS = [
  'uTexture', 'uTexel', 'uAspect', 'uTime',
  'uFlip', 'uMirror', 'uKaleido', 'uPixelate', 'uRgbSplit', 'uEcho',
  'uInvert', 'uSolarize', 'uBurn', 'uBrighten', 'uDarken', 'uEdges',
  'uHue', 'uHueSpeed', 'uSaturation', 'uContrast', 'uBrightness', 'uPosterize', 'uVignette',
];

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Effects shader failed to compile: ' + gl.getShaderInfoLog(shader));
  }
  return shader;
}

export class EffectsPass {
  constructor(visualizer) {
    this.visualizer = visualizer;
    this.renderer = visualizer.renderer;
    this.gl = this.renderer.gl;
    this.texsizeX = this.renderer.texsizeX;
    this.texsizeY = this.renderer.texsizeY;
    this.effects = { ...DEFAULT_EFFECTS };

    const gl = this.gl;
    this.program = gl.createProgram();
    gl.attachShader(this.program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(this.program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Effects shader failed to link: ' + gl.getProgramInfoLog(this.program));
    }

    this.positionLocation = gl.getAttribLocation(this.program, 'aPos');
    this.loc = {};
    UNIFORMS.forEach((name) => {
      this.loc[name] = gl.getUniformLocation(this.program, name);
    });

    this.vertexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // Stand in for Butterchurn's output (FXAA) shader.
    this.renderer.outputShader = this;
    this.setEffects(this.effects);
  }

  setEffects(effects) {
    this.effects = { ...DEFAULT_EFFECTS, ...effects };
    // Only route through the extra pass when something would change.
    this.visualizer.setOutputAA(isEffectsActive(this.effects));
  }

  // Called by Butterchurn when the render size changes.
  updateGlobals(opts) {
    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;
  }

  // Called by Butterchurn with the finished frame, drawing to the canvas.
  renderQuadTexture(texture) {
    const gl = this.gl;
    const e = this.effects;
    const loc = this.loc;
    const flag = (v) => (v ? 1 : 0);
    const deg = Math.PI / 180;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuf);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.positionLocation);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(loc.uTexture, 0);
    gl.uniform2f(loc.uTexel, 1 / this.texsizeX, 1 / this.texsizeY);
    gl.uniform1f(loc.uAspect, this.texsizeX / this.texsizeY);
    // Wrapped so float precision holds up over long sessions.
    gl.uniform1f(loc.uTime, (performance.now() / 1000) % 3600);

    gl.uniform2f(loc.uFlip, flag(e.flipX), flag(e.flipY));
    gl.uniform2f(
      loc.uMirror,
      flag(e.mirror === 'horizontal' || e.mirror === 'quad'),
      flag(e.mirror === 'vertical' || e.mirror === 'quad')
    );
    gl.uniform1f(loc.uKaleido, e.kaleidoscope);
    gl.uniform1f(loc.uPixelate, e.pixelate);
    gl.uniform1f(loc.uRgbSplit, e.rgbSplit * 0.06);
    gl.uniform1f(loc.uEcho, e.echo);

    gl.uniform1f(loc.uInvert, flag(e.invert));
    gl.uniform1f(loc.uSolarize, flag(e.solarize));
    gl.uniform1f(loc.uBurn, flag(e.burn));
    gl.uniform1f(loc.uBrighten, flag(e.brighten));
    gl.uniform1f(loc.uDarken, flag(e.darken));
    gl.uniform1f(loc.uEdges, flag(e.edges));

    gl.uniform1f(loc.uHue, e.hue * deg);
    gl.uniform1f(loc.uHueSpeed, e.hueCycle * deg);
    gl.uniform1f(loc.uSaturation, e.saturation);
    gl.uniform1f(loc.uContrast, e.contrast);
    gl.uniform1f(loc.uBrightness, e.brightness);
    gl.uniform1f(loc.uPosterize, e.posterize);
    gl.uniform1f(loc.uVignette, e.vignette);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
