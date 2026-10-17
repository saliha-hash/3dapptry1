import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL="./verniercaliper.glb";
const MM_PER_UNIT=31.27;
const ZERO_X=-1.1227;
const FACE_X=-1.521;
const FACE_Z=0.366;
const ROOT_Y=-0.17;
const TRAVEL=3.47;
const MOVING=["cube004_2","cylinder_3"];
const HIDE=["circle_4","cylinder001_5"];
const $=id=>document.getElementById(id);
const say=t=>{$("status").textContent=t};
const viewer=$("viewer");

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x000000);

const camera=new THREE.PerspectiveCamera(30,1,0.01,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.setClearColor(0x000000,1);
renderer.domElement.style.display="block";
viewer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd5dce5,0x17191d,1.15));

function light(color,intensity,x,y,z){
  const l=new THREE.DirectionalLight(color,intensity);
  l.position.set(x,y,z);
  scene.add(l);
}

light(0xffffff,2.4,3,5,6);
light(0xc3d0e0,1.1,-4,2,3);
light(0xffffff,1.8,0,4,-5);
light(0x8293a8,0.65,5,-2,-3);

const pmrem=new THREE.PMREMGenerator(renderer);
const environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
scene.environment=environment;
pmrem.dispose();

const silver=new THREE.MeshStandardMaterial({
  color:0xaeb7c1,
  metalness:0.88,
  roughness:0.27,
  envMapIntensity:1.25
});

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.075;
controls.zoomToCursor=true;
controls.screenSpacePanning=true;
controls.minDistance=0.3;
controls.maxDistance=30;
controls.touches={
  ONE:THREE.TOUCH.ROTATE,
  TWO:THREE.TOUCH.DOLLY_PAN
};

let moved=false;
controls.addEventListener("start",()=>{moved=true});

let rig=null,slider=null,ready=false;
let W=6,H=2.5,fly=null,shape=null,obj=null;

new GLTFLoader().load(
  MODEL,
  gltf=>{
    try{setup(gltf.scene)}
    catch(e){
      console.error(e);
      say("Model setup problem: "+e.message);
    }
  },
  undefined,
  e=>{
    console.error(e);
    say("Model failed to load. Check verniercaliper.glb.");
  }
);

function setup(model){
  rig=new THREE.Group();
  rig.add(model);
  scene.add(rig);
  rig.updateMatrixWorld(true);

  const parts=[];

  model.traverse(o=>{
    if(!o.name)return;
    const n=o.name.toLowerCase();

    if(HIDE.includes(n)){
      o.visible=false;
      return;
    }

    if(MOVING.includes(n))parts.push(o);

    if(o.isMesh){
      o.frustumCulled=false;

      if(o.material){
        const mats=Array.isArray(o.material)?o.material:[o.material];

        mats.forEach(m=>{
          m.side=THREE.DoubleSide;

          if(m.map){
            m.map.colorSpace=THREE.SRGBColorSpace;
            m.map.needsUpdate=true;
          }

          m.needsUpdate=true;
        });
      }
    }
  });

  if(parts.length<MOVING.length){
    throw new Error("Moving jaw parts not found. Check the GLB mesh names.");
  }

  // Preserve the original Sketchfab ruler texture.
  // No UV remapping is applied, preventing changes to its markings.

  slider=new THREE.Group();
  rig.add(slider);
  parts.forEach(o=>slider.attach(o));

  const fit=new THREE.Box3();

  model.traverse(o=>{
    if(!o.isMesh)return;

    for(let p=o;p;p=p.parent){
      if(!p.visible)return;
    }

    fit.union(new THREE.Box3().setFromObject(o));
  });

  if(fit.isEmpty()){
    throw new Error("The model contains no visible meshes.");
  }

  const size=fit.getSize(new THREE.Vector3());
  W=size.x;
  H=size.y;

  rig.position.copy(fit.getCenter(new THREE.Vector3())).negate();
  rig.updateMatrixWorld(true);

  ready=true;
  viewFull(true);
  say("Caliper ready. Use Zoom on Jaws or select an object.");
}

function dist(span){
  return span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
}

function go(pos,tgt,instant=false){
  if(instant){
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
    fly=null;
  }else{
    fly={
      t0:performance.now(),
      p0:camera.position.clone(),
      q0:controls.target.clone(),
      p1:pos.clone(),
      q1:tgt.clone()
    };
  }
}

function viewFull(instant=false){
  if(!ready)return;

  const span=Math.max(W/camera.aspect,H)*1.12;

  go(
    new THREE.Vector3(0,0,dist(span)+0.15),
    new THREE.Vector3(0,0,0),
    instant
  );
}

function viewJaws(){
  if(!ready)return;

  const gap=slider.position.x;

  const c=rig.localToWorld(
    new THREE.Vector3(FACE_X+gap/2,-0.55,FACE_Z)
  );

  const d=dist(Math.max(1.6,(gap+0.65)/camera.aspect));

  go(new THREE.Vector3(c.x,c.y+0.08,c.z+d),c);
}

