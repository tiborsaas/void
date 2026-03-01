declare module '*.glsl' {
  const value: string
  export default value
}

declare module '*.vert' {
  const value: string
  export default value
}

// hydra-synth has no official TypeScript declarations
declare module 'hydra-synth' {
  interface HydraOptions {
    canvas?: HTMLCanvasElement
    width?: number
    height?: number
    makeGlobal?: boolean
    autoLoop?: boolean
    detectAudio?: boolean
    numSources?: number
    numOutputs?: number
    precision?: 'highp' | 'mediump' | 'lowp' | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pb?: any
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface HydraSynth extends Record<string, any> {
    osc: (...args: unknown[]) => HydraSynth
    noise: (...args: unknown[]) => HydraSynth
    voronoi: (...args: unknown[]) => HydraSynth
    gradient: (...args: unknown[]) => HydraSynth
    shape: (...args: unknown[]) => HydraSynth
    solid: (...args: unknown[]) => HydraSynth
    src: (...args: unknown[]) => HydraSynth
    prev: (...args: unknown[]) => HydraSynth
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    o0: any; o1: any; o2: any; o3: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s0: any; s1: any; s2: any; s3: any
    render: (...args: unknown[]) => void
    hush: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    speed: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    time: any
  }

  class Hydra {
    constructor(opts?: HydraOptions)
    synth: HydraSynth
    tick(dt: number): void
  }

  export default Hydra
}

declare module '*.frag' {
  const value: string
  export default value
}
