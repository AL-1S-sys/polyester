import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// QR Code Checkpoint Registry
const checkpoints = {
  'L1_ENTRANCE': { name: 'Layer 1 Main Lobby', layer: 1, x: -6, z: 3 },
  'CAFETERIA':   { name: 'Ground Floor Cafeteria', layer: 1, x: -4, z: 0 },
  'LIBRARY':     { name: 'Library Lower Floor', layer: 2, x: 0, z: 0 },
  'STUDENT_L3':  { name: 'Student Lounge (Floor 3)', layer: 3, x: 3, z: 0 }
};

const urlParams = new URLSearchParams(window.location.search);
const cpParam = urlParams.get('cp') || 'L1_ENTRANCE';
const currentSpot = checkpoints[cpParam] || checkpoints['L1_ENTRANCE'];

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f6f8);

const width = window.innerWidth || 300;
const height = window.innerHeight || 300;

const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);

// Wide Overview Position Targets
const wideCamPos = new THREE.Vector3(45, 55, 60);
const wideTarget = new THREE.Vector3(0, 6, 0);

camera.position.copy(wideCamPos);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lock touch gestures to the canvas for iOS/Android desuwa
renderer.domElement.style.touchAction = 'none';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(wideTarget);

const targetCamPos = new THREE.Vector3().copy(wideCamPos);
const targetLookAt = new THREE.Vector3().copy(wideTarget);

let activeIsolatedLayer = 'all';

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// POIs Metadata
const poiData3D = [
  { id: 'cafeteria', name: 'Cafeteria', layer: 1, x: -4, z: 0, w: 5, d: 6, color: 0x81c784, desc: 'Offers a variety of meals, snacks, and beverages for students and faculty.', hours: '7:00 AM - 5:00 PM', status: 'Open' },
  { id: 'lounge1', name: 'Student Lounge 1', layer: 1, x: 4, z: 0, w: 5, d: 6, color: 0xaed581, desc: 'A comfortable open space for quick study sessions and group discussions.', hours: '24/7 Access', status: 'Open' },
  { id: 'lib_lower', name: 'Library Lower Floor', layer: 2, x: 0, z: 0, w: 12, d: 6, color: 0x64b5f6, desc: 'Main book stacks, quiet reading zones, and circulation desk.', hours: '8:00 AM - 6:00 PM', status: 'Open' },
  { id: 'lib_upper', name: 'Library Upper Floor', layer: 3, x: -3, z: 0, w: 5, d: 6, color: 0x4dd0e1, desc: 'Computer labs, multimedia rooms, and private study carrels.', hours: '8:00 AM - 5:00 PM', status: 'Open' },
  { id: 'lounge2', name: 'Student Lounge 2', layer: 3, x: 3, z: 0, w: 5, d: 6, color: 0xaed581, desc: 'Relaxation area equipped with charging stations.', hours: '7:00 AM - 7:00 PM', status: 'Open' },
  { id: 'lounge3', name: 'Student Lounge 3', layer: 4, x: 0, z: 0, w: 8, d: 6, color: 0xaed581, desc: 'Top floor recreational area with panoramic campus views.', hours: '8:00 AM - 5:00 PM', status: 'Open' }
];

const floorMeshes = {};
const selectableSlabs = [];
const selectableRooms = [];
const spacing = 4.5;

// DOM Elements
const infoPanel = document.getElementById('info-panel');
const layerDisplay = document.getElementById('layer-display');
const overlay = document.getElementById('instructions-overlay');

// Build Floors and Rooms
for (let i = 1; i <= 4; i++) {
  const floorGroup = new THREE.Group();
  const floorY = (i - 1) * spacing;
  floorGroup.position.y = floorY;

  // Floor Slab
  const slabGeo = new THREE.BoxGeometry(16, 0.3, 10);
  const slabMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 });
  const slabMesh = new THREE.Mesh(slabGeo, slabMat);
  slabMesh.userData = { type: 'slab', layerNumber: i, floorY: floorY };
  
  floorGroup.add(slabMesh);
  selectableSlabs.push(slabMesh);

  // Room POIs
  poiData3D.filter(p => p.layer === i).forEach(poi => {
    const boxGeo = new THREE.BoxGeometry(poi.w, 1.2, poi.d);
    const boxMat = new THREE.MeshPhongMaterial({ color: poi.color });
    const roomMesh = new THREE.Mesh(boxGeo, boxMat);
    roomMesh.position.set(poi.x, 0.75, poi.z);
    roomMesh.userData = { type: 'room', layerNumber: i, data: poi, floorY: floorY };
    
    floorGroup.add(roomMesh);
    selectableRooms.push(roomMesh);
  });

  floorGroup.visible = true;
  floorMeshes[i] = floorGroup;
  scene.add(floorGroup);
}

