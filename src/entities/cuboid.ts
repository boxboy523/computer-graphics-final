import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';

export class CuboidEntity implements Entity {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;

    baseSize: THREE.Vector3;
    size: THREE.Vector3;
    currentScale: number = 1;

    constructor(
        state: GameState,
        size: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
        material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
        dynamic: boolean = true
    ) {
        this.baseSize = size.clone();
        this.size = size.clone();

        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        state.scene.add(this.mesh);

        const bodyDesc = dynamic
            ? RAPIER.RigidBodyDesc.dynamic()
            : RAPIER.RigidBodyDesc.fixed();

        this.body = state.world.createRigidBody(
            bodyDesc.setTranslation(position.x, position.y, position.z)
        );

        this.collider = state.world.createCollider(
            RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
            this.body
        );
    }

    setScale(state: GameState, scaleFactor: number) {
        this.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        this.mesh.updateMatrixWorld(true);

        if (Math.abs(this.currentScale - scaleFactor) < 0.05) {
            return;
        }

        this.currentScale = scaleFactor;

        this.size.copy(this.baseSize).multiplyScalar(scaleFactor);

        state.world.removeCollider(this.collider, true);

        this.collider = state.world.createCollider(
            RAPIER.ColliderDesc.cuboid(
                this.size.x / 2,
                this.size.y / 2,
                this.size.z / 2
            ),
            this.body
        );
    }

    update(_: number) {
        const position = this.body.translation();
        const rotation = this.body.rotation();

        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
}