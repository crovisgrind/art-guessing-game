const CACHE_NAME = "art-guess-v5" // era v1
const RUNTIME_CACHE = "art-guess-runtime-v1"

// Core assets that should be cached on install
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
]

// Sound files
const SOUND_ASSETS = [
  "/sounds/click.wav",
  "/sounds/correct.wav",
  "/sounds/present.wav",
  "/sounds/wrong.wav",
  "/sounds/reveal.wav",
  "/sounds/win.wav"
]

// Artwork images - add all your paintings here
const ARTWORK_ASSETS = [
  "/artworks/van-gogh_starry-night.jpg",
  "/artworks/vermeer_girl-with-a-pear-earring.jpg",
  "/artworks/caravaggio_saint-jerome-writing.jpg",
  "/artworks/claude-monet_springtime.jpg",
  "/artworks/eugene-delacroix_liberty-leading-the-people.jpg",
  "/artworks/gustav-klimt_the-kiss.jpg",
  "/artworks/hokusai_tsunami.jpg",
  "/artworks/leonardo-da-vinci_monalisa.jpg",
  "/artworks/peter-paul-rubens_the-fall-of-phaeton.jpg",
  "/artworks/rembrandt_night-watch.jpg",
  "/artworks/sandro-botticelli_the-birth-of-venus.jpg",
  "/artworks/turner_the-fighting-temeraire.jpg",
  "/artworks/degas_the-ballet-class.jpg",
  "/artworks/paul-cezanne_montagne-sainte-victoire.jpg",
  "/artworks/pissarro_fox-hill-upper-norwood.jpg",
  "/artworks/michelangelo_creation-of-adam.jpg",
  "/artworks/paul-gauguin_vairumati.jpg",
  "/artworks/renoir_le-moulin-de-la-galette.jpg",
  "/artworks/kandinsky_fugue.jpg",
  "/artworks/velazquez_cristo-crucificado.jpg",

"/artworks/manet_young-flautist.jpg",

"/artworks/veronese_the-wedding-at-cana.jpg",

"/artworks/goya_marchioness-of-la-solana.jpg"
]

const ALL_CACHE_ASSETS = [...CORE_ASSETS, ...SOUND_ASSETS, ...ARTWORK_ASSETS]

// Install event - cache core assets
self.addEventListener("install", event => {
  console.log("[SW] Installing service worker...")
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("[SW] Caching core assets")
        return cache.addAll(CORE_ASSETS)
      })
      .then(() => {
        // Cache sounds and artworks separately to avoid blocking
        return Promise.allSettled([
          caches.open(CACHE_NAME).then(cache => cache.addAll(SOUND_ASSETS)),
          caches.open(CACHE_NAME).then(cache => cache.addAll(ARTWORK_ASSETS))
        ])
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error("[SW] Install failed:", err))
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activating service worker...")
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName.startsWith("art-guess-") && 
              cacheName !== CACHE_NAME &&
              cacheName !== RUNTIME_CACHE
            )
            .map(cacheName => {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log("[SW] Serving from cache:", request.url)
          return cachedResponse
        }

        // Clone the request
        return fetch(request.clone())
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response
            }

            // Clone the response
            const responseToCache = response.clone()

            // Cache runtime assets (like dynamically loaded images)
            caches.open(RUNTIME_CACHE)
              .then(cache => {
                // Only cache GET requests
                if (request.method === 'GET') {
                  cache.put(request, responseToCache)
                }
              })

            return response
          })
          .catch(error => {
            console.error("[SW] Fetch failed:", error)
            
            // Return offline fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html')
            }
            
            // For other requests, just fail
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
      })
  )
})

// Handle messages from clients
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(event.data.urls))
    )
  }
})

// Background sync for future features
self.addEventListener("sync", event => {
  if (event.tag === "sync-scores") {
    event.waitUntil(syncScores())
  }
})

async function syncScores() {
  // Placeholder for future score syncing functionality
  console.log("[SW] Background sync triggered")
}