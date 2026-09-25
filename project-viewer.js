// Interactive model viewer for project pages.
// Usage: <div class="model-view" data-src="CADModels/X.glb" data-rot="-90,0,0" data-accent="#7ce8ff"><canvas></canvas></div>
import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

const makeMaterial = (color) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: 0.35,
  transparent: true,
  opacity: 0.4,
  emissive: new THREE.Color(color),
  emissiveIntensity: 0.18,
  side: THREE.DoubleSide,
  depthWrite: false
});

const styleModel = (object, color) => {
  object.traverse(node => {
    if (!node.isMesh) return;
    node.material = makeMaterial(color);
    node.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry, 30),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    ));
  });
};

const parseRotation = (value) => {
  const [x = 0, y = 0, z = 0] = (value || "").split(",").map(v => (parseFloat(v) || 0) * Math.PI / 180);
  return new THREE.Euler(x, y, z);
};

const initViewer = (container) => {
  const canvas = container.querySelector("canvas");
  const color = new THREE.Color(container.dataset.accent || "#ffffff");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  camera.position.set(2.4, 1.4, 2.8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 7;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;

  const onLoad = (object) => {
    styleModel(object, color);
    const pivot = new THREE.Group();
    object.rotation.copy(parseRotation(container.dataset.rot));
    pivot.add(object);
    const box = new THREE.Box3().setFromObject(pivot);
    const size = box.getSize(new THREE.Vector3());
    object.scale.setScalar(parseFloat(container.dataset.size || "2.2") / Math.max(size.x, size.y, size.z));
    box.setFromObject(pivot);
    object.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(pivot);
    container.classList.add("loaded");
  };

  loader.load(container.dataset.src, (gltf) => onLoad(gltf.scene));

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(container);

  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
};

document.querySelectorAll(".model-view[data-src]").forEach(initViewer);
