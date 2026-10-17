import * as THREE from "three";

import { OrbitControls } from
  "three/addons/controls/OrbitControls.js";

import { GLTFLoader } from
  "three/addons/loaders/GLTFLoader.js";


const viewer = document.getElementById("viewer");

const jawSlider = document.getElementById("jawSlider");
const jawValue = document.getElementById("jawValue");

const closeJawsButton =
  document.getElementById("closeJawsButton");

const openJawsButton =
  document.getElementById("openJawsButton");

const otherObjectsButton =
  document.getElementById("otherObjectsButton");

const objectMenu = document.getElementById("objectMenu");
const menuArrow = document.getElementById("menuArrow");

const selectedObjectName =
  document.getElementById("selectedObjectName");

const dimensionA = document.getElementById("dimensionA");
const dimensionB = document.getElementById("dimensionB");
const dimensionC = document.getElementById("dimensionC");

const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const labelC = document.getElementById("labelC");

const updateButton = document.getElementById("updateButton");
const removeButton = document.getElementById("removeButton");
const resetButton = document.getElementById("resetButton");

const status = document.getElementById("status");

const measurement = document.getElementById("measurement");
const measurementDetails =
  document.getElementById("measurementDetails");

const measurementAnswer =
  document.getElementById("measurementAnswer");


/* ---------------------------------------
   THREE.JS SCENE
--------------------------------------- */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(
  38,
  viewer.clientWidth / viewer.clientHeight,
  0.01,
  1000
);

camera.position.set(0, 4, 10);


const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
  viewer.clientWidth,
  viewer.clientHeight
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

viewer.appendChild(renderer.domElement);


/* ---------------------------------------
   LIGHTING
--------------------------------------- */

scene.add(
  new THREE.AmbientLight(0xffffff, 2.0)
);

const mainLight = new THREE.DirectionalLight(
  0xffffff,
  3
);

mainLight.position.set(4, 7, 6);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(
  0xb8d5ff,
  1.5
);

fillLight.position.set(-5, 2, -4);
scene.add(fillLight);


/* ---------------------------------------
   CAMERA CONTROLS
--------------------------------------- */

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.07;

controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;

controls.minDistance = 2;
controls.maxDistance = 30;

controls.target.set(0, 0, 0);


/* ---------------------------------------
   MODEL VARIABLES
--------------------------------------- */

let caliper = null;
let movableJawPart = null;

let originalJawX = 0;
let modelScale = 1;

let selectedObject = null;
let selectedShape = null;

let objectBasePosition = null;

const objectMeshes = new THREE.Group();

scene.add(objectMeshes);


/*
  This is the estimated position of the measuring jaws
  in the original model's coordinate system.

  If your model's jaw tips are elsewhere, these values
  may need adjustment after checking the actual model.
*/

const JAW_POSITION = new THREE.Vector3(
  -2.65,
  0.05,
  0.85
);


/* ---------------------------------------
   LOAD VERNIER CALLIPER
--------------------------------------- */

function loadCaliper() {
  const loader = new GLTFLoader();

  loader.load(
    "./verniercaliper.glb",

    function (gltf) {
      caliper = gltf.scene;

      /*
        Hide the unwanted black circle.
      */

      caliper.traverse(function (child) {
        if (
          child.name === "Circle_4" ||
          child.name === "Object_12"
        ) {
          child.visible = false;
        }
      });

      /*
        Find the movable assembly.

        The model report identified Cube004_2 as a
        possible movable assembly. This is a manual
        movement because the model has no animations.
      */

      caliper.traverse(function (child) {
        if (child.name === "Cube004_2") {
          movableJawPart = child;
        }
      });

      /*
        Hide any black circle that may be inside
        a nested group with a different parent.
      */

      caliper.traverse(function (child) {
        if (
          child.isMesh &&
          (
            child.name === "Circle_4" ||
            child.name === "Object_12"
          )
        ) {
          child.visible = false;
        }
      });

      /*
        Calculate the model's dimensions.
      */

      caliper.updateMatrixWorld(true);

      const originalBox = new THREE.Box3()
        .setFromObject(caliper);

      const originalSize = new THREE.Vector3();

      const originalCenter = new THREE.Vector3();

      originalBox.getSize(originalSize);
      originalBox.getCenter(originalCenter);

      const largestDimension = Math.max(
        originalSize.x,
        originalSize.y,
        originalSize.z
      );

      if (largestDimension > 0) {
        modelScale = 6 / largestDimension;
      }

      /*
        Scale and center the model so it fits
        inside the viewer.
      */

      caliper.scale.setScalar(modelScale);

      caliper.position.set(
        -originalCenter.x * modelScale,
        -originalCenter.y * modelScale,
        -originalCenter.z * modelScale
      );

      scene.add(caliper);

      /*
        Save the original local position of the
        movable assembly.
      */

      if (movableJawPart) {
        originalJawX = movableJawPart.position.x;
      }

      /*
        Apply the slider's initial position.
      */

      updateJawPosition();

      /*
        Fit the camera to the complete model.
      */

      caliper.updateMatrixWorld(true);

      const fittedBox = new THREE.Box3()
        .setFromObject(caliper);

      const fittedSize = new THREE.Vector3();

      fittedBox.getSize(fittedSize);

      const fittedCenter = new THREE.Vector3();

      fittedBox.getCenter(fittedCenter);

      controls.target.copy(fittedCenter);

      camera.position.set(
        fittedCenter.x,
        fittedCenter.y + fittedSize.y * 0.8,
        fittedCenter.z + fittedSize.z * 2.5
      );

      camera.lookAt(fittedCenter);

      controls.update();

      status.textContent =
        "Vernier Calliper loaded. Add an object to begin.";

      /*
        Keep the scene empty initially.
      */

      removeSelectedObject();

      renderer.render(scene, camera);
    },

    undefined,

    function (error) {
      console.error("Model loading error:", error);

      status.textContent =
        "Could not load verniercaliper.glb. Check that the file is in the repository root.";
    }
  );
}

