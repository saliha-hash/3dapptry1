import * as THREE from "three";

import { OrbitControls } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";

import { GLTFLoader } from
  "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";

const viewer = document.getElementById("viewer");
const statusText = document.getElementById("status");
const measurement = document.getElementById("measurement");

const dimensionA = document.getElementById("dimensionA");
const dimensionB = document.getElementById("dimensionB");
const dimensionC = document.getElementById("dimensionC");

const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const labelC = document.getElementById("labelC");

const otherObjectsButton =
  document.getElementById("otherObjectsButton");
const objectMenu = document.getElementById("objectMenu");
const menuArrow = document.getElementById("menuArrow");
const selectedObjectName =
  document.getElementById("selectedObjectName");

const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 1.2, 9);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;
controls.minDistance = 0.5;
controls.maxDistance = 30;
controls.zoomToCursor = true;

scene.add(new THREE.AmbientLight(0xffffff, 2.2));

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(4, 6, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbac8ff, 1.4);
fillLight.position.set(-5, 2, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
rimLight.position.set(0, -3, 5);
scene.add(rimLight);

let caliper = null;
let jawMixer = null;
let jawAction = null;
let jawClip = null;
let jawSlider = null;
let jawHint = null;

let selectedShape = "sphere";
let selectedObject = null;

const objectGroup = new THREE.Group();
scene.add(objectGroup);

const shapeNames = {
  sphere: "Sphere",
  cube: "Cube",
  cylinder: "Cylinder",
  cuboid: "Cuboid",
  cone: "Cone"
};

const MILLIMETRES_TO_SCENE_UNITS = 0.035;

// Estimated position only; exact jaw coordinates still need calibration.
const OBJECT_POSITION = new THREE.Vector3(-1.0, 0.15, 0.25);

function setStatus(message) {
  statusText.textContent = message;
}

function readDimension(input, fallback = 20) {
  const value = Number(input.value);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, 200);
}

function disposeObject(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => material.dispose());
    }
  });
}

function setJawSliderVisibility() {
  const panel = document.getElementById("jawControlPanel");

  if (panel) {
    panel.style.display = selectedObject ? "none" : "block";
  }
}

function setDimensionLabels(shape) {
  labelA.textContent = "Diameter (mm)";
  labelB.textContent = "Height (mm)";
  labelC.textContent = "Depth (mm)";

  dimensionA.disabled = false;
  dimensionB.disabled = false;
  dimensionC.disabled = false;

  if (shape === "cube") {
    labelA.textContent = "Side (mm)";
  } else if (shape === "cuboid") {
    labelA.textContent = "Width (mm)";
  }
}

function makeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc8cdd2,
    metalness: 0.72,
    roughness: 0.24
  });
}

function makeGeometry(shape, a, b, c) {
  const A = a * MILLIMETRES_TO_SCENE_UNITS;
  const B = b * MILLIMETRES_TO_SCENE_UNITS;
  const C = c * MILLIMETRES_TO_SCENE_UNITS;

  if (shape === "sphere") {
    return new THREE.SphereGeometry(A / 2, 48, 32);
  }

  if (shape === "cube") {
    return new THREE.BoxGeometry(A, A, A);
  }

  if (shape === "cylinder") {
    return new THREE.CylinderGeometry(A / 2, A / 2, B, 48);
  }

  if (shape === "cuboid") {
    return new THREE.BoxGeometry(A, B, C);
  }

  if (shape === "cone") {
    return new THREE.ConeGeometry(A / 2, B, 48);
  }

  return new THREE.SphereGeometry(A / 2, 48, 32);
}

function positionObjectInJaws() {
  if (!selectedObject) return;

  // This is an estimated location, not a calibrated jaw-gap measurement.
  selectedObject.position.copy(OBJECT_POSITION);
  selectedObject.updateMatrixWorld(true);
}

function addObject(shape) {
  selectedShape = shape;

  if (selectedObject) {
    objectGroup.remove(selectedObject);
    disposeObject(selectedObject);
    selectedObject = null;
  }

  setDimensionLabels(shape);

  dimensionA.value =
    shape === "cylinder" || shape === "cone" ? 15 : 20;

  dimensionB.value =
    shape === "cylinder" || shape === "cone" ? 25 : 20;

  dimensionC.value = 20;

  selectedObjectName.textContent =
    "Other Objects — " + shapeNames[shape];

  selectedObject = new THREE.Mesh(
    makeGeometry(
      shape,
      readDimension(dimensionA),
      readDimension(dimensionB),
      readDimension(dimensionC)
    ),
    makeMaterial()
  );

  positionObjectInJaws();
  objectGroup.add(selectedObject);

  setJawSliderVisibility();
  updateMeasurement();
}

function updateObjectSize() {
  if (!selectedObject) {
    measurement.textContent = "Select an object first.";
    return;
  }

  selectedObject.geometry.dispose();

  selectedObject.geometry = makeGeometry(
    selectedShape,
    readDimension(dimensionA),
    readDimension(dimensionB),
    readDimension(dimensionC)
  );

  positionObjectInJaws();
  updateMeasurement();
}

