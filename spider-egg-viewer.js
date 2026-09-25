// Spider Egg viewer with three mission sequences:
//   - lower bay: doors open, the three Spiders drop out, doors close
//   - upper bay: hatches open, FPV drones lift off and hover, hatches close
//   - sensor mast: rotates up from its stowed position along the hull
// Each button plays its sequence forward, and a second press reverses it.
import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("spider-view");
const canvas = container.querySelector("canvas");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
camera.position.set(2.4, 0.8, 3.3);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 7;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.target.set(0, -0.05, 0);

const HULL = 0xff9bd5, PAYLOAD = 0xffffff;
const makeMaterial = (color, opacity) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.35, transparent: true, opacity,
  emissive: new THREE.Color(color), emissiveIntensity: 0.18,
  side: THREE.DoubleSide, depthWrite: false
});

const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// 0 → 1 → 0 envelope for doors: open for `open` s, hold, close over the last `close` s
const doorEnvelope = (time, total, open, close) =>
  time < open ? ease(time / open) : time > total - close ? ease((total - time) / close) : 1;

const parts = { doors: [], spiders: [], hatches: [], drones: [], props: [], mast: null };

// ---------------- Sequences ----------------
const DOOR_OPEN = THREE.MathUtils.degToRad(105);
const SPIDER_DROP = 1.25;
const spiderSeq = {
  duration: 3.7,
  pose(time, forward) {
    const d = doorEnvelope(time, this.duration, 1.0, 1.0);
    parts.doors.forEach(({ node, sign }) => { node.rotation.x = sign * DOOR_OPEN * d; });
    parts.spiders.forEach(({ node, home }, i) => {
      const order = forward ? i : 2 - i;
      const t = clamp01((time - 1.0 - order * 0.35) / 0.9);
      const out = forward ? t * t : 1 - ease(t); // gravity-like drop, smooth reload
      node.position.set(home.x + out * 0.15, home.y - out * SPIDER_DROP, home.z);
      node.rotation.z = -out * 0.12;
    });
  }
};

const HATCH_OPEN = THREE.MathUtils.degToRad(120);
const HOVER = [new THREE.Vector3(0.45, 0.9, 0.75), new THREE.Vector3(0.05, 1.15, -0.35), new THREE.Vector3(-0.45, 0.8, 0.45)];
const droneSeq = {
  duration: 3.6,
  pose(time, forward) {
    const h = doorEnvelope(time, this.duration, 0.8, 0.8);
    parts.hatches.forEach(({ node, sign }) => { node.rotation.x = sign * HATCH_OPEN * h; });
    parts.drones.forEach((drone, i) => {
      const order = forward ? i : 2 - i;
      const t = ease(clamp01((time - 0.8 - order * 0.25) / 1.2));
      drone.out = forward ? t : 1 - t;
    });
  }
};

const MAST_STOWED = THREE.MathUtils.degToRad(88);
const mastSeq = {
  duration: 1.6,
  pose(time, forward) {
    const t = ease(clamp01(time / this.duration));
    parts.mast.rotation.z = MAST_STOWED * (1 - (forward ? t : 1 - t));
  }
};

// ---------------- Buttons ----------------
const actions = [
  { id: "spider-toggle", seq: spiderSeq, labels: ["Deploy Spiders", "Reload Spiders"] },
  { id: "drone-toggle", seq: droneSeq, labels: ["Deploy Drones", "Recall Drones"] },
  { id: "mast-toggle", seq: mastSeq, labels: ["Raise Mast", "Stow Mast"] },
].map(a => ({ ...a, button: document.getElementById(a.id), active: false, playing: false, clock: 0 }));

actions.forEach(action => action.button.addEventListener("click", () => {
  if (action.playing) return;
  action.playing = true; action.clock = 0; action.button.disabled = true;
  controls.autoRotate = false;
}));

// ---------------- Model ----------------
new GLTFLoader().load("CADModels/SpiderEgg.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse(node => {
    if (!node.isMesh) return;
    const payload = node.name.startsWith("Spider") || node.name.startsWith("Drone");
    const color = payload ? PAYLOAD : HULL;
    node.material = makeMaterial(color, payload ? 0.45 : 0.3);
    node.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry, 30),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    ));
  });
  model.traverse(node => {
    const n = node.name;
    if (/^BayDoor_(Port|Starboard)$/.test(n)) parts.doors.push({ node, sign: n.endsWith("Port") ? -1 : 1 });
    if (/^DeckHatch_(Port|Starboard)$/.test(n)) parts.hatches.push({ node, sign: n.endsWith("Port") ? 1 : -1 });
    if (/^Spider_\d$/.test(n)) parts.spiders.push({ node, home: node.position.clone() });
    if (/^Drone_\d$/.test(n)) parts.drones.push({ node, home: node.position.clone(), out: 0, props: [] });
    if (n === "Mast") parts.mast = node;
  });
  parts.spiders.sort((a, b) => b.home.x - a.home.x); // release nose-first
  parts.drones.sort((a, b) => b.home.x - a.home.x);
  parts.drones.forEach(drone => drone.node.traverse(n => { if (n.name.startsWith("DroneProp")) drone.props.push(n); }));
  parts.mast.rotation.z = MAST_STOWED; // starts stowed along the hull

  model.scale.setScalar(3.2 / 5.79); // hull length → scene units, leaving room above and below
  scene.add(model);
  actions.forEach(a => { a.button.disabled = false; });
});

// ---------------- Render loop ----------------
const resize = () => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.4 ? 58 : 38; // keep the whole hull in frame on narrow screens
    camera.updateProjectionMatrix();
  }
};

let visible = true;
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(container);

let last = performance.now(), elapsed = 0;
const loop = (now) => {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!visible) return;
  elapsed += dt;

  if (parts.mast) {
    actions.forEach(action => {
      if (!action.playing) return;
      action.clock += dt;
      action.seq.pose(Math.min(action.clock, action.seq.duration), !action.active);
      if (action.clock >= action.seq.duration) {
        action.playing = false; action.active = !action.active;
        action.button.textContent = action.labels[action.active ? 1 : 0];
        action.button.disabled = false;
        if (!actions.some(a => a.playing)) controls.autoRotate = true;
      }
    });
    // Drones: fly between the bay and their hover points, bob while airborne, spin props
    parts.drones.forEach(({ node, home, out, props }, i) => {
      const bob = out * Math.sin(elapsed * 2.2 + i * 1.7) * 0.03;
      node.position.copy(home).addScaledVector(HOVER[i], out);
      node.position.y += bob;
      node.rotation.set(0, out * (0.6 - i * 0.5), out * Math.sin(elapsed * 1.3 + i) * 0.06);
      props.forEach(p => { p.rotation.y += out > 0.001 ? dt * 40 : 0; });
    });
  }

  resize();
  controls.update();
  renderer.render(scene, camera);
};
requestAnimationFrame(loop);
