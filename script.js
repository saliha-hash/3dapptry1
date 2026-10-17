import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = id => document.getElementById(id);
const viewer = $("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
viewer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));

function light(power, position) {
  const lamp = new THREE.DirectionalLight(0xffffff, power);
  lamp.position.set(...position);
  scene.add(lamp);
}
light(3.5, [4, 6, 7]);
light(2.5, [-5, 3, 4]);
light(2, [0, -3, -5]);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1;
controls.maxDistance = 30;

let caliper = null;
let movableJaw = null;
let originalJawX = 0;
let selectedObject = null;
let selectedShape = null;
let modelScale = 1;

const objects = new THREE.Group();
scene.add(objects);

const silver = new THREE.MeshStandardMaterial({
  color: 0xe0e0e0,
  metalness: 0.25,
  roughness: 0.3
});

/* Load the instrument. */
new GLTFLoader().load(
  "./verniercaliper.glb",
  gltf => {
    caliper = gltf.scene;

    caliper.traverse(part => {
  const name = part.name.toLowerCase();

  if (
    name === "circle_4" ||
    name === "object_12"
  ) {
    part.visible = false;
  }

  if (name === "cube004_2") {
    movableJaw = part;
  }
});

    caliper.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(caliper);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z);

    if (!largest) {
      $("status").textContent = "Invalid caliper model dimensions.";
      return;
    }

    modelScale = 6.5 / largest;
    caliper.scale.setScalar(modelScale);
    caliper.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(caliper);
    caliper.position.sub(scaledBox.getCenter(new THREE.Vector3()));
    scene.add(caliper);
    caliper.updateMatrixWorld(true);

    if (movableJaw) originalJawX = movableJaw.position.x;

    const finalBox = new THREE.Box3().setFromObject(caliper);
    const center = finalBox.getCenter(new THREE.Vector3());
    const finalSize = finalBox.getSize(new THREE.Vector3());

    controls.target.copy(center);

const maxDimension = Math.max(
  finalSize.x,
  finalSize.y,
  finalSize.z
);

const distance =
  (maxDimension / 2) /
  Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

camera.position.set(
  center.x,
  center.y + maxDimension * 0.12,
  center.z + distance * 1.8
);

camera.lookAt(center);
camera.near = 0.01;
camera.far = 1000;
camera.updateProjectionMatrix();
controls.update();

    removeObject();
    updateJaw();
    $("status").textContent = movableJaw
      ? "Caliper loaded. Choose an object."
      : "Caliper loaded, but its moving jaw was not identified.";
  },
  undefined,
  error => {
    console.error(error);
    $("status").textContent =
      "Model failed to load. Check verniercaliper.glb filename.";
  }
);

/* Jaw control. Travel is provisional until the model is calibrated. */
function updateJaw() {
  const value = Number($("jawSlider").value);
  $("jawValue").textContent = value + "%";

  if (movableJaw) {
    movableJaw.position.x = originalJawX + value / 100 * 2;
    movableJaw.updateMatrixWorld(true);
  }
}
$("jawSlider").addEventListener("input", updateJaw);
$("closeJawsButton").onclick = () => {
  $("jawSlider").value = 0;
  updateJaw();
};
$("openJawsButton").onclick = () => {
  $("jawSlider").value = 100;
  updateJaw();
};

/* Object menu. */
$("otherObjectsButton").onclick = () => {
  const menu = $("objectMenu");
  menu.classList.toggle("open");
  $("menuArrow").textContent = menu.classList.contains("open") ? "⌃" : "⌄";
};

$("objectMenu").querySelectorAll("[data-shape]").forEach(button => {
  button.onclick = () => {
    addObject(button.dataset.shape);
    $("objectMenu").classList.remove("open");
    $("menuArrow").textContent = "⌄";
  };
});

/* Hide dimension fields that do not apply to the selected shape. */
function setFields(shape) {
  ["fieldA", "fieldB", "fieldC"].forEach(id => $(id).style.display = "block");
  ["dimensionA", "dimensionB", "dimensionC"].forEach(id => $(id).disabled = false);

  if (shape === "sphere" || shape === "cube") {
    $("labelA").textContent = shape === "sphere" ? "Diameter (mm)" : "Side (mm)";
    $("fieldB").style.display = "none";
    $("fieldC").style.display = "none";
    $("dimensionB").disabled = true;
    $("dimensionC").disabled = true;
  } else if (shape === "cylinder" || shape === "cone") {
    $("labelA").textContent = "Diameter (mm)";
    $("labelB").textContent = "Height (mm)";
    $("fieldC").style.display = "none";
    $("dimensionC").disabled = true;
  } else {
    $("labelA").textContent = "Length (mm)";
    $("labelB").textContent = "Width (mm)";
    $("labelC").textContent = "Height (mm)";
  }
}