$("fitButton").onclick=()=>viewFull();
$("jawsButton").onclick=viewJaws;

$("jawSlider").addEventListener("input",()=>{
  const val=Number($("jawSlider").value);
  $("jawValue").textContent=val+"%";

  if(ready&&!obj){
    slider.position.x=(val/100)*TRAVEL;
  }
});

const SHAPES={
  sphere:{
    f:["Diameter"],
    max:60,
    geo:a=>new THREE.SphereGeometry(a/2,64,48),
    h:a=>a
  },
  cube:{
    f:["Side"],
    max:100,
    geo:a=>new THREE.BoxGeometry(a,a,a),
    h:a=>a
  },
  cylinder:{
    f:["Diameter","Height"],
    max:100,
    geo:(a,b)=>new THREE.CylinderGeometry(a/2,a/2,b,64),
    h:(a,b)=>b
  },
  cuboid:{
    f:["Length","Width","Height"],
    max:100,
    geo:(a,b,c)=>new THREE.BoxGeometry(a,c,b),
    h:(a,b,c)=>c
  },
  cone:{
    f:["Base diameter","Height"],
    max:100,
    geo:(a,b)=>new THREE.ConeGeometry(a/2,b,64),
    h:(a,b)=>b
  }
};

function readDims(){
  const sh=SHAPES[shape];
  const d=sh.f.map((_,i)=>parseFloat($("dim"+"ABC"[i]).value));

  const limit=Math.min(sh.max,Math.floor(TRAVEL*MM_PER_UNIT));

  if(d.some(x=>!Number.isFinite(x)||x<1||x>sh.max)){
    say("Enter sizes between 1 and "+sh.max+" mm.");
    return null;
  }

  if(d[0]>limit){
    say("The jaws open to "+limit+" mm at most. Reduce the first size.");
    return null;
  }

  return d;
}

function place(){
  if(!obj||!shape)return;

  const d=readDims();
  if(!d)return;

  const sh=SHAPES[shape];
  const u=1/MM_PER_UNIT;
  const v=d.map(x=>x*u);

  obj.geometry.dispose();
  obj.geometry=sh.geo(...v);

  slider.position.x=v[0];

  const h=sh.h(...v);
  const top=shape==="cone"?ROOT_Y-0.05:ROOT_Y;

  let y=top-h/2;

  if(shape==="sphere"){
    y=Math.max(y,-1.05);
  }

  obj.rotation.set(0,0,shape==="cone"?Math.PI:0);

  obj.position.set(
    FACE_X+v[0]/2,
    y,
    FACE_Z
  );

  $("measurementAnswer").textContent=
    sh.f.map((n,i)=>n+": "+d[i]+" mm").join(", ");

  say("Object placed between the jaws. Size: "+d[0]+" mm.");
}

function selectShape(s){
  if(!ready){
    say("Wait for the caliper to load.");
    return;
  }

  shape=s;

  if(!obj){
    obj=new THREE.Mesh(new THREE.BufferGeometry(),silver);
    obj.material=silver;
    rig.add(obj);
  }

  document.querySelectorAll("[data-shape]").forEach(b=>{
    b.classList.toggle("active",b.dataset.shape===s);
  });

  "ABC".split("").forEach((k,i)=>{
    const on=i<SHAPES[s].f.length;

    $("field"+k).hidden=!on;

    if(on){
      $("label"+k).textContent=SHAPES[s].f[i]+" (mm)";
    }
  });

  $("objectPanel").hidden=false;
  $("jawControlPanel").hidden=true;

  place();
}

function removeObject(){
  if(!obj)return;

  rig.remove(obj);
  obj.geometry.dispose();
  obj=null;
  shape=null;

  document.querySelectorAll("[data-shape]").forEach(b=>{
    b.classList.remove("active");
  });

  $("objectPanel").hidden=true;
  $("jawControlPanel").hidden=false;

  slider.position.x=Math.min(TRAVEL,Math.max(0,slider.position.x));

  const pct=Math.round(slider.position.x/TRAVEL*100);

  $("jawSlider").value=pct;
  $("jawValue").textContent=pct+"%";

  say("Object removed. Move the jaws freely.");
}

document.querySelectorAll("[data-shape]").forEach(b=>{
  b.onclick=()=>selectShape(b.dataset.shape);
});

["dimA","dimB","dimC"].forEach(id=>{
  $(id).addEventListener("input",place);
});

$("removeButton").onclick=removeObject;

new ResizeObserver(()=>{
  const w=viewer.clientWidth;
  const h=viewer.clientHeight;

  if(!w||!h)return;

  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);

  if(ready&&!moved){
    viewFull(true);
  }
}).observe(viewer);

function animate(now){
  requestAnimationFrame(animate);

  if(fly){
    const k=Math.min(1,(now-fly.t0)/450);
    const e=k*k*(3-2*k);

    camera.position.lerpVectors(fly.p0,fly.p1,e);
    controls.target.lerpVectors(fly.q0,fly.q1,e);

    if(k===1)fly=null;
  }

  controls.update();
  renderer.render(scene,camera);
}

requestAnimationFrame(animate);
