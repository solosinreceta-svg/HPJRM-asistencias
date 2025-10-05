// =============================================
// SERVICE WORKER - OFFLINE FUNCTIONALITY
// =============================================

const CACHE_NAME = 'hpjrm-v1.2.0';
const STATIC_CACHE = 'hpjrm-static-v1';
const DYNAMIC_CACHE = 'hpjrm-dynamic-v1';

// Archivos esenciales para cachear
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/js/auth.js',
    '/js/geolocation.js',
    '/js/qr-scanner.js',
    '/js/data-manager.js',
    '/js/dashboard.js',
    '/js/reports.js',
    '/js/app.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Archivos de iconos (si existen)
const ICON_FILES = [
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png'
];

// ========== INSTALACIÓN ==========

self.addEventListener('install', (event) => {
    console.log('🛠️ Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Cacheando archivos estáticos...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('✅ Service Worker instalado correctamente');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Error en instalación:', error);
            })
    );
});

// ========== ACTIVACIÓN ==========

self.addEventListener('activate', (event) => {
    console.log('🎯 Service Worker: Activando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Eliminar caches antiguos
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== CACHE_NAME) {
                            console.log('🗑️ Eliminando cache antiguo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activado correctamente');
                return self.clients.claim();
            })
    );
});

// ========== INTERCEPTACIÓN DE FETCH ==========

self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    // Solo manejar requests GET
    if (request.method !== 'GET') {
        return;
    }

    // Estrategia: Cache First para recursos estáticos, Network First para datos dinámicos
    if (isStaticAsset(request)) {
        event.respondWith(serveStaticAsset(request));
    } else if (isApiRequest(request)) {
        event.respondWith(serveApiRequest(request));
    } else {
        event.respondWith(serveDynamicContent(request));
    }
});

// ========== ESTRATEGIAS DE CACHE ==========

// Servir recursos estáticos (Cache First)
async function serveStaticAsset(request) {
    try {
        // Primero intentar desde cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('📦 Sirviendo desde cache:', request.url);
            return cachedResponse;
        }

        // Si no está en cache, buscar en network
        const networkResponse = await fetch(request);
        
        // Cachear la respuesta para futuras requests
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Error sirviendo recurso estático:', error);
        
        // Fallback para páginas HTML
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        
        // Fallback genérico
        return new Response('Recurso no disponible offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Servir requests de API (Network First)
async function serveApiRequest(request) {
    try {
        // Primero intentar network
        const networkResponse = await fetch(request);
        
        // Si la respuesta es exitosa, actualizar cache
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('🌐 Network falló, intentando cache para API:', request.url);
        
        // Fallback a cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback para datos de la aplicación
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'No se puede acceder a este recurso sin conexión'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Servir contenido dinámico (Stale While Revalidate)
async function serveDynamicContent(request) {
    try {
        // Intentar cache primero para respuesta rápida
        const cachedResponse = await caches.match(request);
        
        // Siempre hacer request a network para actualizar cache
        const networkPromise = fetch(request)
            .then((networkResponse) => {
                if (networkResponse.ok) {
                    const cache = await caches.open(DYNAMIC_CACHE);
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            })
            .catch(() => {
                // Ignorar errores de network en esta estrategia
            });

        // Devolver cache inmediatamente si existe, sino esperar network
        return cachedResponse || networkPromise;
        
    } catch (error) {
        console.error('Error en contenido dinámico:', error);
        return new Response('Contenido no disponible', { status: 503 });
    }
}

// ========== HELPERS ==========

function isStaticAsset(request) {
    const url = new URL(request.url);
    
    // Archivos de la aplicación
    if (url.pathname.endsWith('.html') || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.json') ||
        url.pathname.includes('/icons/') ||
        url.pathname.includes('/js/')) {
        return true;
    }
    
    // CDN de librerías
    if (url.href.includes('jsqr')) {
        return true;
    }
    
    return false;
}

function isApiRequest(request) {
    const url = new URL(request.url);
    
    // En una app real, aquí identificarías tus endpoints de API
    return url.pathname.startsWith('/api/') || 
           url.href.includes('api.') ||
           request.headers.get('Content-Type') === 'application/json';
}

// ========== SYNC BACKGROUND ==========

self.addEventListener('sync', (event) => {
    console.log('🔄 Background Sync:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Aquí iría la lógica para sincronizar datos pendientes
        // cuando se recupera la conexión
        console.log('🔄 Sincronizando datos en background...');
        
        // Ejemplo: Sincronizar asistencias pendientes
        // await syncPendingAttendances();
        
    } catch (error) {
        console.error('Error en background sync:', error);
    }
}

// ========== PUSH NOTIFICATIONS ==========

self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nueva notificación del sistema',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            },
            actions: [
                {
                    action: 'open',
                    title: 'Abrir App'
                },
                {
                    action: 'close',
                    title: 'Cerrar'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'HPJRM App', options)
        );
    } catch (error) {
        console.error('Error con push notification:', error);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.matchAll({ type: 'window' })
                .then((clientList) => {
                    // Buscar ventana existente
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    // Abrir nueva ventana
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});

// ========== MANEJO DE MENSAJES ==========

self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: '1.2.0',
                cache: CACHE_NAME
            });
            break;
            
        case 'CACHE_CLEAR':
            caches.delete(STATIC_CACHE)
                .then(() => caches.delete(DYNAMIC_CACHE))
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                });
            break;
                
        default:
            console.log('Mensaje no manejado:', type);
    }
});

// ========== OFFLINE DETECTION ==========

function updateOnlineStatus() {
    clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                type: 'ONLINE_STATUS',
                isOnline: navigator.onLine
            });
        });
    });
}

self.addEventListener('online', updateOnlineStatus);
self.addEventListener('offline', updateOnlineStatus);

console.log('🚀 Service Worker HPJRM cargado correctamente');
