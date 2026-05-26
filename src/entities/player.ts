import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';
import type { Controlable } from '../control';
import { CuboidEntity } from './cuboid';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;

export class Player implements Entity, Controlable {
    mesh = new THREE.Mesh();
    body: RAPIER.RigidBody;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    pointorLockControls: PointerLockControls;

    movementSpeed: number = 5;
    jumpStrength: number = 5;

    state: GameState;

    heldObject: CuboidEntity | null = null;

    // 큐브를 처음 집었을 때의 거리
    baseHoldDistance: number = 2;

    // 현재 큐브가 카메라로부터 떨어진 거리
    currentHoldDistance: number = 2;

    // 큐브를 처음 집었을 때의 크기
    pickupScale: number = 1;

    // 목표 거리까지 얼마나 빠르게 따라갈지
    holdMoveSmoothness: number = 20;

    minScale: number = 0.15;
    maxScale: number = 15.0;

    minPlayerCubeDistance: number = 1.8;
    floorCloseThreshold: number = 0.25;
    floorBiasedRatio: number = 0.90;

    constructor(state: GameState, position: THREE.Vector3 = new THREE.Vector3(0, 1.3, 0)) {
        this.state = state;

        this.body = state.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(position.x, position.y, position.z)
                .lockRotations()
        );

        state.world.createCollider(
            RAPIER.ColliderDesc.capsule(0.4, 0.4),
            this.body
        );

        this.camera.position.copy(position);

        this.pointorLockControls = new PointerLockControls(this.camera, document.body);
        this.pointorLockControls.pointerSpeed = 2.0;

        // 위로 최대 89도, 아래로 최대 60도까지만 볼 수 있게 제한
        const maxLookUpDegree = 89;
        const maxLookDownDegree = 60;

        this.pointorLockControls.minPolarAngle = THREE.MathUtils.degToRad(90 - maxLookUpDegree);
        this.pointorLockControls.maxPolarAngle = THREE.MathUtils.degToRad(90 + maxLookDownDegree);

        canvas.addEventListener('click', () => {
            if (!this.pointorLockControls.isLocked) {
                this.pointorLockControls.lock();
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (!this.pointorLockControls.isLocked) return;

            this.pickObject();
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            if (!this.pointorLockControls.isLocked) return;

            this.dropObject();
        });
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

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.movementSpeed);
        }

        const jump = keys['Space'] && Math.abs(vel.y) < 0.05 ? this.jumpStrength : 0;

        this.body.setLinvel(
            {
                x: move.x,
                y: vel.y + jump,
                z: move.z
            },
            true
        );
    }

