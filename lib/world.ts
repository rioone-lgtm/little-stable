import { zoomAt, clampView, type Viewport } from './viewport';
import { environmentAt, type Environment } from './environment';
import * as THREE from 'three';
import {
  createSimulation,
  TRACK,
  TAU,
  trackPoint,
  stall,
  STALL_CAPACITY,
} from './simulation';

export type StableWorld = {
  zoomBy(factor: number): void;
  resetZoom(): void;
  setEnvironment(value: Environment): void;
  setPaused(value: boolean): void;
  setSpeed(value: number): void;
  dispose(): void;
};
type Counts = { rest: number; graze: number; run: number; walk: number };
type Block = { object: THREE.Object3D; color: THREE.Color };

export function createWorld(
  host: HTMLElement,
  onCounts: (counts: Counts) => void,
  onStatus: (text: string) => void,
): StableWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e3eddb');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#e3eddb');
  host.appendChild(renderer.domElement);
  const ambient = new THREE.HemisphereLight('#fff9de', '#7a9276', 2.5);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight('#fff1d0', 2.3);
  sunlight.position.set(-12, 25, 12);
  scene.add(sunlight);
  const camera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.1, 200);
  camera.position.set(36, 33, 44);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial();
  const blocks: Block[] = [];
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    parent?: THREE.Object3D,
    rotation = 0,
  ) {
    const object = new THREE.Object3D();
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    object.rotation.y = rotation;
    parent?.add(object);
    blocks.push({ object, color: new THREE.Color(color) });
    return object;
  }

  box(0, -0.65, 0, 25, 1.3, 27, '#99866b');
  box(0, -0.05, 0, 25, 0.35, 27, '#8c9d69');
  box(0, -1.28, 0, 24.5, 0.22, 26.5, '#776b56');
  box(-7.5, 0.18, 0, 6.9, 0.1, 22, '#c6bd9e');
  box(-7.5, 0.2, 0, 1.55, 0.06, 22.8, '#aba798');
  box(-5, 0.18, 11.3, 6.5, 0.08, 1.5, '#c5bda5');
  box(-2.5, 0.18, 5.65, 1.4, 0.08, 12.6, '#c5bda5');
  box(-0.6, 0.19, 0, 5, 0.08, 1.6, '#c5bda5');
  // A single long cream stable, with eight bays west and seven east of its aisle.
  box(-10.65, 1.45, 0, 0.18, 2.6, 21.2, '#cac9ad');
  box(-4.35, 0.8, 0, 0.18, 1.3, 21.2, '#c4c5a7');
  box(-7.5, 1.4, -10.55, 6.4, 2.5, 0.18, '#d2cdb8');
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 1024;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d')!;
  ctx.fillStyle = '#53584f';
  ctx.fillRect(0, 0, 1024, 64);
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff5d9';
  for (let i = 0; i < 15; i++)
    ctx.fillText(String(i + 1).padStart(2, '0'), i * 64 + 32, 32);
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  for (let id = 0; id < STALL_CAPACITY; id++) {
    const p = stall(id),
      left = id < 8,
      wallX = left ? -10.55 : -4.45,
      frontX = left ? -8.25 : -6.75;
    box(p.x, 0.24, p.z, 2.6, 0.12, 2.45, id < 10 ? '#c5b374' : '#bdb69d');
    for (const z of [p.z - 1.3, p.z + 1.3])
      box(p.x, 0.95, z, 2.7, 1.45, 0.12, '#babda2');
    box(frontX, 1.55, p.z - 1.2, 0.14, 2.7, 0.14, '#d9d4bc');
    // Wide open doorway; the dedicated horse approaches horizontally from the aisle.
    for (const dz of [-0.98, 0.98])
      box(frontX, 0.95, p.z + dz, 0.12, 1.45, 0.4, '#929980');
    box(wallX, 1.85, p.z, 0.06, 0.55, 0.8, '#65796d');
    box(p.x, 0.39, p.z - 0.85, 0.75, 0.25, 0.4, '#c6b675');
    const geo = new THREE.PlaneGeometry(0.62, 0.38);
    const uv = geo.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (id + uv.getX(k)) / 16);
    const plate = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: labelTexture,
        side: THREE.DoubleSide,
      }),
    );
    plate.position.set(frontX, 2.6, p.z);
    plate.rotation.y = Math.PI / 2;
    scene.add(plate);
  }
  // Gray-brown tiled gable, with the camera-facing half cut away to expose the bays.
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -11, 2.9, -11, -7.5, 4, -11, -7.5, 4, 10.9, -11, 2.9, -11, -7.5, 4,
        10.9, -11, 2.9, 10.9, -7.5, 4, -11, -6.9, 3.81, -11, -6.9, 3.81, 10.9,
        -7.5, 4, -11, -6.9, 3.81, 10.9, -7.5, 4, 10.9,
      ],
      3,
    ),
  );
  roofGeo.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      roofGeo,
      new THREE.MeshLambertMaterial({
        color: '#827e73',
        side: THREE.DoubleSide,
      }),
    ),
  );
  box(-7.5, 4.04, 0, 0.2, 0.15, 22.3, '#555b59');
  for (let i = 0; i < 43; i++)
    box(-9.25, 3.47, -10.8 + i * 0.51, 3.6, 0.045, 0.06, '#959084').rotation.z =
      0.305;
  // Small roof ventilators belong to the same building.
  for (const z of [-6, 3]) {
    box(-8.2, 3.98, z, 0.85, 0.55, 1.6, '#c2bda9');
    box(-8.2, 4.31, z, 1.15, 0.14, 1.95, '#666d69');
  }
  function fenceSegment(a: THREE.Vector2, b: THREE.Vector2) {
    const dx = b.x - a.x,
      dz = b.y - a.y,
      length = Math.hypot(dx, dz);
    box(a.x, 0.65, a.y, 0.085, 1, 0.085, '#aaa995');
    for (const y of [0.5, 0.92])
      box(
        (a.x + b.x) / 2,
        y,
        (a.y + b.y) / 2,
        0.065,
        0.07,
        length,
        '#d4d0b9',
        undefined,
        Math.atan2(dx, dz),
      );
  }
  function ring(offset: number, width: number, color: string, y: number) {
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = Math.PI + (i / 128) * TAU;
      for (const o of [offset - width / 2, offset + width / 2]) {
        const p = trackPoint(angle, 1);
        const outer = trackPoint(angle + 0.0001, 1);
        const dx = outer.x - p.x,
          dz = outer.z - p.z,
          len = Math.hypot(dx, dz);
        vertices.push(p.x - (dz / len) * o, y, p.z + (dx / len) * o);
      }
      if (i < 128) {
        const j = i * 2;
        indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    scene.add(
      new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
      ),
    );
  }
  ring(0, 2.3, '#c7bea4', 0.2);
  for (const o of [-0.65, -0.32, 0.32, 0.65]) ring(o, 0.025, '#b4ab91', 0.215);
  // The infield is the sole grazing area; both railings open at the stable crossing.
  for (const offset of [-1.25, 1.25])
    for (let i = 0; i < 96; i++) {
      if (i < 2 || i > 93) continue;
      const points = [i, i + 1].map((n) => {
        const angle = Math.PI + (n / 96) * TAU,
          p = trackPoint(angle, 1),
          q = trackPoint(angle + 0.0001, 1),
          dx = q.x - p.x,
          dz = q.z - p.z,
          l = Math.hypot(dx, dz);
        return new THREE.Vector2(
          p.x - (dz / l) * offset,
          p.z + (dx / l) * offset,
        );
      });
      fenceSegment(points[0], points[1]);
    }
  box(5, 0.16, 0, 7.8, 0.055, 11.3, '#93a56e');
  box(7, 0.45, 6.4, 2, 0.5, 0.7, '#92988a');
  box(7, 0.72, 6.4, 1.7, 0.04, 0.47, '#84aeb0');
  const leafGeo = new THREE.IcosahedronGeometry(1, 0),
    leafMat = new THREE.MeshLambertMaterial({
      color: '#687f54',
      flatShading: true,
    });
  const treePositions = [
    [-11.5, -11.9],
    [-11.5, 11.9],
    [11.3, -11.7],
    [11.4, 11.7],
    [1.4, 11.8],
    [2, -11.9],
  ];
  const foliage = new THREE.InstancedMesh(
    leafGeo,
    leafMat,
    treePositions.length,
  );
  const dummy = new THREE.Object3D();
  treePositions.forEach(([x, z], i) => {
    box(x, 0.8, z, 0.25, 1.3, 0.25, '#807059');
    dummy.position.set(x, 1.8, z);
    dummy.scale.set(0.85, 1, 0.85);
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
  });
  scene.add(foliage);
  for (let i = 0; i < 140; i++) {
    const x = 1.5 + (Math.sin(i * 17.17) * 0.5 + 0.5) * 7,
      z = -5.7 + (Math.sin(i * 39.81) * 0.5 + 0.5) * 11.4;
    box(x, 0.25, z, 0.08, 0.2, 0.08, i % 5 ? '#7b925c' : '#c3b583');
  }
  const staticMesh = new THREE.InstancedMesh(
    boxGeometry,
    material,
    blocks.length,
  );
  blocks.forEach((b, i) => {
    b.object.updateMatrixWorld();
    staticMesh.setMatrixAt(i, b.object.matrixWorld);
    staticMesh.setColorAt(i, b.color);
  });
  scene.add(staticMesh);
  blocks.length = 0;
  let environment = environmentAt(Date.now());
  const simulation = createSimulation(9817, environment.hour);
  const coats = [
    '#7f4830',
    '#c2a17a',
    '#e3dece',
    '#51392c',
    '#ad6739',
    '#bb956c',
    '#403b39',
    '#975133',
    '#d6cabb',
    '#6c4534',
  ];
  const models = simulation.horses.map((h) => {
    const root = new THREE.Group();
    box(0, 1.05, 0, 0.65, 0.68, 1.15, coats[h.id], root);
    box(0, 1.12, -0.52, 0.59, 0.6, 0.35, coats[h.id], root);
    const head = new THREE.Group();
    head.position.set(0, 1.25, 0.48);
    root.add(head);
    box(0, 0.28, 0.09, 0.43, 0.8, 0.44, coats[h.id], head);
    box(0, 0.64, 0.31, 0.46, 0.42, 0.7, coats[h.id], head);
    box(
      0,
      0.54,
      0.62,
      0.45,
      0.23,
      0.2,
      h.id % 3 === 0 ? '#d3b49c' : '#6f5647',
      head,
    );
    box(-0.15, 0.98, 0.14, 0.12, 0.3, 0.15, coats[h.id], head);
    box(0.15, 0.98, 0.14, 0.12, 0.3, 0.15, coats[h.id], head);
    box(-0.235, 0.72, 0.37, 0.035, 0.08, 0.08, '#242b25', head);
    box(0.235, 0.72, 0.37, 0.035, 0.08, 0.08, '#242b25', head);
    if (h.id % 2 === 0) box(0, 0.71, 0.666, 0.1, 0.23, 0.016, '#f4ebd4', head);
    box(0, 0.39, -0.15, 0.13, 0.87, 0.12, '#342e27', head);
    const legs: THREE.Group[] = [];
    for (const x of [-0.22, 0.22])
      for (const z of [-0.4, 0.4]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.88, z);
        root.add(leg);
        box(0, -0.3, 0, 0.16, 0.65, 0.17, coats[h.id], leg);
        box(
          0,
          -0.61,
          0.025,
          0.19,
          0.15,
          0.23,
          h.id % 3 === 1 ? '#e2d6bb' : '#34352d',
          leg,
        );
        legs.push(leg);
      }
    const tail = new THREE.Group();
    tail.position.set(0, 1.27, -0.64);
    root.add(tail);
    box(0, -0.25, -0.08, 0.15, 0.7, 0.18, '#393028', tail);
    tail.rotation.x = -0.3;
    return { root, head, legs, tail };
  });
  const horseMesh = new THREE.InstancedMesh(
    boxGeometry,
    material,
    blocks.length,
  );
  horseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  horseMesh.frustumCulled = false;
  blocks.forEach((b, i) => horseMesh.setColorAt(i, b.color));
  scene.add(horseMesh);
  const shadowGeometry = new THREE.CircleGeometry(1, 12);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: '#4b6440',
    transparent: true,
    opacity: 0.19,
    depthWrite: false,
  });
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, 10);
  shadows.frustumCulled = false;
  scene.add(shadows);
  // Shared particle buffers keep precipitation cheap on mobile; no flashing lightning.
  const particlePositions = new Float32Array(240 * 6);
  for (let i = 0; i < 240; i++) {
    const x = Math.sin(i * 19.7) * 12,
      y = (i * 1.73) % 12,
      z = Math.cos(i * 7.3) * 13;
    particlePositions.set([x, y, z, x, y - 0.4, z], i * 6);
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3),
  );
  const rainMaterial = new THREE.LineBasicMaterial({
    color: '#bbd2e4',
    transparent: true,
    opacity: 0.5,
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  scene.add(rain);
  const snowPositions = new Float32Array(240 * 3);
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(snowPositions, 3),
  );
  const snowMaterial = new THREE.PointsMaterial({
    color: '#e8eff4',
    size: 0.12,
    transparent: true,
    opacity: 0.8,
  });
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  snow.frustumCulled = false;
  scene.add(snow);
  const lamps = new THREE.Group();
  for (const z of [-7, 7]) {
    const lamp = new THREE.PointLight('#ffcc7b', 10, 7, 2);
    lamp.position.set(-7.5, 2.6, z);
    lamps.add(lamp);
  }
  scene.add(lamps);
  const nightColor = new THREE.Color('#172537'),
    dayColor = new THREE.Color('#e3eddb'),
    overcast = new THREE.Color('#a7b3b5'),
    twilight = new THREE.Color('#c59379'),
    sky = new THREE.Color();
  const fog = new THREE.Fog('#a7b3b5', 45, 110);
  function applyEnvironment(value: Environment) {
    environment = value;
    simulation.setHour(value.hour);
    const kind = value.weather?.kind,
      cloud = value.weather ? value.weather.cloud / 100 : 0.2,
      day = value.daylight;
    sky.copy(nightColor).lerp(dayColor, day);
    if (day > 0 && day < 1) sky.lerp(twilight, Math.sin(day * Math.PI) * 0.5);
    sky.lerp(overcast, cloud * day * 0.55);
    scene.background = sky;
    ambient.intensity = 0.65 + day * 1.85;
    ambient.color.set(day < 0.3 ? '#8ea8d3' : '#fff4dc');
    sunlight.intensity = 0.18 + day * 2.3 * (1 - cloud * 0.75);
    sunlight.color.set(
      day < 0.3 ? '#acc8ff' : day < 0.9 ? '#ffbd86' : '#fff1d0',
    );
    sunlight.position.set(
      Math.cos((value.hour / 24) * TAU) * 22,
      8 + day * 20,
      12,
    );
    lamps.visible = day < 0.45;
    shadowMaterial.opacity = 0.08 + day * 0.11;
    rain.visible = kind === 'rain' || kind === 'storm';
    snow.visible = kind === 'snow';
    rainGeometry.setDrawRange(
      0,
      Math.min(240, 60 + Math.round((value.weather?.precipitation ?? 0) * 35)) *
        2,
    );
    fog.color.copy(sky);
    scene.fog = kind === 'fog' || kind === 'storm' ? fog : null;
  }
  applyEnvironment(environment);
  // Derive the fitted view from projected bounds; camera orientation never changes.
  const bounds = [];
  for (const x of [-12.5, 12.5])
    for (const y of [-1.5, 4.5])
      for (const z of [-13.5, 13.5])
        bounds.push(
          new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
        );
  const fitX = Math.max(...bounds.map((p) => Math.abs(p.x))) * 1.06,
    fitY = Math.max(...bounds.map((p) => Math.abs(p.y))) * 1.06;
  let view: Viewport = {
    zoom: 1,
    x: 0,
    y: 0,
    halfWidth: fitX,
    halfHeight: fitY,
  };
  function projectView() {
    view = clampView(view);
    const hw = view.halfWidth / view.zoom,
      hh = view.halfHeight / view.zoom;
    camera.left = view.x - hw;
    camera.right = view.x + hw;
    camera.top = view.y + hh;
    camera.bottom = view.y - hh;
    camera.updateProjectionMatrix();
  }
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: {
    distance: number;
    view: Viewport;
    anchorX: number;
    anchorY: number;
  } | null = null;
  function pair() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return null;
    const rect = host.getBoundingClientRect();
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      x: (((a.x + b.x) / 2 - rect.left) / rect.width) * 2 - 1,
      y: 1 - (((a.y + b.y) / 2 - rect.top) / rect.height) * 2,
    };
  }
  function startPinch() {
    const p = pair();
    pinch =
      p && p.distance > 1
        ? {
            distance: p.distance,
            view: { ...view },
            anchorX: p.x,
            anchorY: p.y,
          }
        : null;
  }
  function pointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    renderer.domElement.setPointerCapture(e.pointerId);
    if (pointers.size === 2) startPinch();
  }
  function pointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pair();
    if (!p || !pinch) return;
    e.preventDefault();
    view = zoomAt(
      pinch.view,
      (pinch.view.zoom * p.distance) / pinch.distance,
      pinch.anchorX,
      pinch.anchorY,
    );
    view.x += ((pinch.anchorX - p.x) * view.halfWidth) / view.zoom;
    view.y += ((pinch.anchorY - p.y) * view.halfHeight) / view.zoom;
    projectView();
  }
  function pointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    startPinch();
  }
  function clearPointers() {
    pointers.clear();
    pinch = null;
  }
  function wheel(e: WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    view = zoomAt(
      view,
      view.zoom * Math.exp(-e.deltaY * 0.01),
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((e.clientY - rect.top) / rect.height) * 2,
    );
    projectView();
  }
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('lostpointercapture', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('blur', clearPointers);
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h,
      halfHeight = Math.max(fitY, fitX / aspect);
    view = { ...view, halfWidth: halfHeight * aspect, halfHeight };
    projectView();
    clearPointers();
    renderer.setSize(w, h, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let paused = false,
    speed = 1,
    elapsed = 0,
    last = 0,
    frame = 0,
    disposed = false,
    lost = false,
    lastCounts = -1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = 1000 / (reduced ? 24 : 30);
  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden || lost) {
      last = now;
      return;
    }
    if (now - last < interval) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    // The wall clock and weather are independent of pause and simulation speed.
    if (rain.visible || snow.visible) {
      for (let i = 0; i < 240; i++) {
        const j = i * 6;
        let y = particlePositions[j + 1] - dt * (snow.visible ? 1.15 : 13);
        if (y < 0.3) y = 12;
        particlePositions[j + 1] = y;
        particlePositions[j + 4] = y - 0.4;
        snowPositions[i * 3] =
          particlePositions[j] + Math.sin(now * 0.0007 + i) * 0.35;
        snowPositions[i * 3 + 1] = y;
        snowPositions[i * 3 + 2] = particlePositions[j + 2];
      }
      rainGeometry.attributes.position.needsUpdate = true;
      snowGeometry.attributes.position.needsUpdate = true;
    }
    if (!paused) {
      simulation.update(dt * speed);
      elapsed += dt * speed;
    }
    simulation.horses.forEach((h, i) => {
      const m = models[i];
      const moving = h.state === 'run' || h.state === 'walk';
      m.root.position.set(
        h.x,
        0.17 + (h.state === 'run' ? Math.abs(Math.sin(h.phase)) * 0.075 : 0),
        h.z,
      );
      m.root.rotation.y = h.angle;
      m.head.rotation.x =
        h.state === 'graze'
          ? 1.03 + Math.sin(h.phase) * 0.07
          : h.state === 'rest'
            ? 0.12
            : Math.sin(h.phase) * 0.045;
      m.legs.forEach(
        (leg, j) =>
          (leg.rotation.x = moving
            ? Math.sin(h.phase + (j === 0 || j === 3 ? 0 : Math.PI)) *
              (h.state === 'run' ? 0.65 : 0.3)
            : 0),
      );
      m.tail.rotation.z = Math.sin(h.phase * 0.7) * 0.16;
      m.root.updateMatrixWorld(true);
      dummy.position.set(h.x, 0.235, h.z);
      dummy.rotation.set(0, h.angle, 0);
      dummy.scale.set(0.65, 1, 1.02);
      dummy.updateMatrix();
      shadows.setMatrixAt(i, dummy.matrix);
    });
    blocks.forEach((b, i) => horseMesh.setMatrixAt(i, b.object.matrixWorld));
    horseMesh.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    if (elapsed - lastCounts >= 0.5) {
      onCounts(simulation.counts());
      lastCounts = elapsed;
    }
    renderer.render(scene, camera);
  }
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    onStatus('描画が一時停止しました。復帰を待っています…');
  };
  const onRestored = () => {
    lost = false;
    last = performance.now();
    onStatus('');
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  onCounts(simulation.counts());
  frame = requestAnimationFrame(tick);
  return {
    setEnvironment: applyEnvironment,
    zoomBy(factor) {
      view = zoomAt(view, view.zoom * factor);
      projectView();
      clearPointers();
    },
    resetZoom() {
      view = { ...view, zoom: 1, x: 0, y: 0 };
      projectView();
      clearPointers();
    },
    setPaused(v) {
      paused = v;
    },
    setSpeed(v) {
      speed = v;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', clearPointers);
      clearPointers();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onRestored,
      );
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
          if (o instanceof THREE.InstancedMesh) o.dispose();
        }
      });
      geometries.forEach((g) => g.dispose());
      rainGeometry.dispose();
      rainMaterial.dispose();
      snowGeometry.dispose();
      snowMaterial.dispose();
      labelTexture.dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
