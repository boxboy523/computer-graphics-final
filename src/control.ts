import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.getElementById('canvas_main') as HTMLCanvasElement;

export interface Controlable {
    control: (keys: Record<string, boolean>, plc: PointerLockControls) => void;
}

export class Controller {
    keys: Record<string, boolean> = {};
    pointorLockControls: PointerLockControls;
    controlable: Controlable[] = [];
    camera: THREE.Camera;

    constructor(camera: THREE.Camera) {
        this.camera = camera;
        this.pointorLockControls = new PointerLockControls(this.camera, document.body);
        this.pointorLockControls.pointerSpeed = 2.0;

        // 위로 최대 89도, 아래로 최대 60도까지만 볼 수 있게 제한
        const maxLookUpDegree = 89;
        const maxLookDownDegree = 70;

        this.pointorLockControls.minPolarAngle = THREE.MathUtils.degToRad(90 - maxLookUpDegree);
        this.pointorLockControls.maxPolarAngle = THREE.MathUtils.degToRad(90 + maxLookDownDegree);

        canvas.addEventListener('click', () => {
            if (!this.pointorLockControls.isLocked) {
                this.pointorLockControls.lock();
            }
        });

        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.control_callback();
        });

        document.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.control_callback();
        });

        document.addEventListener('mousedown', e => {
            if (!this.pointorLockControls.isLocked) return;
            if (e.button === 0) {
                this.keys["MouseLeft"] = true;
                this.control_callback();
            }
        });

        document.addEventListener('mouseup', e => {
            if (!this.pointorLockControls.isLocked) return;
            if (e.button === 0) {
                this.keys["MouseLeft"] = false;
                this.control_callback();
            }
        });

        document.addEventListener('mousemove', _ => {
            if (!this.pointorLockControls.isLocked) return;
            this.control_callback();
        });
    }

    control_callback() {
        for (const c of this.controlable) {
            c.control(this.keys, this.pointorLockControls);
        }
    }
}
