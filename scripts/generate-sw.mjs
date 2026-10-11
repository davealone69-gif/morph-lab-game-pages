import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

const dist = resolve('dist')
const files = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) await walk(fullPath)
    else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map')) files.push(fullPath)
  }
}

await walk(dist)
const paths = files.map(file => relative(dist, file).split(sep).join('/')).sort()
if (!paths.includes('index.html')) throw new Error('dist/index.html is missing; cannot build offline shell')
const digest = createHash('sha256')
for (const path of paths) {
  digest.update(path)
  digest.update(await readFile(join(dist, path)))
}
const cacheName = `morph-lab-${digest.digest('hex').slice(0, 16)}`
const quotedPaths = JSON.stringify(['.', ...paths])
const worker = `// Generated after Vite build; precaches the complete static app for offline use.\nconst CACHE_NAME = ${JSON.stringify(cacheName)}\nconst PRECACHE = ${quotedPaths}.map(path => new URL(path, self.registration.scope).href)\n\nself.addEventListener('install', event => {\n  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))\n})\n\nself.addEventListener('activate', event => {\n  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('morph-lab-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()))\n})\n\nself.addEventListener('fetch', event => {\n  const request = event.request\n  const scope = self.registration.scope\n  const url = new URL(request.url)\n  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return\n  event.respondWith((async () => {\n    const cache = await caches.open(CACHE_NAME)\n    if (request.mode === 'navigate') {\n      try {\n        const response = await fetch(request)\n        if (response.ok) await cache.put(request, response.clone())\n        return response\n      } catch {\n        return (await cache.match(request)) ?? (await cache.match(new URL('index.html', scope).href)) ?? Response.error()\n      }\n    }\n    const cached = await cache.match(request)\n    if (cached) return cached\n    try {\n      const response = await fetch(request)\n      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())\n      return response\n    } catch {\n      return Response.error()\n    }\n  })())\n})\n`
await writeFile(join(dist, 'sw.js'), worker)
console.log(`Generated dist/sw.js: ${paths.length} precached files (${cacheName})`)
