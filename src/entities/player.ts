import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';
import type { Controlable, Controller } from '../control';
import { CuboidEntity } from './cuboid';

export class Player implements Entity, Controlable {
    mesh = new THREE.Mesh();
    body: RAPIER.RigidBody;
    camera = THREE.Camera.prototype;

    movementSpeed: number = 5;
    jumpStrength: number = 5;
    zoneSwitched: boolean = false;
    switchZoneCooldown: number = 0;

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
    noclip: boolean = false;

    direction = new THREE.Vector3();

    raycaster = new THREE.Raycaster();

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
        this.camera = state.camera;

        this.camera.position.copy(position);
    }

    control(c: Controller) {
        const vel = this.body.linvel();
        const move = new THREE.Vector3();
        if (c.keydown['KeyF']) {
            this.noclip = !this.noclip;
            this.body.setGravityScale(this.noclip ? 0 : 1, true);
            //this.body.setEnabledTranslations(true, true, true, true);
            this.body.collider(0).setSensor(this.noclip);
        }

        if (this.noclip) {
            const move = new THREE.Vector3();
            c.pointorLockControls.getDirection(this.direction);
            if (c.keys['KeyW']) move.addScaledVector(this.direction, 1);
            if (c.keys['KeyS']) move.addScaledVector(this.direction, -1);
            if (c.keys['KeyA']) {
                const left = this.direction.clone().cross(new THREE.Vector3(0,1,0)).negate();
                move.addScaledVector(left, 1);
            }
            if (c.keys['KeyD']) {
                const right = this.direction.clone().cross(new THREE.Vector3(0,1,0));
                move.addScaledVector(right, 1);
            }
            if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.movementSpeed);
            const pos = this.body.translation();
            this.body.setTranslation({ x: pos.x + move.x * 0.016, y: pos.y + move.y * 0.016, z: pos.z + move.z * 0.016 }, true);
            this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            return;
         }
        if (c.keys['KeyW']) move.z += 1;
        if (c.keys['KeyS']) move.z -= 1;
        if (c.keys['KeyA']) move.x += 1;
        if (c.keys['KeyD']) move.x -= 1;
        if (c.keys['MouseLeft']) {
            this.pickObject();
        }
        if (c.keys['MouseLeft'] === false) {
            this.dropObject();
        }

        c.pointorLockControls.getDirection(this.direction);

        const yaw = Math.atan2(this.direction.x, this.direction.z);
        move.applyEuler(new THREE.Euler(0, yaw, 0));

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.movementSpeed);
        }

        const jump = c.keys['Space'] && Math.abs(vel.y) < 0.05 ? this.jumpStrength : 0;

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
        this.switchZoneCooldown = Math.max(0, this.switchZoneCooldown - delta);

        this.camera.position.set(position.x, position.y + 0.5, position.z);

        this.checkWallInFront();
        if (this.heldObject !== null) {
            this.moveHeldObject(delta);
        }
    }

    private switchZone() {
        if (this.switchZoneCooldown > 0) return;
        const shape = new RAPIER.Capsule(0.35, 0.35);
        let pos = this.body.translation();
        const shapeRot = this.body.rotation();
        if (this.zoneSwitched)
            pos.x -= 10;
        else
            pos.x += 10;

         const hit = this.state.world.intersectionWithShape(
                pos,
                shapeRot,
                shape,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            );
            if (hit) {
                return;
            }
            this.body.setTranslation(pos, true);
        this.zoneSwitched = !this.zoneSwitched;
        this.switchZoneCooldown = 1.0;
    }

    private updateRaycaster() {
        this.raycaster.set(this.camera.position, this.direction);
    }

    private checkWallInFront() {
        this.updateRaycaster();
        const intersects = this.raycaster.intersectObjects(this.state.scene.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const worldNormal = hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
            const angle = worldNormal ? this.direction.angleTo(worldNormal) : null;
            const mesh = hit.object as THREE.Mesh;
            const color = (mesh.material as THREE.MeshStandardMaterial).color;
            const isGreen = color.g > 0.8 && color.r < 0.2 && color.b < 0.2;
            //console.log('distance:', hit.distance, 'angle', angle, 'color:', (mesh.material as THREE.MeshStandardMaterial).color);
            if (hit.distance < 0.5 && angle !== null && ( angle < Math.PI * 0.1 || angle > Math.PI * 0.9) && isGreen) {
                console.log('Switching zone!');
                this.switchZone();

            }
        }
    }

    private pickObject() {
        if (this.heldObject !== null) return;

        const raycaster = new THREE.Raycaster();
        raycaster.set(this.camera.position, this.direction);

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

    private moveHeldObject(delta: number) {
        if (this.heldObject === null) return;

        let direction = this.direction.clone();
        direction.normalize();

        let origin = this.camera.position.clone();

        const wallSearchDistance = 100.0;
        const minHoldDistance = 1.2;
        const maxHoldDistance = 30.0;
        const wallMargin = 0.4;

        const shape = this.heldObject.collider.shape;
        const shapeRot = this.heldObject.body.rotation();

        const hit = this.state.world.castShape(
            { x: origin.x, y: origin.y, z: origin.z },
            shapeRot,
            direction,
            shape,
            0.1,
            wallSearchDistance,
            true,
            undefined,
            undefined,
            this.heldObject.collider,
            this.body,
        );

        // const rayStartOffset = 0.8;
        // const rayOrigin = origin
        //     .clone()
        //     .add(direction.clone().multiplyScalar(rayStartOffset));

        // const forwardRay = new RAPIER.Ray(
        //     { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
        //     { x: direction.x, y: direction.y, z: direction.z }
        // );

        // const forwardHit = this.state.world.castRay(
        //     forwardRay,
        //     wallSearchDistance,
        //     true,
        //     undefined,
        //     undefined,
        //     this.heldObject.collider,
        //     this.heldObject.body
        // );

        const minDistanceByScale = this.baseHoldDistance * (this.minScale / this.pickupScale);
        let targetDistance = Math.max(this.currentHoldDistance, minDistanceByScale);

        if (hit !== null) {
            const wallDistance = hit.time_of_impact;

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

    // The trail rolled left (r l r l l l)
    // 오른쪽으로 돌면 1->2->3->4->1, 왼쪽으로 돌면 1->4->3->2->1
    lastCheckPoint = 1;
    puzzleSeqOrigin = [true, false, true, false, false, false]; // 오른쪽은 true, 왼쪽은 false
    puzzleProgress = 0;
    backToStart = false;

    successPuzzle() {
        let pos = this.body.translation();
        pos.x += 25;
        this.body.setTranslation(pos, true);
    }

    failPuzzle(checkPointNumber: number) {
        console.log('Failed puzzle at checkpoint', checkPointNumber);
        let pos = this.body.translation();
        let relativePos = new THREE.Vector3;
        this.camera.rotation.order = 'YXZ';
        if (checkPointNumber === 4) {
            relativePos.set(pos.x - 42.114, pos.y - 1.5, pos.z + 44);
            relativePos.applyEuler(new THREE.Euler(0, Math.PI/2, 0));
            const q = new THREE.Quaternion();
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2);
            this.camera.quaternion.premultiply(q);
            this.camera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, 0, 'YXZ');
            // pos.x -=43.9501;
        }
        if (checkPointNumber === 2) {
            relativePos.set(pos.x - 23.614, pos.y - 1.5, pos.z + 25.5);
            relativePos.applyEuler(new THREE.Euler(0, -Math.PI/2, 0));
            const q = new THREE.Quaternion();
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2);
            this.camera.quaternion.premultiply(q);
            this.camera.rotation.set(this.camera.rotation.x, this.camera.rotation.y, 0, 'YXZ');
        }
        this.camera.rotation.order = 'YXZ';
        pos.x = relativePos.x - 1.3861;
        pos.y = relativePos.y + 1.5;
        pos.z = relativePos.z - 44;
        this.puzzleProgress = 0;
        this.body.setTranslation(pos, true);
    }

    enterCheckPoint(checkPointNumber: number) {
        if (checkPointNumber === this.lastCheckPoint) {
            return;
        }
        let turnRight = null;
        if (checkPointNumber === 1) {
            this.backToStart = true;
        }
        if (checkPointNumber === 4 && this.lastCheckPoint === 3 && this.backToStart) {
            turnRight = true;
            console.log('turning right');
            this.backToStart = false;
        }
        if (checkPointNumber === 2 && this.lastCheckPoint === 3 && this.backToStart) {
            turnRight = false;
            console.log('turning left');
            this.backToStart = false;
        }
        if (turnRight !== null) {
            const expectedTurn = this.puzzleSeqOrigin[this.puzzleProgress];
            if (turnRight === expectedTurn) {
                this.puzzleProgress += 1;
                if (this.puzzleProgress === this.puzzleSeqOrigin.length) {
                    this.successPuzzle();
                }
            } else {
                this.failPuzzle(checkPointNumber);
            }
        }
        this.lastCheckPoint = checkPointNumber;
    }

}
