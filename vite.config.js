import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Multi-página: cada HTML de la raíz es una entrada independiente.
//   index.html         → formulario público de postulación (hoy en pausa)
//   apoyo-escolar.html → registro del apoyo de útiles escolares
// Son dos productos distintos que comparten dominio y deploy, no una SPA con
// rutas: no hay router de cliente y nunca lo hubo.
const entry = (file) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: entry('./index.html'),
        'apoyo-escolar': entry('./apoyo-escolar.html'),
      },
    },
  },
})
