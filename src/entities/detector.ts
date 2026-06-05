import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';

export class DetectorEntity implements Entity {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    state: GameState;
    visible: boolean = false;
    size: THREE.Vector3;
    detect_callback: (() => void) | null = null;
    to_detect: Set<RAPIER.RigidBody> = new Set();
    queryShape: RAPIER.Cuboid;
    queryPos: RAPIER.Vector3
    queryRot: RAPIER.Quaternion;

    constructor(
        state: GameState,
        size: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
        position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
        callback: (() => void) | null = null,
        to_detect: Set<RAPIER.RigidBody> = new Set(),
        visible: boolean = false,
        material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    ) {
        this.size = size.clone();
        this.detect_callback = callback;
        this.to_detect = to_detect;
        this.state = state;
        this.visible = visible;
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.visible = this.visible;
        state.scene.add(this.mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        this.queryShape = new RAPIER.Cuboid(size.x / 2, size.y / 2, size.z / 2);
        this.queryPos = { x: position.x, y: position.y, z: position.z };
        this.queryRot = { x: 0, y: 0, z: 0, w: 1 };

         this.body = state.world.createRigidBody(
            bodyDesc.setTranslation(position.x, position.y, position.z)
        );

        this.collider = state.world.createCollider(
            RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setSensor(true),
            this.body
        );
    }

    update(_: number) {
        const c = this.body.translation();
        const hx = this.size.x / 2;
        const hy = this.size.y / 2;
        const hz = this.size.z / 2;

        for (const body of this.to_detect) {
            const p = body.translation();
            if (
                Math.abs(p.x - c.x) <= hx &&
                Math.abs(p.y - c.y) <= hy &&
                Math.abs(p.z - c.z) <= hz
            ) {
                this.detect_callback?.();
            }
        }
    }
}
