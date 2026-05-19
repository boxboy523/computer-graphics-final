import * as Th from 'three';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;
const renderer = new Th.WebGLRenderer({ canvas });
const scene = new Th.Scene();
const camera = new Th.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const geometry = new Th.BoxGeometry();
const material = new Th.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Th.Mesh(geometry, material);
scene.add(cube);

function resize(width: number, height: number) {
    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => resize(window.innerWidth, window.innerHeight));

camera.position.z = 5;

function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();
