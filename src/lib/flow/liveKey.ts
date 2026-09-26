// Real-time checkerboard keyer.
//
// Videos exported from AI character tools often have their background already
// removed, but the export bakes the editor's grey/white "transparency preview"
// checkerboard into the pixels. There is nothing to segment: we only have to
// turn that neutral grey/white pattern back into real alpha.
//
// This runs as a WebGL fragment shader, so a full 2560x1440 frame is keyed in
// well under a millisecond on the GPU — no pre-processing, no waiting.
//
// A pixel is background when it is (a) nearly colourless (R≈G≈B) and (b) bright.
// The Fairy's blue hair, dress, skin and jewellery all carry real saturation,
// so they are never touched. Soft edges get partial alpha, and the checker
// colour that bled into them is un-mixed so no grey rim is left behind.

export type EdgeStrength = "soft" | "normal" | "tight";

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tex;
uniform sampler2D keep;  // low-res "inside the character" protection mask
uniform vec2 texel;      // 1.0 / resolution
uniform float satLo;     // below this saturation -> fully background
uniform float satHi;     // above this saturation -> fully character
uniform float lumaLo;    // darker than this is never background
out vec4 outColor;

float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Alpha for one sample: colourless + bright => transparent.
float keyOf(vec3 c) {
  float s = sat(c);
  float l = lum(c);
  float a = smoothstep(satLo, satHi, s);          // colour => opaque
  float bright = smoothstep(lumaLo, lumaLo + 0.10, l); // dark => opaque
  return max(a, 1.0 - bright);
}

