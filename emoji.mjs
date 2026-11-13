const canvas = globalThis.document?.querySelector('.emoji-model');
const fallback = canvas?.nextElementSibling;

export function sphereMesh() {
  const vertices = [], indices = [], rows = 48, columns = 64;
  for (let row = 0; row <= rows; row++) {
    const latitude = row / rows * Math.PI;
    for (let column = 0; column <= columns; column++) {
      const longitude = column / columns * Math.PI * 2;
      vertices.push(Math.sin(latitude) * Math.sin(longitude), Math.cos(latitude), Math.sin(latitude) * Math.cos(longitude));
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

async function createEmoji() {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) { canvas.dataset.error = 'WebGL unavailable'; return; }
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec3 position;
    uniform vec2 rotation;
    uniform float scale;
    varying vec3 modelPosition, worldPosition, normal;
    void main() {
      float cy = cos(rotation.x), sy = sin(rotation.x);
      float cp = cos(rotation.y), sp = sin(rotation.y);
      vec3 p = vec3(cy * position.x + sy * position.z, position.y, -sy * position.x + cy * position.z);
      p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
      modelPosition = position;
      normal = p;
      worldPosition = p * scale;
      float z = worldPosition.z - 3.6;
      gl_Position = vec4(worldPosition.xy * 3.1, -1.0202 * z - .20202, -z);
    }
  `));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D expression;
    uniform bool outline;
    varying vec3 modelPosition, worldPosition, normal;
    void main() {
      if (outline) { gl_FragColor = vec4(.15, .14, .11, 1.); return; }
      vec4 face = texture2D(expression, vec2(modelPosition.x * .5 + .5, .5 - modelPosition.y * .5));
      face.a *= smoothstep(.05, .18, modelPosition.z);
      vec3 color = mix(vec3(1., .83, .32), face.rgb, face.a);
      vec3 n = normalize(normal), light = normalize(vec3(-.6, .9, 1.5));
      vec3 view = normalize(vec3(0., 0., 3.6) - worldPosition);
      float diffuse = max(dot(n, light), 0.);
      float shine = pow(max(dot(reflect(-light, n), view), 0.), 42.);
      gl_FragColor = vec4(color * (.48 + .5 * diffuse) + vec3(1., .94, .8) * shine * .16, 1.);
    }
  `));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const { vertices, indices } = sphereMesh();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const response = await fetch(fallback.getAttribute('src'));
  if (!response.ok) throw new Error('Expression asset unavailable');
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  svg.getElementById('face-silhouette').remove();
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const image = new Image();
  try { image.src = url; await image.decode(); }
  finally { URL.revokeObjectURL(url); }
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'expression'), 0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  const rotation = gl.getUniformLocation(program, 'rotation');
  const scale = gl.getUniformLocation(program, 'scale');
  const outline = gl.getUniformLocation(program, 'outline');
  let yaw = -.12, pitch = -.05, velocityX = 0, velocityY = 0, drag = null, frame = 0, previous = 0;
  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  function draw(time) {
    frame = 0;
    if (canvas.hidden || gl.isContextLost()) return;
    const delta = Math.min((time - previous || 16) / 16.67, 2);
    previous = time;
    if (!drag) {
      yaw += velocityX * delta;
      pitch = Math.max(-1.15, Math.min(1.15, pitch + velocityY * delta));
      velocityX *= .88 ** delta;
      velocityY *= .88 ** delta;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(rotation, yaw, pitch);
    gl.cullFace(gl.FRONT);
    gl.uniform1f(scale, 1.025);
    gl.uniform1i(outline, 1);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    gl.cullFace(gl.BACK);
    gl.uniform1f(scale, 1);
    gl.uniform1i(outline, 0);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    if (!drag && Math.abs(velocityX) + Math.abs(velocityY) > .0001) requestDraw();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    velocityX = velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = (event.clientX - drag.x) * .012, dy = (event.clientY - drag.y) * .012;
    yaw += dx;
    pitch = Math.max(-1.15, Math.min(1.15, pitch + dy));
    velocityX = Math.max(-.12, Math.min(.12, dx));
    velocityY = Math.max(-.12, Math.min(.12, dy));
    drag.x = event.clientX; drag.y = event.clientY;
    requestDraw();
  });
  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    if (event.type === 'pointercancel' || matchMedia('(prefers-reduced-motion: reduce)').matches) velocityX = velocityY = 0;
    requestDraw();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    velocityX = velocityY = 0;
    if (event.key === 'Home') { yaw = -.12; pitch = -.05; }
    else if (event.key === 'ArrowLeft') yaw -= .15;
    else if (event.key === 'ArrowRight') yaw += .15;
    else pitch = Math.max(-1.15, Math.min(1.15, pitch + (event.key === 'ArrowUp' ? -.12 : .12)));
    requestDraw();
  });
  new ResizeObserver(() => {
    const size = Math.max(1, Math.round(canvas.getBoundingClientRect().width * Math.min(devicePixelRatio, 2)));
    if (canvas.width !== size) canvas.width = canvas.height = size;
    requestDraw();
  }).observe(canvas);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    canvas.hidden = true; fallback.hidden = false;
  });
  fallback.hidden = true;
  canvas.hidden = false;
  canvas.dataset.ready = 'true';
  requestDraw();
}
if (canvas) createEmoji().catch(error => { canvas.dataset.error = error.message; canvas.hidden = true; fallback.hidden = false; });
