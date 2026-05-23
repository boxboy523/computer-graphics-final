import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';

export class CuboidEntity implements Entity {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    constructor(state: GameState,
                size: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
                position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
                material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
                dynamic: boolean = true
               ) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        state.scene.add(this.mesh);

        let bodyDesc = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
        this.body = state.world.createRigidBody(bodyDesc.setTranslation(position.x, position.y, position.z));
        state.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2), this.body);
    }

    update(_: number) {
        const position = this.body.translation();
        const rotation = this.body.rotation();
        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
}
