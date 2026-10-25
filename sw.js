/* Service worker: guarda la calculadora para que funcione sin conexión.
   La página se pide primero a la red (para recibir las actualizaciones) y, si no hay conexión, sale de la caché. */
const CACHE='calculadora-idom-2026-10-25 12:29';
const BASICOS=['./','./calculadora-idom.html','./manifest.webmanifest','./icono.svg','./icono-192.png','./icono-512.png','./icono-180.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(BASICOS.map(u=>c.add(u).catch(()=>{})))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{
      const copia=res.clone(); caches.open(CACHE).then(c=>c.put(r,copia)); return res;
    }).catch(()=>caches.match(r).then(m=>m||caches.match('./calculadora-idom.html'))));
    return;
  }
  /* resto (iconos, tipografías): caché primero */
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{
    if(res.ok||res.type==='opaque'){ const copia=res.clone(); caches.open(CACHE).then(c=>c.put(r,copia)); }
    return res;
  })));
});
