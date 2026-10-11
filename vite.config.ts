import { defineConfig } from 'vite'

const processLike = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
const repository = processLike?.env?.GITHUB_REPOSITORY
const baseOverride = processLike?.env?.MORPH_LAB_BASE
const [owner, repo] = repository?.split('/') ?? []
const base = baseOverride ?? (repo
  ? repo.toLowerCase() === `${owner?.toLowerCase()}.github.io`
    ? '/'
    : `/${repo}/`
  : '/')

export default defineConfig({
  base,
  publicDir: 'public',
  build: { target: 'es2022' },
  preview: { allowedHosts: true, cors: false },
})
