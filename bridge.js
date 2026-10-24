/* Defold Lua talks synchronously to this queue; Rust runs off the render thread. */
(function () {
  'use strict';
  const workerURL = new URL('./worker.js', document.currentScript.src);
  const entries = new Map();
  const lifetime = 60000;
  let sequence = 0;
  let worker = null;
  let failed = false;
  const failure = JSON.stringify({status:503,response:JSON.stringify({error:'Browser game engine could not load. Check your connection and reload the page.'})});
  function prune() {
    const now = Date.now();
    for (const [id, entry] of entries) if (entry.expires <= now) entries.delete(id);
  }
  function getWorker() {
    if (worker) return worker;
    worker = new Worker(workerURL, {type:'module'});
    worker.onmessage = function (event) {
      prune();
      const data = event.data;
      if (!data || typeof data.id !== 'number' || typeof data.result !== 'string') return;
      const entry = entries.get(data.id);
      if (entry) entry.result = data.result;
    };
    worker.onerror = function (event) {
      if (event.preventDefault) event.preventDefault();
      failed = true;
      prune();
      for (const entry of entries.values()) entry.result = failure;
    };
    return worker;
  }
  window.BoardroomLocal = Object.freeze({
    request(method, path, body, token) {
      prune();
      if (entries.size >= 128) throw new Error('Too many pending game requests. Please retry.');
      const id = ++sequence;
      const entry = {expires:Date.now()+lifetime, result:failed ? failure : ''};
      entries.set(id, entry);
      if (!failed) {
        try { getWorker().postMessage({id,method,path,body:body || '',token:token || ''}); }
        catch (_) { failed = true; entry.result = failure; }
      }
      return id;
    },
    poll(id) {
      prune();
      const entry = entries.get(id);
      if (!entry || !entry.result) return '';
      entries.delete(id);
      return entry.result;
    },
    cancel(id) { entries.delete(id); }
  });
})();
