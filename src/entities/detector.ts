import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';

export class DetectorEntity implements Entity {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    state: GameState;

    size: THREE.Vector3;
    detect_callback: (() => void) | null = null;
    to_detect: Set<RAPIER.Collider> = new Set();

    constructor(
        state: GameState,
        size: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
        callback: (() => void) | null = null,
        to_detect: Set<RAPIER.Collider> = new Set(),
        material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    ) {
        this.size = size.clone();
        this.detect_callback = callback;
        this.to_detect = to_detect;
        this.state = state;

        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.visible = false;
        state.scene.add(this.mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed();

         this.body = state.world.createRigidBody(
            bodyDesc.setTranslation(position.x, position.y, position.z)
        );

        this.collider = state.world.createCollider(
            RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setSensor(true),
            this.body
        );
    }

    update(_: number) {
        this.state.world.intersectionPairsWith(this.collider, (other) => {
            if (this.to_detect.has(other) && this.detect_callback) {
                this.detect_callback();
            }
        });
    }
}