void main() {
  vec3 c = texture(tex, uv).rgb;
  float a = keyOf(c);

  // Average the neighbourhood so the checker seam never leaves a speckled rim.
  if (a < 0.98) {
    float n = keyOf(texture(tex, uv + vec2( texel.x, 0.0)).rgb)
            + keyOf(texture(tex, uv + vec2(-texel.x, 0.0)).rgb)
            + keyOf(texture(tex, uv + vec2(0.0,  texel.y)).rgb)
            + keyOf(texture(tex, uv + vec2(0.0, -texel.y)).rgb);
    a = min(1.0, max(a, 0.0) * 0.6 + (n * 0.25) * 0.4);
  }

  // White sparkles, eye highlights and pale areas INSIDE the character are
  // colourless too. They are protected because they are not joined to the
  // checkerboard that reaches the edge of the picture.
  a = max(a, smoothstep(0.45, 0.85, texture(keep, uv).r));

  if (a <= 0.004) { outColor = vec4(0.0); return; }

  // Un-mix the checker grey out of soft/semi-transparent pixels so wings and
  // hair tips keep their own colour instead of turning milky grey.
  float g = lum(c);
  vec3 pure = clamp((c - (1.0 - a) * vec3(g)) / max(a, 0.08), 0.0, 1.0);
  vec3 col = mix(c, pure, 1.0 - a);

  outColor = vec4(col * a, a); // premultiplied: matches canvas compositing
}`;


const LEVELS: Record<EdgeStrength, { satLo: number; satHi: number; lumaLo: number }> = {
  // Soft keeps more of the character (safer), tight removes more of the rim.
  soft:   { satLo: 0.035, satHi: 0.140, lumaLo: 0.42 },
  normal: { satLo: 0.055, satHi: 0.175, lumaLo: 0.38 },
  tight:  { satLo: 0.085, satHi: 0.225, lumaLo: 0.34 },
};

export interface LiveKeyer {
  /** Draws one video frame with the checkerboard keyed out. */
  render: (src: TexImageSource, w: number, h: number, strength: EdgeStrength) => boolean;
  dispose: () => void;
}

/** Creates a GPU keyer that draws into `canvas`. Returns null if WebGL is unavailable. */
export const createLiveKeyer = (canvas: HTMLCanvasElement): LiveKeyer | null => {
  const gl = canvas.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true, // lets taps read the pixel under the pointer
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[flow/liveKey] shader error", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[flow/liveKey] link error", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const mkTex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const tex = mkTex();
  const keepTex = mkTex();

  const uTexel = gl.getUniformLocation(prog, "texel");
  const uSatLo = gl.getUniformLocation(prog, "satLo");
  const uSatHi = gl.getUniformLocation(prog, "satHi");
  const uLumaLo = gl.getUniformLocation(prog, "lumaLo");
  gl.uniform1i(gl.getUniformLocation(prog, "tex"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "keep"), 1);

  // Small offscreen copy used to work out which colourless areas are joined to
  // the checkerboard at the picture edge. Cheap: ~200x110 pixels per frame.
  const MW = 200;
  const small = document.createElement("canvas");
  const sctx = small.getContext("2d", { willReadFrequently: true });
  let keepBuf: Uint8Array | null = null;

  /** Builds the "inside the character" protection mask for this frame. */
  const buildKeep = (src: TexImageSource, w: number, h: number, lv: { satLo: number; lumaLo: number }) => {
    if (!sctx) return null;
    const sw = Math.min(MW, w);
    const sh = Math.max(2, Math.round((h / w) * sw));
    if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
    try {
      sctx.clearRect(0, 0, sw, sh);
      sctx.drawImage(src as CanvasImageSource, 0, 0, sw, sh);
    } catch {
      return null;
    }
    let img: ImageData;
    try { img = sctx.getImageData(0, 0, sw, sh); } catch { return null; }
    const d = img.data;
    const N = sw * sh;
    // cand = colourless + bright (checkerboard-like)
    const cand = new Uint8Array(N);
    for (let p = 0, q = 0; p < N; p++, q += 4) {
      const r = d[q] / 255, g = d[q + 1] / 255, b = d[q + 2] / 255;
      const s = Math.max(r, g, b) - Math.min(r, g, b);
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      cand[p] = s < lv.satLo * 2.2 && l > lv.lumaLo ? 1 : 0;
    }
    // Flood from the border through candidate pixels: that is the real background.
    const seen = new Uint8Array(N);
    const stack: number[] = [];
    const push = (p: number) => { if (cand[p] && !seen[p]) { seen[p] = 1; stack.push(p); } };
    for (let x = 0; x < sw; x++) { push(x); push((sh - 1) * sw + x); }
    for (let y = 0; y < sh; y++) { push(y * sw); push(y * sw + sw - 1); }
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % sw, y = (p - x) / sw;
      if (x > 0) push(p - 1);
      if (x < sw - 1) push(p + 1);
      if (y > 0) push(p - sw);
      if (y < sh - 1) push(p + sw);
    }
    // keep = everything the background flood did NOT reach.
    if (!keepBuf || keepBuf.length !== N * 4) keepBuf = new Uint8Array(N * 4);
    for (let p = 0, q = 0; p < N; p++, q += 4) {
      const v = seen[p] ? 0 : 255;
      keepBuf[q] = v; keepBuf[q + 1] = v; keepBuf[q + 2] = v; keepBuf[q + 3] = 255;
    }
    return { data: keepBuf, w: sw, h: sh };
  };

  let lost = false;
  canvas.addEventListener("webglcontextlost", () => { lost = true; });

  return {
    render(src, w, h, strength) {
      if (lost || !w || !h) return false;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const lv = LEVELS[strength] ?? LEVELS.normal;
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
      } catch {
        return false; // frame not decodable yet
      }
      const keep = buildKeep(src, w, h, lv);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, keepTex);
      if (keep) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, keep.w, keep.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, keep.data);
      } else {
        // No mask available: protect nothing.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(uTexel, 1 / w, 1 / h);
      gl.uniform1f(uSatLo, lv.satLo);
      gl.uniform1f(uSatHi, lv.satHi);
      gl.uniform1f(uLumaLo, lv.lumaLo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteTexture(keepTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
};

