import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface Entity {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    update: (delta: number) => void;
}
