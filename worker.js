import init, {LocalBackend} from './rules/boardroom_web_rules.js';

const backend = init().then(() => new LocalBackend());
self.onmessage = async (event) => {
  const {id, method, path, body, token} = event.data || {};
  if (typeof id !== 'number') return;
  try {
    const engine = await backend;
    const result = engine.request(method, path, body || '', token || '');
    self.postMessage({id, result});
  } catch (_) {
    self.postMessage({id, result:JSON.stringify({status:503, response:JSON.stringify({
      error:'Browser game rules could not start. Check your connection and reload the page.'
    })})});
  }
};
