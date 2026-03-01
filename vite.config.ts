import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl(),
  ],
  // hydra-synth depends on Node's `global` which is not defined in browsers
  define: {
    global: {},
  },
})
