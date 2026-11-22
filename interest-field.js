(() => {
  window.cleanupInterestField?.();
  const canvas = document.getElementById('interest-field');
  const field = canvas && canvas.closest('.constellation-map');
  if (!canvas || !field) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  const vertexSource = `#version 300 es
  in vec2 position;
  out vec2 uv;
  void main() {
    uv = position * .5 + .5;
    gl_Position = vec4(position, 0.0, 1.0);
  }`;
  const fragmentSource = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform vec2 resolution;
  uniform vec2 pointer;
  uniform float elapsed;
  uniform float motion;
  uniform vec3 tint;
  out vec4 color;
  void main() {
    vec2 p = uv - .5;
    p.x *= resolution.x / resolution.y;
    float t = elapsed * .075 * motion;
    vec2 drift = vec2(sin(t) * .045, cos(t * .8) * .035);
    vec2 p1 = p - vec2(-.18, .12) - drift;
    vec2 p2 = p - vec2(.22, -.08) + drift * .7;
    vec2 mouse = (pointer - .5) * vec2(resolution.x / resolution.y, 1.0);
    float a = exp(-dot(p1, p1) * 12.0);
    float b = exp(-dot(p2, p2) * 10.0);
    float c = exp(-dot(p - mouse, p - mouse) * 18.0) * .16;
    float contour = .5 + .5 * sin((p.x * 3.0 + p.y * 2.2 + sin(p.y * 4.0 - t) * .18) * 4.0);
    float field = clamp(a * .56 + b * .38 + c + contour * .08, 0.0, 1.0);
    vec3 pale = vec3(.76, .87, .97);
    vec3 ink = mix(pale, tint, .48 + contour * .14);
    float edge = smoothstep(.04, .82, field) * .48;
    color = vec4(ink, edge);
  }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'resolution'),
    pointer: gl.getUniformLocation(program, 'pointer'),
    elapsed: gl.getUniformLocation(program, 'elapsed'),
    motion: gl.getUniformLocation(program, 'motion'),
    tint: gl.getUniformLocation(program, 'tint')
  };
  const tints = {
    ai: [0.10, 0.38, 0.76],
    bio: [0.06, 0.47, 0.72],
    policy: [0.12, 0.32, 0.68],
    philosophy: [0.22, 0.40, 0.70],
    innovation: [0.08, 0.43, 0.78]
  };
  let pointer = [.66, .5];
  let frame = 0;
  let start = performance.now();
  let visible = true;
  let paused = document.hidden;
  let disposed = false;

  function resize() {
    const rect = field.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }
  function draw(now) {
    frame = 0;
    if (disposed || !canvas.isConnected || paused || !visible) return;
    resize();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, pointer[0], pointer[1]);
    gl.uniform1f(uniforms.elapsed, (now - start) / 1000);
    gl.uniform1f(uniforms.motion, reducedMotion.matches ? 0 : 1);
    gl.uniform3fv(uniforms.tint, tints[field.dataset.active] || tints.ai);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
  }
  function schedule() {
    if (!disposed && canvas.isConnected && !frame && !paused && visible) frame = requestAnimationFrame(draw);
  }
  field.addEventListener('pointermove', event => {
    const rect = field.getBoundingClientRect();
    pointer = [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height];
    schedule();
  }, { passive: true });
  field.addEventListener('pointerleave', () => {
    pointer = [.66, .5];
    schedule();
  }, { passive: true });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
  });
  observer.observe(field);
  const onVisibilityChange = () => {
    paused = document.hidden;
    if (!paused) schedule();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  field.querySelectorAll('[data-interest]').forEach(button => button.addEventListener('click', schedule));
  reducedMotion.addEventListener?.('change', schedule);
  window.cleanupInterestField = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.removeEventListener?.('change', schedule);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
  resize();
  draw(performance.now());
})();