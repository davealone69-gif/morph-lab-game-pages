import { defineConfig } from 'vite'

const processLike = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
const repository = processLike?.env?.GITHUB_REPOSITORY
const [owner, repo] = repository?.split('/') ?? []
const base = repo
  ? repo.toLowerCase() === `${owner?.toLowerCase()}.github.io`
    ? '/'
    : `/${repo}/`
  : '/'

export default defineConfig({
  base,
  publicDir: 'public',
  build: { target: 'es2022' },
  preview: { allowedHosts: true, cors: false },
})
