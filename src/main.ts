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
const map1 = await Map.create('assets/Room.glb');
const map2 = await Map.create('assets/Untitled.glb');

function state_first(map: Map): GameState {
    let state = new GameState(map);
    map.addToScene(state);
    const player = new Player(state);

    state.spawnEntity(
        new DetectorEntity(state, new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(17.114, 1.5, -44), () => {player.enterLoop()} , new Set([player.body]), false)
    );

    state.spawnEntity(
        [new DetectorEntity(state, new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(42.114, 1.5, -44), () => {player.enterCheckPoint(4)}, new Set([player.body]), false),
         new DetectorEntity(state, new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(42.114, 1.5, -25.5), () => {player.enterCheckPoint(1)}, new Set([player.body]), false),
         new DetectorEntity(state, new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(23.614, 1.5, -25.5), () => {player.enterCheckPoint(2)}, new Set([player.body]), false),
         new DetectorEntity(state, new THREE.Vector3(2.5, 2.5, 2.5), new THREE.Vector3(23.614, 1.5, -44), () => {player.enterCheckPoint(3)}, new Set([player.body]), false),
        ]
    );

    state.spawnEntity(player);
    state.spawnControlable(player);

    return state;
}

function state_second(map: Map): GameState {
    let state = new GameState(map);
    map.addToScene(state);
    const player = new Player(state);
    state.spawnEntity(player);
    state.spawnControlable(player);

    state.spawnEntity(
        [new CuboidEntity(state, new THREE.Vector3(0.5, 0.5, 0.5), new THREE.Vector3(0, 1, 0)),
         new CuboidEntity(state, new THREE.Vector3(0.5, 0.5, 0.5), new THREE.Vector3(2, 1, 0)),
         new CuboidEntity(state, new THREE.Vector3(0.05, 0.1, 1.0), new THREE.Vector3(2, 1, 0)),
         new DetectorEntity(state, new THREE.Vector3(2, 2, 2), new THREE.Vector3(7, 1, -1), () => {state.controller.pointorLockControls.unlock(); curState = state_first(map1); console.log("colide")}, new Set([player.body]), true)]
    );

    return state;
}
let curState = state_second(map2);

function resize(width: number, height: number, camera: THREE.PerspectiveCamera) {
    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

resize(window.innerWidth, window.innerHeight, curState.camera);
window.addEventListener('resize', () => resize(window.innerWidth, window.innerHeight, curState.camera));


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
    timer.update(timestamp);
    const delta = timer.getDelta();
    curState.update(delta);
    curState.controller.control_callback();
    renderer.render(curState.scene, curState.camera);
    renderer.info.reset();
}
animate();
