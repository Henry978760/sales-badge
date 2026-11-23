// 발주 알림 서비스 워커: 알림을 받으면 아이콘 숫자를 올리고 배너를 띄운다.
const STATE_URL = new URL('state.json', self.registration.scope).href;

async function readState() {
  const c = await caches.open('badge');
  const r = await c.match(STATE_URL);
  if (!r) return { n: 0, items: [] };
  try { return await r.json(); } catch (_) { return { n: 0, items: [] }; }
}
async function writeState(s) {
  const c = await caches.open('badge');
  await c.put(STATE_URL, new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json' } }));
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
    const add = Math.max(1, parseInt(d.n, 10) || 1);
    const s = await readState();
    s.n = (s.n || 0) + add;
    s.items = [{ t: Date.now(), title: d.title || '새 발주', body: d.body || '', n: add }]
      .concat(s.items || []).slice(0, 30);
    await writeState(s);
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(s.n); } catch (_) {}
    await self.registration.showNotification(d.title || '영업 브리핑', {
      body: d.body || '',
      tag: d.id ? 'order-' + d.id : undefined,
      icon: 'icon-192.png',
      data: { url: self.registration.scope }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    // 배너를 눌러 들어오면 숫자를 지운다 (앱이 바로 브리핑으로 넘어가도 숫자가 남지 않게)
    const s = await readState(); s.n = 0; await writeState(s);
    try { if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (_) {}
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(self.registration.scope);
  })());
});
