// The production build replaces the generated precache list with every app file.
const CACHE_NAME = 'morph-lab-dev-shell-v1'
const PRECACHE = ['./', 'index.html', 'manifest.webmanifest'].map(path => new URL(path, self.registration.scope).href)

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('morph-lab-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const scope = self.registration.scope
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return (await cache.match(request)) ?? (await cache.match(new URL('index.html', scope).href)) ?? Response.error()
      }
    }

    const cached = await cache.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch {
      return Response.error()
    }
  })())
})
