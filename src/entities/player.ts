import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type { Entity } from './entity';
import { GameState } from '../state';
import type { Controlable, Controller } from '../control';
import { CuboidEntity } from './cuboid';

export class Player implements Entity, Controlable {
    mesh = new THREE.Mesh();
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    characterController: RAPIER.KinematicCharacterController;
    verticalVelocity: number = 0;
    desiredHorizontal: THREE.Vector3 = new THREE.Vector3();
    relativeRot: THREE.Quaternion = new THREE.Quaternion();
    camera = THREE.Camera.prototype;

    movementSpeed: number = 5;
    jumpStrength: number = 4;
    zoneSwitched: boolean = false;
    switchZoneCooldown: number = 0;

    maxAngularRatio: number = 10.0;

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
            RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setTranslation(position.x, position.y, position.z)
        );

        this.collider = state.world.createCollider(
            RAPIER.ColliderDesc.capsule(0.4, 0.4),
            this.body
        );

        this.characterController = state.world.createCharacterController(0.01);
        this.characterController.enableAutostep(0.3, 0.2, true);
        this.characterController.enableSnapToGround(0.3);

        this.camera = state.camera;
        this.camera.position.copy(position);
    }

    control(c: Controller) {
        const move = new THREE.Vector3();

        if (c.keydown['KeyF']) {
            //this.noclip = !this.noclip;
            //this.collider.setSensor(this.noclip);
        }

        if (this.noclip) {
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
            this.body.setNextKinematicTranslation({
                x: pos.x + move.x * 0.016,
                y: pos.y + move.y * 0.016,
                z: pos.z + move.z * 0.016
            });
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

        // 점프: 바닥에 있을 때만
        if (c.keys['Space'] && this.characterController.computedGrounded()) {
            this.verticalVelocity = this.jumpStrength;
        }

        // 수평 이동량을 멤버에 저장해서 update에서 KCC에 넘김
        this.desiredHorizontal = move;
    }

    update(delta: number) {
        this.switchZoneCooldown = Math.max(0, this.switchZoneCooldown - delta);

        if (!this.noclip) {
            // 중력 누적
            const gravity = -9.81;
            if (this.characterController.computedGrounded() && this.verticalVelocity <= 0) {
                this.verticalVelocity = 0;
            } else {
                this.verticalVelocity += gravity * delta;
            }

            // 목표 이동량 = 수평(속도*delta) + 수직
            const desired = {
                x: this.desiredHorizontal.x * delta,
                y: this.verticalVelocity * delta,
                z: this.desiredHorizontal.z * delta,
            };

            // KCC가 충돌 보정한 이동량 계산 (들고 있는 블록은 제외)
            this.characterController.computeColliderMovement(
                this.collider,
                desired,
                RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
                undefined,
                (collider) => collider !== this.heldObject?.collider
            );

            const corrected = this.characterController.computedMovement();
            const pos = this.body.translation();
            this.body.setNextKinematicTranslation({
                x: pos.x + corrected.x,
                y: pos.y + corrected.y,
                z: pos.z + corrected.z,
            });
        }

        const position = this.body.translation();
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

        this.updateRaycaster();

        const cuboids = this.state.entities.filter(
            (entity): entity is CuboidEntity => entity instanceof CuboidEntity
        );

        for (const cuboid of cuboids) {
            cuboid.mesh.updateMatrixWorld(true);
        }

        const meshes = cuboids.map(cuboid => cuboid.mesh);
        const hits = this.raycaster.intersectObjects(meshes, false);

        if (hits.length === 0) return;

        const hit = hits[0];

        if (hit.distance > 100 || hit.distance < 1.0){
            return;
        }

        const picked = cuboids.find(cuboid => cuboid.mesh === hit.object);

        if (!picked) return;

        const pickedSize = picked.baseSize.clone().multiplyScalar(picked.currentScale);
        const angularRatio = pickedSize.length() / Math.max(hit.distance, 0.1);
        if (angularRatio > this.maxAngularRatio) return;

        this.heldObject = picked;

        // 집은 순간의 거리 저장
        this.baseHoldDistance = Math.max(hit.distance, 0.1);

        // 핵심: 집은 순간에는 현재 거리에서 시작
        this.currentHoldDistance = hit.distance;

        // 현재 큐브의 실제 scale을 저장
        this.pickupScale = picked.currentScale;

        const camQuat = new THREE.Quaternion();
        this.camera.getWorldQuaternion(camQuat);
        const blockRot = picked.body.rotation();
        const blockQuat = new THREE.Quaternion(blockRot.x, blockRot.y, blockRot.z, blockRot.w);
        this.relativeRot = camQuat.clone().invert().multiply(blockQuat);

        picked.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        picked.collider.setSensor(true);
    }

    private dropObject() {
        if (this.heldObject !== null) {
            this.heldObject.collider.setSensor(false);
            this.heldObject.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        }
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

        const camQuat = new THREE.Quaternion();
        this.camera.getWorldQuaternion(camQuat);
        const finalQuat = camQuat.clone().multiply(this.relativeRot);
        const shapeRot = { x: finalQuat.x, y: finalQuat.y, z: finalQuat.z, w: finalQuat.w };

        // 1. ray로 벽까지 거리 파악 (스케일 무관)
        const ray = new RAPIER.Ray(
            { x: origin.x, y: origin.y, z: origin.z },
            { x: direction.x, y: direction.y, z: direction.z }
        );
        const rayHit = this.state.world.castRay(
            ray,
            wallSearchDistance,
            true,
            undefined,
            undefined,
            this.heldObject.collider,
            this.body,
        );
        const wallDistance = rayHit !== null ? rayHit.timeOfImpact : wallSearchDistance;

        // 2. 벽 거리의 0.9배부터 0.05씩 당기며 AABB 충돌 없는 최대 거리 탐색
        const minDistanceByScale = this.baseHoldDistance * (this.minScale / this.pickupScale);
        const minAllowedDistance = Math.max(minHoldDistance, minDistanceByScale);

        let targetDistance = minAllowedDistance;

        for (let ratio = 0.9; ratio >= 0.1; ratio -= 0.05) {
            const dist = THREE.MathUtils.clamp(
                wallDistance * ratio,
                minAllowedDistance,
                maxHoldDistance
            );

            const pos = origin
                .clone()
                .add(direction.clone().multiplyScalar(dist));

            // 이 거리 기준 스케일로 shape 재생성 (스케일 변동 반영)
            const scaleFactor = THREE.MathUtils.clamp(
                this.pickupScale * (dist / this.baseHoldDistance),
                this.minScale,
                this.maxScale
            );
            const scaledSize = this.heldObject.baseSize
                .clone()
                .multiplyScalar(scaleFactor);
            const shape = new RAPIER.Cuboid(
                scaledSize.x / 2,
                scaledSize.y / 2,
                scaledSize.z / 2
            );

            const collision = this.state.world.intersectionWithShape(
                { x: pos.x, y: pos.y, z: pos.z },
                shapeRot,
                shape,
                undefined,
                undefined,
                this.heldObject.collider,
                this.body,
            );

            if (collision === null) {
                targetDistance = dist;
                break;
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
            { x: holdPosition.x, y: holdPosition.y, z: holdPosition.z },
            true
        );

        this.heldObject.body.setRotation(shapeRot, true);

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

     enterLoop() {
        let pos = this.body.translation();
        pos.x += 25;
        this.body.setTranslation(pos, true);
        console.log("enter loop");
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
