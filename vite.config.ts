import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Only include src directory - exclude api/ from Vite processing
  include: ['src'],
  build: {
    rollupOptions: {
      external: ['@vercel/node', 'express', '@supabase/supabase-js'],
    },
  },
})
