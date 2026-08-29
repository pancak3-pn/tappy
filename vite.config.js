import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const uploadSourcemaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)

export default defineConfig({
  plugins:[
    react(),
    ...(uploadSourcemaps ? [sentryVitePlugin({
      authToken:process.env.SENTRY_AUTH_TOKEN,
      org:process.env.SENTRY_ORG,
      project:process.env.SENTRY_PROJECT,
      sourcemaps:{ filesToDeleteAfterUpload:['./dist/**/*.map'] },
    })] : []),
  ],
  build:{ sourcemap:uploadSourcemaps ? 'hidden' : false },
  server:{ proxy:{ '/api':'http://127.0.0.1:8787' } },
})
