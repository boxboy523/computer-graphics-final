import * as THREE from 'three';

import { GameState } from './state';
import { Map } from './map';
import { CuboidEntity } from './entities/cuboid';
import { DetectorEntity } from './entities/detector';
import { Player } from './entities/player';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const timer = new THREE.Timer();
timer.connect(document);

const map = await Map.create('public/assets/Room.glb');
const state = new GameState(map);
map.addToScene(state);
const player = new Player(state);
// state.spawnEntity(
//     new CuboidEntity(state, new THREE.Vector3(0.5, 0.5, 0.5), new THREE.Vector3(0, 1, 0))
// );

function enterLoop() {
    let pos = player.body.translation();
    pos.x += 25;
    player.body.setTranslation(pos, true);
}

state.spawnEntity(
    new DetectorEntity(state, new THREE.Vector3(3, 3, 3), new THREE.Vector3(17.114, 1.5, -44), enterLoop, new Set([player.body.collider(0)]))
)

state.spawnEntity(
    [new DetectorEntity(state, new THREE.Vector3(3, 3, 3), new THREE.Vector3(42.114, 1.5, -44), () => {player.enterCheckPoint(4)}, new Set([player.body.collider(0)])),
     new DetectorEntity(state, new THREE.Vector3(3, 3, 3), new THREE.Vector3(42.114, 1.5, -25.5), () => {player.enterCheckPoint(1)}, new Set([player.body.collider(0)])),
     new DetectorEntity(state, new THREE.Vector3(3, 3, 3), new THREE.Vector3(23.614, 1.5, -25.5), () => {player.enterCheckPoint(2)}, new Set([player.body.collider(0)])),
     new DetectorEntity(state, new THREE.Vector3(3, 3, 3), new THREE.Vector3(23.614, 1.5, -44), () => {player.enterCheckPoint(3)}, new Set([player.body.collider(0)])),
    ]
)

state.spawnEntity(player);
state.spawnControlable(player);

function resize(width: number, height: number, camera: THREE.PerspectiveCamera) {
    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

resize(window.innerWidth, window.innerHeight, state.camera);
window.addEventListener('resize', () => resize(window.innerWidth, window.innerHeight, state.camera));

import Stats from 'three/examples/jsm/libs/stats.module.js';
const stats = new Stats();
document.body.appendChild(stats.dom);

function createCrosshair() {
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';

    crosshair.style.position = 'fixed';
    crosshair.style.left = '50%';
    crosshair.style.top = '50%';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '9999';

    const horizontal = document.createElement('div');
    horizontal.style.position = 'absolute';
    horizontal.style.left = '0';
    horizontal.style.top = '9px';
    horizontal.style.width = '20px';
    horizontal.style.height = '2px';
    horizontal.style.background = 'white';
    horizontal.style.opacity = '0.8';

    const vertical = document.createElement('div');
    vertical.style.position = 'absolute';
    vertical.style.left = '9px';
    vertical.style.top = '0';
    vertical.style.width = '2px';
    vertical.style.height = '20px';
    vertical.style.background = 'white';
    vertical.style.opacity = '0.8';

    crosshair.appendChild(horizontal);
    crosshair.appendChild(vertical);

    document.body.appendChild(crosshair);
}

createCrosshair();

function animate(timestamp: number = 0) {
    requestAnimationFrame(animate);
    stats.update();
    timer.update(timestamp);
    const delta = timer.getDelta();
    state.update(delta);
    state.controller.control_callback();
    renderer.render(state.scene, state.camera);
    renderer.info.reset();
}
animate();
