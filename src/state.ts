import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();

import type { Map } from './map';
import type { Entity } from './entities/entity';
import { Controller } from './control';
import type { Controlable } from './control';

export class GameState {
    scene = new THREE.Scene();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    map: Map;
    entities: Entity[] = [];
    controller = new Controller();

    constructor(map: Map) {
        this.map = map;
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);

        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }

    spawnEntity(entity: Entity) {
        this.entities.push(entity);
    }

    spawnControlable(controlable: Controlable) {
        this.controller.controlable.push(controlable);
    }

    update(delta: number) {
        this.world.step();
        for (const entity of this.entities) {
            entity.update(delta);
        }
    }
}
