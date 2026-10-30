import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

import { cloudflare } from "@cloudflare/vite-plugin";

// Cloudflare Pages exposes the commit sha; fall back to git locally.
const sha = (): string => {
  const cf = process.env.CF_PAGES_COMMIT_SHA
  if (cf) return cf.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${sha()}`),
  },
  test: {
    environment: 'node',
  },
})