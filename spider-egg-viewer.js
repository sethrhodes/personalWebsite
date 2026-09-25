// Spider Egg viewer: opens the lower payload bay, drops the three Spiders, then closes the bay.
import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("spider-view");
const canvas = container.querySelector("canvas");
const button = document.getElementById("spider-toggle");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
camera.position.set(2.3, 0.6, 3.1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 7;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.target.set(0, -0.25, 0);

const HULL = 0xff9bd5, SPIDER = 0xffffff;
const makeMaterial = (color, opacity) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.35, transparent: true, opacity,
  emissive: new THREE.Color(color), emissiveIntensity: 0.18,
  side: THREE.DoubleSide, depthWrite: false
});

const DOOR_OPEN = THREE.MathUtils.degToRad(105);
const DROP = 1.25; // model units (m) the Spiders fall below the hull
const parts = { doors: [], spiders: [] };

new GLTFLoader().load("CADModels/SpiderEgg.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse(node => {
    if (!node.isMesh) return;
    const spider = node.name.startsWith("Spider");
    const color = spider ? SPIDER : HULL;
    node.material = makeMaterial(color, spider ? 0.45 : 0.3);
    node.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry, 30),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    ));
  });
  model.traverse(node => {
    if (/^BayDoor_(Port|Starboard)$/.test(node.name)) parts.doors.push({ node, sign: node.name.endsWith("Port") ? -1 : 1 });
    if (/^Spider_\d$/.test(node.name)) parts.spiders.push({ node, home: node.position.clone() });
  });
  parts.spiders.sort((a, b) => b.home.x - a.home.x); // release nose-first
  // Scale by hull length so the view leaves room below for the released Spiders
  model.scale.setScalar(3.2 / 5.79);
  scene.add(model);
  button.disabled = false;
});

// Sequence timeline (seconds): doors open, Spiders drop one by one, doors close.
const T_OPEN = 1.0, T_DROP = 0.9, T_GAP = 0.35, T_CLOSE = 1.0;
const DURATION = T_OPEN + T_DROP + 2 * T_GAP + T_CLOSE;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

let deployed = false, playing = false, clock = 0;

const pose = (time, deploying) => {
  const doorT = time < T_OPEN ? ease(time / T_OPEN)
    : time > DURATION - T_CLOSE ? ease((DURATION - time) / T_CLOSE) : 1;
  parts.doors.forEach(({ node, sign }) => { node.rotation.x = sign * DOOR_OPEN * doorT; });
  parts.spiders.forEach(({ node, home }, i) => {
    let t = clamp01((time - T_OPEN - i * T_GAP) / T_DROP);
    if (!deploying) t = 1 - clamp01((time - T_OPEN - (2 - i) * T_GAP) / T_DROP);
    const fall = deploying ? t * t : ease(1 - t); // gravity-like drop, smooth reload
    const d = deploying ? fall : 1 - fall;
    node.position.set(home.x + d * 0.15, home.y - d * DROP, home.z);
    node.rotation.z = -d * 0.12;
  });
};

button.addEventListener("click", () => {
  if (playing) return;
  playing = true; clock = 0; button.disabled = true;
  controls.autoRotate = false;
});

const resize = () => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
};

let visible = true;
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(container);

let last = performance.now();
const loop = (now) => {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!visible) return;
  if (playing && parts.spiders.length) {
    clock += dt;
    pose(Math.min(clock, DURATION), !deployed);
    if (clock >= DURATION) {
      playing = false; deployed = !deployed;
      button.textContent = deployed ? "Reload Spiders" : "Deploy Spiders";
      button.disabled = false; controls.autoRotate = true;
    }
  }
  resize();
  controls.update();
  renderer.render(scene, camera);
};
requestAnimationFrame(loop);