function updateMeasurement() {
  if (!selectedObject) return;

  const a = readDimension(dimensionA);
  const b = readDimension(dimensionB);
  const c = readDimension(dimensionC);

  let details = "";

  if (selectedShape === "sphere") {
    details = `Diameter: ${a} mm`;
  } else if (selectedShape === "cube") {
    details = `Side length: ${a} mm`;
  } else if (selectedShape === "cylinder") {
    details = `Diameter: ${a} mm<br>Height: ${b} mm`;
  } else if (selectedShape === "cuboid") {
    details = `Width: ${a} mm<br>Height: ${b} mm<br>Depth: ${c} mm`;
  } else if (selectedShape === "cone") {
    details = `Base diameter: ${a} mm<br>Height: ${b} mm`;
  }

  measurement.innerHTML =
    `<strong>${shapeNames[selectedShape]}</strong><br>` +
    `${details}<br><br>` +
    `<span style="color:#aaa">Entered dimensions are not a live caliper reading.</span>`;
}

function frameCaliper(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maxDimension) || maxDimension === 0) {
    throw new Error("The model has no measurable geometry.");
  }

  model.position.sub(center);
  model.scale.multiplyScalar(6.5 / maxDimension);
  model.updateMatrixWorld(true);

  const newBounds = new THREE.Box3().setFromObject(model);
  model.position.sub(newBounds.getCenter(new THREE.Vector3()));

  controls.target.set(0, 0, 0);
  camera.position.set(0, 1.2, 9);
  controls.update();
}

function makeJawSlider() {
  const oldPanel = document.getElementById("jawControlPanel");
  if (oldPanel) oldPanel.remove();

  const panel = document.createElement("div");
  panel.id = "jawControlPanel";
  panel.style.cssText = `
    position:relative;
    width:100%;
    box-sizing:border-box;
    margin:12px 0;
    padding:12px;
    background:#0f141e;
    border:1px solid #64748b;
    border-radius:12px;
    color:white;
    font:14px Arial,sans-serif;
  `;

  const label = document.createElement("label");
  label.textContent = "Jaw movement";
  label.style.display = "block";
  label.style.marginBottom = "8px";

  jawSlider = document.createElement("input");
  jawSlider.type = "range";
  jawSlider.min = "0";
  jawSlider.max = "100";
  jawSlider.step = "1";
  jawSlider.value = "0";
  jawSlider.style.width = "100%";

  jawHint = document.createElement("div");
  jawHint.textContent = "Drag to open or close the jaws.";
  jawHint.style.marginTop = "6px";
  jawHint.style.color = "#cbd5e1";

  panel.append(label, jawSlider, jawHint);

  // Insert below the viewer, outside the 3D caliper box.
  viewer.insertAdjacentElement("afterend", panel);

  jawSlider.addEventListener("input", () => {
    if (!jawMixer || !jawAction || !jawClip) {
      jawHint.textContent = "No animation is available.";
      return;
    }

    const progress = Number(jawSlider.value) / 100;

    jawAction.paused = false;
    jawAction.time = progress * jawClip.duration;
    jawMixer.update(0);
    jawAction.paused = true;

    jawHint.textContent =
      progress === 1
        ? "End of model animation"
        : `Jaw movement: ${jawSlider.value}%`;
  });

  setJawSliderVisibility();
}

function loadCaliper() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    (gltf) => {
      caliper = gltf.scene;

      caliper.traverse((child) => {
        if (!child.isMesh) return;

        child.frustumCulled = false;

        if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });

      frameCaliper(caliper);
      scene.add(caliper);

      if (gltf.animations && gltf.animations.length > 0) {
        jawClip = gltf.animations[0];
        jawMixer = new THREE.AnimationMixer(caliper);
        jawAction = jawMixer.clipAction(jawClip);

        jawAction.setLoop(THREE.LoopOnce, 1);
        jawAction.clampWhenFinished = true;
        jawAction.play();
        jawAction.paused = true;
        jawAction.time = 0;
        jawMixer.update(0);
      }

      makeJawSlider();
      addObject("sphere");

      setStatus("Caliper loaded. Use the slider to move the jaws.");
    },

    undefined,

    (error) => {
      console.error("Caliper model loading failed:", error);
      setStatus("Caliper failed to load. Check the model file and refresh.");
    }
  );
}

otherObjectsButton.addEventListener("click", () => {
  const isOpen = objectMenu.classList.toggle("open");

  otherObjectsButton.setAttribute("aria-expanded", String(isOpen));
  menuArrow.textContent = isOpen ? "⌃" : "⌄";
});

document.querySelectorAll(".object-option").forEach((button) => {
  button.addEventListener("click", () => {
    addObject(button.dataset.shape);

    objectMenu.classList.remove("open");
    otherObjectsButton.setAttribute("aria-expanded", "false");
    menuArrow.textContent = "⌄";
  });
});

updateButton.addEventListener("click", updateObjectSize);

removeButton.addEventListener("click", () => {
  if (selectedObject) {
    objectGroup.remove(selectedObject);
    disposeObject(selectedObject);
    selectedObject = null;
  }

  measurement.textContent = "Object removed.";
  setJawSliderVisibility();
});

resetButton.addEventListener("click", () => {
  camera.position.set(0, 1.2, 9);
  controls.target.set(0, 0, 0);
  controls.update();

  setStatus(caliper ? "View reset." : "Waiting for caliper model.");
});

window.addEventListener("resize", () => {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadCaliper();
animate();