update(delta: number) {
    const position = this.body.translation();

    this.camera.position.set(position.x, position.y + 0.5, position.z);

    if (this.heldObject !== null) {
        this.moveHeldObjectInFrontOfCamera(delta);
    }
}

    private pickObject() {
        if (this.heldObject !== null) return;

        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3();

        this.pointorLockControls.getDirection(direction);
        raycaster.set(this.camera.position, direction);

        const cuboids = this.state.entities.filter(
            (entity): entity is CuboidEntity => entity instanceof CuboidEntity
        );

        for (const cuboid of cuboids) {
            cuboid.mesh.updateMatrixWorld(true);
        }

        const meshes = cuboids.map(cuboid => cuboid.mesh);
        const hits = raycaster.intersectObjects(meshes, false);

        if (hits.length === 0) return;

        const hit = hits[0];

        if (hit.distance > 100){
            return;
        }

        const picked = cuboids.find(cuboid => cuboid.mesh === hit.object);

        if (!picked) return;

        this.heldObject = picked;

        // 집은 순간의 거리 저장
        this.baseHoldDistance = Math.max(hit.distance, 0.1);

        // 핵심: 집은 순간에는 현재 거리에서 시작
        this.currentHoldDistance = hit.distance;

        // 현재 큐브의 실제 scale을 저장
        this.pickupScale = picked.currentScale;
    }

    private dropObject() {
        this.heldObject = null;
    }

    private isCubeCloseToFloor(position: THREE.Vector3): boolean {
    if (this.heldObject === null) return false;

    const rayStartY = position.y + 1.0;

    const downRay = new RAPIER.Ray(
        { x: position.x, y: rayStartY, z: position.z },
        { x: 0, y: -1, z: 0 }
    );

    const downHit = this.state.world.castRay(
        downRay,
        10,
        true,
        undefined,
        undefined,
        this.heldObject.collider,
        this.heldObject.body
    );

    if (downHit === null) return false;

    const floorY = rayStartY - downHit.timeOfImpact;
    const cubeBottomY = position.y - this.heldObject.size.y / 2;

    const distanceToFloor = cubeBottomY - floorY;

    return distanceToFloor < this.floorCloseThreshold;
}

    private moveHeldObjectInFrontOfCamera(delta: number) {
        if (this.heldObject === null) return;

        const direction = new THREE.Vector3();
        this.pointorLockControls.getDirection(direction);
        direction.normalize();

        const origin = this.camera.position.clone();

        const wallSearchDistance = 100.0;
        const minHoldDistance = 1.2;
        const maxHoldDistance = 30.0;
        const wallMargin = 0.4;

        const rayStartOffset = 0.8;
        const rayOrigin = origin
            .clone()
            .add(direction.clone().multiplyScalar(rayStartOffset));

        const forwardRay = new RAPIER.Ray(
            { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
            { x: direction.x, y: direction.y, z: direction.z }
        );

        const forwardHit = this.state.world.castRay(
            forwardRay,
            wallSearchDistance,
            true,
            undefined,
            undefined,
            this.heldObject.collider,
            this.heldObject.body
        );

        let targetDistance = this.currentHoldDistance;

        const minDistanceByScale = this.baseHoldDistance * (this.minScale / this.pickupScale);
        targetDistance = Math.max(targetDistance, minDistanceByScale);

        if (forwardHit !== null) {
            const wallDistance = forwardHit.timeOfImpact + rayStartOffset;

            if (Number.isFinite(wallDistance)) {
                const middleDistance = wallDistance / 2;

                const previewScaleFactor = THREE.MathUtils.clamp(
                    this.pickupScale * (middleDistance / this.baseHoldDistance),
                    this.minScale,
                    this.maxScale
                );

                const scaledSize = this.heldObject.baseSize
                    .clone()
                    .multiplyScalar(previewScaleFactor);

                const cubeRadius = scaledSize.length() / 2;

                const maxSafeDistance = wallDistance - cubeRadius - wallMargin;

                const minDistanceByScale =
                    this.baseHoldDistance * (this.minScale / this.pickupScale);

                const minAllowedDistance = Math.max(
                    minHoldDistance,
                    minDistanceByScale
                );

                if (maxSafeDistance <= 0) {
                    targetDistance = 0.3;
                } else if (maxSafeDistance < minAllowedDistance) {
                    // 벽이 너무 가까우면 minScale 조건보다 벽 통과 방지를 우선
                    targetDistance = maxSafeDistance;
                } else {
                    targetDistance = middleDistance;

                    // 너무 가까워져서 minScale보다 작아지는 것 방지
                    targetDistance = Math.max(targetDistance, minAllowedDistance);

                    // 벽 통과 방지
                    targetDistance = Math.min(targetDistance, maxSafeDistance);

                    // 너무 멀어지는 것 방지
                    targetDistance = Math.min(targetDistance, maxHoldDistance);
                }
            }
        }

        this.currentHoldDistance = THREE.MathUtils.damp(
            this.currentHoldDistance,
            targetDistance,
            this.holdMoveSmoothness,
            delta
        );

        let holdPosition = origin
            .clone()
            .add(direction.clone().multiplyScalar(this.currentHoldDistance));

        this.heldObject.body.setTranslation(
            {
                x: holdPosition.x,
                y: holdPosition.y,
                z: holdPosition.z
            },
            true
        );

        this.heldObject.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.heldObject.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

        const distanceRatio = this.currentHoldDistance / this.baseHoldDistance;

        const playerToCube = holdPosition.clone().sub(origin);
        const playerToCubeDistance = playerToCube.length();

        if (playerToCubeDistance < this.minPlayerCubeDistance) {
            if (playerToCubeDistance > 0.001) {
                holdPosition.copy(
                    origin.clone().add(
                        playerToCube.normalize().multiplyScalar(this.minPlayerCubeDistance)
                    )
                );
            } else {
                holdPosition.copy(
                    origin.clone().add(
                        direction.clone().multiplyScalar(this.minPlayerCubeDistance)
                    )
                );
            }
        }

        const finalScale = THREE.MathUtils.clamp(
            this.pickupScale * distanceRatio,
            this.minScale,
            this.maxScale
        );

        this.heldObject.setScale(this.state, finalScale);
    }
}