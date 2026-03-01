import { BlendFunction, Effect } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = `
uniform float mode;
uniform float sides;
uniform float angle;

void mainUv(inout vec2 uv) {
    if (mode == 1.0) {
        // Horizontal Mirror (left-right)
        uv.x = abs(uv.x - 0.5) + 0.5;
    } else if (mode == 2.0) {
        // Vertical Mirror (top-bottom)
        uv.y = abs(uv.y - 0.5) + 0.5;
    } else if (mode == 3.0) {
        // Quad Mirror
        uv = abs(uv - 0.5) + 0.5;
    } else if (mode == 4.0) {
        // Kaleidoscope
        vec2 p = uv - 0.5;
        float r = length(p);
        float a = atan(p.y, p.x);
        
        a += angle;
        
        float tau = 6.28318530718;
        float slice = tau / max(2.0, sides);
        
        a = mod(a, slice);
        a = abs(a - slice / 2.0);
        
        p = r * vec2(cos(a), sin(a));
        uv = p + 0.5;
    }
}
`

export class MirrorEffectImpl extends Effect {
    constructor(options: { mode?: number; sides?: number; angle?: number; blendFunction?: BlendFunction } = {}) {
        super('MirrorEffect', fragmentShader, {
            blendFunction: options.blendFunction ?? BlendFunction.NORMAL,
            uniforms: new Map([
                ['mode', new Uniform(options.mode ?? 0)],
                ['sides', new Uniform(options.sides ?? 6)],
                ['angle', new Uniform(options.angle ?? 0)]
            ])
        })
    }

    updateUniforms(mode: number, sides: number, angle: number) {
        this.uniforms.get('mode')!.value = mode
        this.uniforms.get('sides')!.value = sides
        this.uniforms.get('angle')!.value = angle
    }
}