loadCaliper();


/* ---------------------------------------
   JAW SLIDER
--------------------------------------- */

function updateJawPosition() {
  const sliderValue = Number(jawSlider.value);

  jawValue.textContent = sliderValue + "%";

  if (!movableJawPart) {
    return;
  }

  /*
    The slider increases the opening to the right.

    A negative X movement is used here because the
    previous movement direction was reported as
    reversed.

    Increase 3.5 if the jaw needs a larger travel
    distance; decrease it if it moves too far.
  */

  const maximumTravel = 3.5;

  const openingAmount =
    (sliderValue / 100) * maximumTravel;

  movableJawPart.position.x =
    originalJawX - openingAmount;

  movableJawPart.updateMatrixWorld(true);
}


jawSlider.addEventListener(
  "input",
  updateJawPosition
);


closeJawsButton.addEventListener("click", function () {
  jawSlider.value = 0;
  updateJawPosition();
});


openJawsButton.addEventListener("click", function () {
  jawSlider.value = 100;
  updateJawPosition();
});


/* ---------------------------------------
   OBJECT MENU
--------------------------------------- */

otherObjectsButton.addEventListener("click", function () {
  objectMenu.classList.toggle("open");

  menuArrow.textContent =
    objectMenu.classList.contains("open") ? "⌃" : "⌄";
});


objectMenu.querySelectorAll("[data-shape]").forEach(
  function (button) {
    button.addEventListener("click", function () {
      const shape = button.dataset.shape;

      addObject(shape);

      objectMenu.classList.remove("open");
      menuArrow.textContent = "⌄";
    });
  }
);


/* ---------------------------------------
   SILVER MATERIAL
--------------------------------------- */

function createSilverMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    metalness: 0.75,
    roughness: 0.28
  });
}


/* ---------------------------------------
   OBJECT DIMENSIONS
--------------------------------------- */

/*
  Dimensions are entered in millimetres.

  This conversion is only a visual scale for the
  3D model. It is not a calibration of the real
  measuring scale.
*/

const MILLIMETRES_TO_MODEL_UNITS = 0.04;


function getDimensions() {
  const a = Number(dimensionA.value);
  const b = Number(dimensionB.value);
  const c = Number(dimensionC.value);

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a <= 0 ||
    b <= 0 ||
    c <= 0
  ) {
    status.textContent =
      "Enter valid positive dimensions in millimetres.";

    return null;
  }

  return { a, b, c };
}


/* ---------------------------------------
   CREATE OBJECT GEOMETRY
--------------------------------------- */

function createGeometry(shape, dimensions) {
  const a = dimensions.a * MILLIMETRES_TO_MODEL_UNITS;
  const b = dimensions.b * MILLIMETRES_TO_MODEL_UNITS;
  const c = dimensions.c * MILLIMETRES_TO_MODEL_UNITS;

  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(
        Math.max(a, b, c) / 2,
        40,
        28
      );

    case "cube":
      return new THREE.BoxGeometry(a, a, a);

    case "cuboid":
      return new THREE.BoxGeometry(a, b, c);

    case "cylinder":
      return new THREE.CylinderGeometry(
        a / 2,
        a / 2,
        c,
        40
      );

    case "cone":
      return new THREE.ConeGeometry(
        a / 2,
        c,
        40
      );

    default:
      return new THREE.SphereGeometry(
        a / 2,
        40,
        28
      );
  }
}


/* ---------------------------------------
   PLACE OBJECT NEAR THE JAWS
--------------------------------------- */

