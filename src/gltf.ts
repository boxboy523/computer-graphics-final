import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadGLTF(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}
