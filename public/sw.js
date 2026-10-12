// 📲 지도안 대백과 오프라인 열기: 한 번 접속하면 인터넷이 끊겨도 첫 화면과 목록이 열려요.
// 앱 파일은 새 버전을 먼저 받아 오고(네트워크 우선), 실패할 때만 저장해 둔 사본을 써요.
// 지도안 원본 파일(plans/)은 크기가 커서 저장하지 않아요.
// 같은 주소(gmlduqzhd123-lab.github.io)의 다른 앱들과 저장소를 함께 쓰므로, 이 앱의 이전 캐시만 지운다.
const CACHE = 'lesson-plan-v10';
const CACHE_PREFIX = 'lesson-plan-v';
const CORE = ['./', './index.html', './manifest.webmanifest', './ys-install.js', './ys-qr.js', './qr.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/plans/')) return;
    e.respondWith(fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
