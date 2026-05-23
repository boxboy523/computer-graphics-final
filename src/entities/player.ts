import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';
import type { Controlable } from '../control';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;

export class Player implements Entity, Controlable {
    mesh = new THREE.Mesh(); // The player doesn't have a visible mesh, as the camera represents the player's view.
    body: RAPIER.RigidBody;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    pointorLockControls: PointerLockControls;
    movementSpeed: number = 5;
    jumpStrength: number = 5;

    constructor(state: GameState, position: THREE.Vector3 = new THREE.Vector3(0, 1.3, 0)) {
        this.body = state.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z).lockRotations()
        );
        state.world.createCollider(
            RAPIER.ColliderDesc.capsule(0.4, 0.4), this.body
        );
        this.camera.position.copy(position);
        this.pointorLockControls = new PointerLockControls(this.camera, document.body);
        this.pointorLockControls.pointerSpeed = 2.0;
        canvas.addEventListener('click', () => this.pointorLockControls.lock());
    }

    control(keys: Record<string, boolean>) {
        const vel = this.body.linvel();
        const move = new THREE.Vector3();

        if (keys['KeyW']) move.z += 1;
        if (keys['KeyS']) move.z -= 1;
        if (keys['KeyA']) move.x += 1;
        if (keys['KeyD']) move.x -= 1;

        const direction = new THREE.Vector3();
        this.pointorLockControls.getDirection(direction);
        const yaw = Math.atan2(direction.x, direction.z);
        move.applyEuler(new THREE.Euler(0, yaw, 0));
        move.normalize().multiplyScalar(this.movementSpeed);

        const jump = keys['Space'] && Math.abs(vel.y) < 0.05 ? this.jumpStrength : 0;

        this.body.setLinvel({ x: move.x, y: vel.y + jump, z: move.z }, true);
    }

    update(_: number) {
        const position = this.body.translation();
        this.camera.position.set(position.x, position.y + 0.5, position.z);
    }
}