// 3D Pin
const pinGeo = new THREE.ConeGeometry(0.6, 1.5, 8);
const pinMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const userPin = new THREE.Mesh(pinGeo, pinMat);
userPin.rotation.x = Math.PI;

const initialY = (currentSpot.layer - 1) * spacing;
userPin.position.set(currentSpot.x, initialY + 2, currentSpot.z);
scene.add(userPin);

const locationDisplay = document.getElementById('location-display');
if (locationDisplay) locationDisplay.innerHTML = `📍 ${currentSpot.name}`;

// Dismiss Overlay Action
const closeBtn = document.getElementById('close-instructions');
if (closeBtn) {
  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (overlay) overlay.classList.add('hidden');

    activeIsolatedLayer = 'all';

    Object.keys(floorMeshes).forEach(key => {
      floorMeshes[key].visible = true;
    });

    if (userPin) userPin.visible = true;
    if (layerDisplay) layerDisplay.innerHTML = '🏢 Viewing: All Floors';

    targetCamPos.set(25, 35, 40);
    targetLookAt.set(0, 6, 0);
  });
}

// Interaction Handling
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  if (!overlay || event.target.closest('#info-panel') || event.target.closest('#ui-container') || !overlay.classList.contains('hidden')) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const visibleTargets = [...selectableRooms, ...selectableSlabs].filter(m => m.parent.visible);
  const intersects = raycaster.intersectObjects(visibleTargets);

  if (intersects.length > 0) {
    const hit = intersects[0].object;

    if (activeIsolatedLayer === 'all') {
      const targetLayer = hit.userData.layerNumber;
      const floorY = hit.userData.floorY;
      isolateAndZoomFloor(targetLayer, floorY);

    } else {
      if (hit.userData.type === 'room') {
        showRoomDetails(hit.userData.data);
      } else if (hit.userData.type === 'slab') {
        isolateAndZoomFloor('all', 0);
      }
    }
  } else {
    if (infoPanel) infoPanel.classList.remove('active');
  }
});

// Show Room Details
function showRoomDetails(room) {
  const rn = document.getElementById('room-name');
  const rlt = document.getElementById('room-layer-tag');
  const rd = document.getElementById('room-desc');
  const rh = document.getElementById('room-hours');
  const rs = document.getElementById('room-status');

  if (rn) rn.innerText = room.name;
  if (rlt) rlt.innerText = `Floor Layer ${room.layer}`;
  if (rd) rd.innerText = room.desc;
  if (rh) rh.innerText = room.hours;
  if (rs) rs.innerText = room.status;

  if (infoPanel) infoPanel.classList.add('active');
}

// Floor Isolation Logic
function isolateAndZoomFloor(selectedLayer, floorY) {
  activeIsolatedLayer = selectedLayer;
  if (infoPanel) infoPanel.classList.remove('active');

  if (layerDisplay) {
    if (selectedLayer === 'all') {
      layerDisplay.innerHTML = '🏢 Viewing: All Floors';
    } else {
      layerDisplay.innerHTML = `🏢 Viewing: Floor Layer ${selectedLayer}`;
    }
  }

  Object.keys(floorMeshes).forEach(key => {
    const layerNum = parseInt(key);
    floorMeshes[layerNum].visible = (selectedLayer === 'all' || selectedLayer === layerNum);
  });

  if (selectedLayer === 'all' || selectedLayer === currentSpot.layer) {
    if (userPin) userPin.visible = true;
  } else {
    if (userPin) userPin.visible = false;
  }

  if (selectedLayer === 'all') {
    targetCamPos.set(25, 35, 40);
    targetLookAt.copy(wideTarget);
  } else {
    targetLookAt.set(0, floorY + 0.5, 0);
    targetCamPos.set(0, floorY + 20, 30);
  }
}

// Render Loop
function animate() {
  requestAnimationFrame(animate);

  camera.position.lerp(targetCamPos, 0.05);
  controls.target.lerp(targetLookAt, 0.05);

  if (userPin && userPin.visible) userPin.rotation.y += 0.03;
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Responsive Resize Listener
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});