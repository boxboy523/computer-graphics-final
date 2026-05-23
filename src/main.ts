import * as THREE from 'three';

import { GameState } from './state';
import { Map } from './map';
import { CuboidEntity } from './entities/cuboid';
import { Player } from './entities/player';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const timer = new THREE.Timer();
timer.connect(document);

const map = await Map.create('assets/backrooms.glb');
const state = new GameState(map);
map.addToScene(state);
const player = new Player(state);
state.spawnEntity(
    new CuboidEntity(state, new THREE.Vector3(0.5, 0.5, 0.5), new THREE.Vector3(0, 1, 0))
);
state.spawnEntity(player);
state.spawnControlable(player);
state.camera = player.camera;

function resize(width: number, height: number, camera: THREE.PerspectiveCamera) {
    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

resize(window.innerWidth, window.innerHeight, state.camera);
window.addEventListener('resize', () => resize(window.innerWidth, window.innerHeight, state.camera));

function animate(timestamp: number = 0) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const delta = timer.getDelta();
    state.update(delta);
    renderer.render(state.scene, state.camera);
}
animate();
