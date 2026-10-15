import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const viewer = document.getElementById('viewer');
const status = document.getElementById('status');
alert("JavaScript is running");
const measurement = document.getElementById('measurement');

const inputA = document.getElementById('dimensionA');
const inputB = document.getElementById('dimensionB');
const inputC = document.getElementById('dimensionC');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);

const camera = new THREE.PerspectiveCamera(
  45,
  viewer.clientWidth / viewer.clientHeight,
  0.1,
  2000
);

camera.position.set(70, 60, 100);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 800;

scene.add(new THREE.HemisphereLight(0xffffff, 0x394353, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(60, 100, 80);
scene.add(light);

const floorGrid = new THREE.GridHelper(200, 20, 0x526174, 0x27313e);
scene.add(floorGrid);

let currentObject = null;
let currentShape = 'sphere';
let isCaliper = false;

const loader = new GLTFLoader();

function showStatus(message) {
  status.textContent = message;
}

function removeCurrentObject() {
  if (!currentObject) return;

  scene.remove(currentObject);

  currentObject.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => material.dispose());
    }
  });

  currentObject = null;
}

function fitCamera(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDimension = Math.max(size.x, size.y, size.z, 1);

  controls.target.copy(center);

  camera.position.set(
    center.x + maxDimension * 1.6,
    center.y + maxDimension * 1.2,
    center.z + maxDimension * 1.8
  );

  camera.near = Math.max(maxDimension / 1000, 0.01);
  camera.far = maxDimension * 100;
  camera.updateProjectionMatrix();

  controls.minDistance = maxDimension * 0.15;
  controls.maxDistance = maxDimension * 10;

  controls.update();
}

function readDimensions() {
  const a = Number(inputA.value);
  const b = Number(inputB.value);
  const c = Number(inputC.value);

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a <= 0 || b <= 0 || c <= 0 ||
    a > 500 || b > 500 || c > 500
  ) {
    showStatus('Enter dimensions between 1 and 500 mm.');
    return null;
  }

  return { a, b, c };
}

function createShape(shape) {
  const dimensions = readDimensions();
  if (!dimensions) return;

  const { a, b, c } = dimensions;

  removeCurrentObject();

  let geometry;

  if (shape === 'sphere') {
    // Input A is the radius.
    geometry = new THREE.SphereGeometry(a, 48, 32);
  } else if (shape === 'cylinder') {
    // Input A is the radius; input B is the height.
    geometry = new THREE.CylinderGeometry(a, a, b, 48);
  } else if (shape === 'cube') {
    geometry = new THREE.BoxGeometry(a, a, a);
  } else if (shape === 'cuboid') {
    geometry = new THREE.BoxGeometry(a, b, c);
  } else if (shape === 'cone') {
    // Input A is the base radius; input B is the height.
    geometry = new THREE.ConeGeometry(a, b, 48);
  }

  if (!geometry) return;

  const material = new THREE.MeshStandardMaterial({
    color: 0xb8c6d9,
    metalness: 0.65,
    roughness: 0.3
  });

  currentObject = new THREE.Mesh(geometry, material);
  currentObject.position.set(0, 0, 0);

  scene.add(currentObject);

  currentShape = shape;
  isCaliper = false;

  fitCamera(currentObject);

  measurement.textContent =
    'Selected: ' + shape + '. Dimensions are in millimetres.';

  showStatus('3D ' + shape + ' created successfully.');
}

function loadCaliper() {
  removeCurrentObject();

  isCaliper = true;

  showStatus('Loading Vernier caliper model...');

  loader.load(
    './verniercaliper.glb',

    (gltf) => {
      if (!isCaliper) {
        gltf.scene.traverse((child) => {
          if (child.geometry) child.geometry.dispose();

          if (child.material) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((material) => material.dispose());
          }
        });

        return;
      }

      currentObject = gltf.scene;

      scene.add(currentObject);
      fitCamera(currentObject);

      measurement.textContent =
        'Vernier caliper model loaded.';

      showStatus('Caliper loaded. Drag to rotate and pinch to zoom.');
    },

    undefined,

    (error) => {
      console.error('Caliper loading error:', error);

      showStatus(
        'Could not load the caliper. Check the GLB filename and GitHub Pages.'
      );
    }
  );
}

document.querySelectorAll('[data-shape]').forEach((button) => {
  button.addEventListener('click', () => {
    createShape(button.dataset.shape);
  });
});

document.getElementById('caliperButton').addEventListener(
  'click',
  loadCaliper
);

document.getElementById('updateButton').addEventListener(
  'click',
  () => {
    if (isCaliper) {
      showStatus('Select a shape to change its dimensions.');
      return;
    }

    createShape(currentShape);
  }
);

document.getElementById('removeButton').addEventListener(
  'click',
  () => {
    removeCurrentObject();
    isCaliper = false;

    measurement.textContent = 'No object selected.';
    showStatus('Object removed.');
  }
);

document.getElementById('resetButton').addEventListener(
  'click',
  () => {
    if (currentObject) {
      fitCamera(currentObject);
    } else {
      camera.position.set(70, 60, 100);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }
);

function resizeViewer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

window.addEventListener('resize', resizeViewer);

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

animate();

createShape('sphere');
