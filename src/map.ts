import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import { GameState } from './state';
import { loadGLTF } from './gltf';


export class Map {
    path!: string;
    model!: THREE.Group;
    colliderDescs: RAPIER.ColliderDesc[] = [];
    private constructor() {}

    private async load(path: string) {
        this.path = path;
        let gltf = await loadGLTF(path);
        this.model = gltf.scene;;
        this.model.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;

            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            const vertices = new Float32Array(geo.attributes.position.array);
            const indices = new Uint32Array(geo.index!.array);
            this.colliderDescs.push(RAPIER.ColliderDesc.trimesh(vertices, indices));
            const oldMat = child.material;
            const emissive = oldMat.emissive;
            const isEmissive = emissive.r > 0 || emissive.g > 0 || emissive.b > 0;

            child.material = isEmissive
                ? new THREE.MeshBasicMaterial({ color: emissive.clone(), map: oldMat.emissiveMap, side: THREE.DoubleSide })
                : new THREE.MeshLambertMaterial({ color: oldMat.color.clone(), map: oldMat.map, side: THREE.DoubleSide });
        });
    }

    static async create(path: string): Promise<Map> {
        const map = new Map();
        await map.load(path);
        return map;
    }

    addToScene(state: GameState) {
        state.scene.add(this.model);
        const body = state.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        for (const desc of this.colliderDescs) {
            state.world.createCollider(desc, body);
        }
    }
}
