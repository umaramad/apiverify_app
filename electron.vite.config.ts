import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const reactRoot = resolve('node_modules/react')
const reactDomRoot = resolve('node_modules/react-dom')

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        // Force a single React instance (avoids invalid hook / null useState across src/modules).
        react: reactRoot,
        'react-dom': reactDomRoot,
        'react/jsx-runtime': resolve('node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': resolve('node_modules/react/jsx-dev-runtime.js'),
      },
      dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
      ],
    },
    plugins: [react()],
  }
})
