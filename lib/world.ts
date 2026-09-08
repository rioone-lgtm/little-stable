import * as THREE from 'three';
import { createSimulation, TRACK, TAU } from './simulation';

export type StableWorld = {
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
  scene.add(new THREE.HemisphereLight('#fff9de', '#7a9276', 2.5));
  const sunlight = new THREE.DirectionalLight('#fff1d0', 2.3);
  sunlight.position.set(-12, 25, 12);
  scene.add(sunlight);
  const camera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.1, 200);
  camera.position.set(36, 33, 44);
  camera.lookAt(0, 0, 0);
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
  box(0, -0.65, 0, 34, 1.3, 26, '#a18057');
  box(0, -0.05, 0, 34, 0.35, 26, '#89b75b');
  box(0, -1.28, 0, 33.5, 0.22, 25.5, '#796047');
  box(-7, 0.16, 5.9, 13, 0.06, 10.8, '#9fc564');
  box(-7, 0.17, -0.2, 14, 0.08, 1.6, '#d3c397');
  box(-1, 0.17, -2.5, 1.4, 0.08, 4, '#d3c397');
  box(-7.6, 0.18, -2.7, 12.5, 0.08, 1.4, '#d3c397');
  // Stable: five open-front bays and a shallow roof so resting horses remain visible.
  box(-7.6, 0.24, -6.8, 11.8, 0.2, 5.5, '#c4ae83');
  box(-7.6, 1.5, -9.5, 12, 0.3, 0.25, '#a6533c');
  box(-7.6, 1.1, -9.35, 12, 2, 0.3, '#b76243');
  box(-7.6, 2.35, -9.35, 12, 0.28, 0.35, '#eadbc0');
  for (let i = 0; i <= 5; i++) {
    const x = -13.1 + i * 2.2;
    box(x, 1.35, -7, 0.18, 2.5, 4.9, '#e8d9b4');
    // Bay dividers are low enough for a cutaway dollhouse view.
    box(x, 0.7, -7, 0.18, 0.85, 4.6, '#ae6748');
    box(x, 2.7, -7.9, 0.22, 0.3, 3.7, '#eadabb');
  }
  box(-7.6, 2.7, -5.1, 11.7, 0.24, 0.24, '#eadabb');
  for (let i = 0; i < 5; i++) {
    box(-12 + i * 2.2, 0.4, -8.5, 1.25, 0.25, 0.65, '#d8b956');
    box(-12 + i * 2.2, 1.7, -9.12, 0.75, 0.65, 0.12, '#475d53');
  }
  const roofMat = new THREE.MeshLambertMaterial({
    color: '#ab4e38',
    side: THREE.DoubleSide,
  });
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -13.6, 2.8, -10, -1.5, 2.8, -10, -1.5, 3.9, -8.9, -13.6, 2.8, -10, -1.5,
        3.9, -8.9, -13.6, 3.9, -8.9, -13.6, 3.9, -8.9, -1.5, 3.9, -8.9, -1.5,
        2.8, -7.8, -13.6, 3.9, -8.9, -1.5, 2.8, -7.8, -13.6, 2.8, -7.8,
      ],
      3,
    ),
  );
  roofGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(roofGeo, roofMat));
  for (let i = 0; i < 22; i++)
    box(-13.45 + i * 0.55, 3.92, -8.9, 0.045, 0.06, 0.12, '#c27450');
  // Small feed shed, hay stacks, trough and flag.
  box(-14.7, 0.8, -7.9, 2, 1.5, 2.6, '#73886c');
  box(-14.7, 1.64, -7.9, 2.25, 0.18, 2.85, '#495e50');
  box(-14.7, 0.7, -6.55, 0.8, 1.2, 0.1, '#41584b');
  for (let i = 0; i < 4; i++)
    box(
      -14.6 + (i % 2) * 0.85,
      0.4 + Math.floor(i / 2) * 0.55,
      -3.8,
      0.75,
      0.55,
      0.9,
      '#dbba58',
    );
  box(-11.3, 0.45, 9.4, 2.3, 0.5, 0.8, '#82938e');
  box(-11.3, 0.72, 9.4, 2, 0.04, 0.55, '#79bdd0');
  function fenceSegment(a: THREE.Vector2, b: THREE.Vector2) {
    const dx = b.x - a.x,
      dz = b.y - a.y,
      length = Math.hypot(dx, dz);
    box(a.x, 0.75, a.y, 0.13, 1.2, 0.13, '#f2e8ca');
    for (const y of [0.6, 1.02])
      box(
        (a.x + b.x) / 2,
        y,
        (a.y + b.y) / 2,
        0.09,
        0.095,
        length,
        '#ede3c8',
        undefined,
        Math.atan2(dx, dz),
      );
  }
  function fenceLine(ax: number, az: number, bx: number, bz: number) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
    for (let i = 0; i < n; i++)
      fenceSegment(
        new THREE.Vector2(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n),
        new THREE.Vector2(
          ax + ((bx - ax) * (i + 1)) / n,
          az + ((bz - az) * (i + 1)) / n,
        ),
      );
  }
  fenceLine(-13.6, 1, -7.5, 1);
  fenceLine(-5.5, 1, -0.7, 1);
  fenceLine(-13.6, 1, -13.6, 11);
  fenceLine(-13.6, 11, -0.7, 11);
  fenceLine(-0.7, 11, -0.7, 1);
  function ellipseRing(
    rx: number,
    rz: number,
    width: number,
    color: string,
    y: number,
  ) {
    const verts: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * TAU;
      for (const off of [-width / 2, width / 2])
        verts.push(
          TRACK.x + (rx + off) * Math.cos(t),
          y,
          (rz + off) * Math.sin(t),
        );
      if (i < 96) {
        const j = i * 2;
        indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(verts, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    scene.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
      ),
    );
  }
  ellipseRing(5.9, 9, 2.05, '#bc9163', 0.2);
  ellipseRing(5.9, 9, 0.025, '#d6b183', 0.215);
  for (const offset of [-1.18, 1.18])
    for (let i = 0; i < 64; i++) {
      // Entrance gap at the left-hand midpoint for horses to join and leave the track.
      if (offset > 0 && Math.abs(i - 32) < 2) continue;
      const a = (i / 64) * TAU,
        b = ((i + 1) / 64) * TAU;
      fenceSegment(
        new THREE.Vector2(
          8 + (5.9 + offset) * Math.cos(a),
          (9 + offset) * Math.sin(a),
        ),
        new THREE.Vector2(
          8 + (5.9 + offset) * Math.cos(b),
          (9 + offset) * Math.sin(b),
        ),
      );
    }
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 2; j++)
      box(
        8 + (i - 2.5) * 0.35,
        0.225,
        9 + (j - 0.5) * 0.32,
        0.35,
        0.02,
        0.32,
        (i + j) % 2 ? '#f5ebce' : '#65715a',
      );
  box(11, 1.8, 5, 0.09, 3.3, 0.09, '#e6ddbd');
  box(11.6, 3.05, 5, 1.2, 0.65, 0.06, '#d98145');
  // Low-poly trees and patches. Deterministic placement avoids layout changes on reload.
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const leafMat = new THREE.MeshLambertMaterial({
    color: '#62924e',
    flatShading: true,
  });
  const treePositions = [
    [-15, 9],
    [-15, 5],
    [-15, 1],
    [-12, -11],
    [-7, -11],
    [-2, -11],
    [15, -10],
    [15, -6],
    [15, 6],
    [15, 10],
    [1, 11],
    [8, -1],
    [10, 2],
    [7, 4],
  ];
  const foliage = new THREE.InstancedMesh(
    leafGeo,
    leafMat,
    treePositions.length * 2,
  );
  const dummy = new THREE.Object3D();
  let fi = 0;
  for (const [x, z] of treePositions) {
    box(x, 1, z, 0.35, 1.9, 0.35, '#87664a');
    for (let j = 0; j < 2; j++) {
      dummy.position.set(x + (j ? -0.3 : 0.2), 2.1 + j * 0.65, z);
      dummy.scale.set(1.2 - j * 0.3, 1.15, 1.1 - j * 0.2);
      dummy.rotation.y = fi;
      dummy.updateMatrix();
      foliage.setMatrixAt(fi, dummy.matrix);
      foliage.setColorAt(fi++, new THREE.Color(j ? '#80ac57' : '#5c9048'));
    }
  }
  scene.add(foliage);
  for (let i = 0; i < 110; i++) {
    const x = -12.7 + (Math.sin(i * 17.17) * 0.5 + 0.5) * 11.1,
      z = 2 + (Math.sin(i * 39.81) * 0.5 + 0.5) * 8.1;
    box(x, 0.25, z, 0.09, 0.25, 0.08, i % 4 ? '#7fa94f' : '#e6d99c');
  }
  for (let i = 0; i < 15; i++)
    box(-16.1 + i * 2.15, -0.45, 12.98, 0.65, 0.25, 0.05, '#b29365');
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
  const simulation = createSimulation();
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
  // Fit the entire island at every aspect ratio without rotating or translating the view.
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const halfH = Math.max(18.5, 24 / aspect);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
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
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
