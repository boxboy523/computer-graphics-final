
export interface Controlable {
    control: (keys: Record<string, boolean>) => void;
}

export class Controller {
    keys: Record<string, boolean> = {};
    controlable: Controlable[] = [];
    constructor() {
        document.addEventListener('keydown', e =>
            {
                this.keys[e.code] = true;
                this.control_callback();
            });
        document.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.control_callback();
        });
        document.addEventListener('mousemove', _ => {
            this.control_callback();
        })
    }

    control_callback() {
       for (const c of this.controlable) {
           c.control(this.keys)
        }
    }
}