function getJawPositionInScene() {
  /*
    Convert the estimated jaw position from the
    original model coordinates to the centered,
    scaled scene coordinates.
  */

  if (!caliper) {
    return new THREE.Vector3(0, 0, 0);
  }

  const position = new THREE.Vector3(
    (JAW_POSITION.x) * modelScale,
    (JAW_POSITION.y) * modelScale,
    (JAW_POSITION.z) * modelScale
  );

  /*
    The model was centered using its original
    bounding-box center. Apply that same centering.
  */

  const box = new THREE.Box3().setFromObject(caliper);

  const center = new THREE.Vector3();

  box.getCenter(center);

  /*
    The position above is an estimate. Use the
    converted model coordinate for the object.
  */

  return position;
}


/* ---------------------------------------
   ADD OBJECT
--------------------------------------- */

function addObject(shape) {
  if (!caliper) {
    status.textContent =
      "Wait for the Vernier Calliper model to load.";

    return;
  }

  const dimensions = getDimensions();

  if (!dimensions) {
    return;
  }

  removeSelectedObject();

  selectedShape = shape;

  const geometry = createGeometry(shape, dimensions);

  const material = createSilverMaterial();

  selectedObject = new THREE.Mesh(
    geometry,
    material
  );

  selectedObject.name = shape + "Object";

  /*
    Place the object close to the measuring jaws.
    This uses the model report's estimated jaw
    coordinates, not an automatic jaw detector.
  */

  const jawPosition = getJawPositionInScene();

  selectedObject.position.copy(jawPosition);

  /*
    Slightly offset the object so it is visible
    against the metal model.
  */

  selectedObject.position.z += 0.12;

  objectMeshes.add(selectedObject);

  objectBasePosition = selectedObject.position.clone();

  selectedObjectName.textContent =
    "Selected object: " +
    shape.charAt(0).toUpperCase() +
    shape.slice(1);

  updateDimensionLabels();

  measurement.classList.remove("show");

  status.textContent =
    "Silver " + shape + " added. Adjust its dimensions if needed.";

  renderer.render(scene, camera);
}


/* ---------------------------------------
   DIMENSION LABELS
--------------------------------------- */

function updateDimensionLabels() {
  if (!selectedShape) {
    labelA.textContent = "Length (mm)";
    labelB.textContent = "Width (mm)";
    labelC.textContent = "Height (mm)";
    return;
  }

  if (selectedShape === "sphere") {
    labelA.textContent = "Diameter (mm)";
    labelB.textContent = "Not used";
    labelC.textContent = "Not used";

    dimensionB.disabled = true;
    dimensionC.disabled = true;
  } else {
    labelA.textContent = "Length / Diameter (mm)";
    labelB.textContent = "Width (mm)";
    labelC.textContent = "Height (mm)";

    dimensionB.disabled = false;
    dimensionC.disabled = false;
  }
}


/* ---------------------------------------
   UPDATE OBJECT DIMENSIONS
--------------------------------------- */

updateButton.addEventListener("click", function () {
  if (!selectedShape || !selectedObject) {
    status.textContent =
      "Choose an object first.";

    return;
  }

  const dimensions = getDimensions();

  if (!dimensions) {
    return;
  }

  selectedObject.geometry.dispose();

  selectedObject.geometry = createGeometry(
    selectedShape,
    dimensions
  );

  measurement.classList.add("show");

  measurementDetails.textContent =
    "Entered dimensions: " +
    dimensions.a + " mm × " +
    dimensions.b + " mm × " +
    dimensions.c + " mm.";

  measurementAnswer.textContent =
    dimensions.a + " mm";

  status.textContent =
    "Object dimensions updated.";
});


/* ---------------------------------------
   REMOVE OBJECT
--------------------------------------- */

function removeSelectedObject() {
  if (selectedObject) {
    objectMeshes.remove(selectedObject);

    selectedObject.geometry.dispose();

    if (Array.isArray(selectedObject.material)) {
      selectedObject.material.forEach(function (material) {
        material.dispose();
      });
    } else if (selectedObject.material) {
      selectedObject.material.dispose();
    }
  }

  selectedObject = null;
  selectedShape = null;
  objectBasePosition = null;

  selectedObjectName.textContent =
    "No object selected";

  measurement.classList.remove("show");

  dimensionA.disabled = false;
  dimensionB.disabled = false;
  dimensionC.disabled = false;

  labelA.textContent = "Length (mm)";
  labelB.textContent = "Width (mm)";
  labelC.textContent = "Height (mm)";
}


removeButton.addEventListener("click", function () {
  removeSelectedObject();

  status.textContent =
    "Object removed. Choose another object when needed.";
});


/* ---------------------------------------
   RESET
--------------------------------------- */

resetButton.addEventListener("click", function () {
  removeSelectedObject();

  dimensionA.value = 20;
  dimensionB.value = 20;
  dimensionC.value = 20;

  jawSlider.value = 0;

  updateJawPosition();

  status.textContent =
    "Reset complete. No object is selected.";
});


/* ---------------------------------------
   RESIZE VIEWER
--------------------------------------- */

function resizeViewer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  if (width <= 0 || height <= 0) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}


window.addEventListener("resize", resizeViewer);


/* ---------------------------------------
   ANIMATION LOOP
--------------------------------------- */

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();