function dimensions() {
  const d = {
    a: Number($("dimensionA").value),
    b: Number($("dimensionB").value),
    c: Number($("dimensionC").value)
  };

  const required = selectedShape === "sphere" || selectedShape === "cube"
    ? [d.a]
    : selectedShape === "cylinder" || selectedShape === "cone"
      ? [d.a, d.b]
      : [d.a, d.b, d.c];

  if (required.some(v => !Number.isFinite(v) || v <= 0 || v > 100)) {
    $("status").textContent = "Enter dimensions between 1 and 100 mm.";
    return null;
  }
  return d;
}

/* Geometry uses millimetres converted to provisional model units. */
const MM = 0.018;

function geometry(shape, d) {
  const a = d.a * MM, b = d.b * MM, c = d.c * MM;

  switch (shape) {
    case "sphere": return new THREE.SphereGeometry(a / 2, 48, 32);
    case "cube": return new THREE.BoxGeometry(a, a, a);
    case "cylinder": return new THREE.CylinderGeometry(a / 2, a / 2, b, 48);
    case "cone": return new THREE.ConeGeometry(a / 2, b, 48);
    case "cuboid": return new THREE.BoxGeometry(a, b, c);
    default: throw new Error("Unknown object shape: " + shape);
  }
}

/*
 * NOTE: this is a provisional placement, not a verified jaw-tip
 * measurement. The GLB jaw geometry must be calibrated for accuracy.
 */
function objectPosition() {
  caliper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(caliper);
  const size = box.getSize(new THREE.Vector3());

  // Temporary position near the centre of the instrument.
  return new THREE.Vector3(
    box.min.x + size.x * 0.30,
    box.min.y + size.y * 0.50,
    box.min.z + size.z * 0.50
  );
}

function addObject(shape) {
  if (!caliper) {
    $("status").textContent = "Wait for the caliper to load.";
    return;
  }

  selectedShape = shape;
  const d = dimensions();
  if (!d) return;

  removeObject(false);
  selectedShape = shape;

  selectedObject = new THREE.Mesh(geometry(shape, d), silver);
  selectedObject.name = shape + "Object";
  selectedObject.position.copy(objectPosition());
  objects.add(selectedObject);

  $("selectedObjectName").textContent =
    "Selected: " + shape[0].toUpperCase() + shape.slice(1);
  $("jawControlPanel").style.display = "none";
  $("measurement").classList.remove("show");
  setFields(shape);
  $("status").textContent = "Object added. Enter dimensions and press Update Dimensions.";
}

/* Update shape size and display entered dimensions. */
$("updateButton").onclick = () => {
  if (!selectedObject || !selectedShape) {
    $("status").textContent = "Choose an object first.";
    return;
  }

  const d = dimensions();
  if (!d) return;

  selectedObject.geometry.dispose();
  selectedObject.geometry = geometry(selectedShape, d);

  let answer;
  if (selectedShape === "sphere") answer = `${d.a} mm diameter`;
  else if (selectedShape === "cube") answer = `${d.a} mm side`;
  else if (selectedShape === "cylinder" || selectedShape === "cone") {
    answer = `${d.a} mm diameter × ${d.b} mm height`;
  } else {
    answer = `${d.a} × ${d.b} × ${d.c} mm`;
  }

  $("measurementDetails").textContent = "Entered object dimensions:";
  $("measurementAnswer").textContent = answer;
  $("measurement").classList.add("show");
  $("status").textContent = "Object dimensions updated.";
};

/* Remove current object and restore the controls. */
function removeObject(showStatus = false) {
  if (selectedObject) {
    objects.remove(selectedObject);
    selectedObject.geometry.dispose();
  }

  selectedObject = null;
  selectedShape = null;

  $("selectedObjectName").textContent = "No object selected";
  $("measurement").classList.remove("show");
  $("jawControlPanel").style.display = "block";

  ["fieldA", "fieldB", "fieldC"].forEach(id => $(id).style.display = "block");
  ["dimensionA", "dimensionB", "dimensionC"].forEach(id => $(id).disabled = false);

  $("labelA").textContent = "Diameter (mm)";
  $("labelB").textContent = "Width (mm)";
  $("labelC").textContent = "Height (mm)";

  if (showStatus) $("status").textContent = "Object removed.";
}

$("removeButton").onclick = () => removeObject(true);

$("resetButton").onclick = () => {
  removeObject();
  $("dimensionA").value = 20;
  $("dimensionB").value = 20;
  $("dimensionC").value = 20;
  $("jawSlider").value = 0;
  updateJaw();
  $("status").textContent = "Reset complete.";
};

/* Resize and render. */
function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
