// Autoteste do app desktop (só em builds de desenvolvimento: `npm run tauri:dev`).
// Valida os riscos do spike da migração e manda o resultado para o processo Rust, que o
// imprime no terminal como "[selfcheck] {...}" (ver site_server.rs).
(() => {
  if (location.origin !== 'https://simulador.latam-tools.com.br' || window.top !== window) return;
  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const describe = async res => `${res.status} ${res.headers.get('content-type') || ''} ${(await res.text()).slice(0, 60).replace(/\s+/g, ' ')}`;
  const check = async (name, fn) => { try { return [name, await withTimeout(fn(), 8000)]; } catch (e) { return [name, `ERRO ${e && e.message || e}`]; } };

  const run = async () => {
    const runs = Number(localStorage.getItem('roDesktop:selfcheckRuns') || 0) + 1;
    localStorage.setItem('roDesktop:selfcheckRuns', String(runs));
    const results = await Promise.all([
      check('1_origem', async () => `${location.origin} painel=${!!document.querySelector('script[src="/optimizer/panel.js"]')} roDesktop=${JSON.stringify(window.roDesktop)}`),
      check('2_worker', () => new Promise(resolve => {
        const worker = new Worker('/optimizer/worker.js', { type: 'module' });
        worker.onerror = e => resolve(`ERRO ${e.message || 'falhou ao carregar'}`);
        setTimeout(() => { worker.terminate(); resolve('carregou'); }, 3000);
      })),
      check('3_cors_assets', async () => describe(await fetch('https://assets.latam-tools.com.br/image?job=1002&action=0'))),
      check('3_cors_short', async () => describe(await fetch('https://short.latam-tools.com.br/'))),
      check('3_cors_issues', async () => describe(await fetch('https://issues.latam-tools.com.br/'))),
      check('4_mcp', async () => describe(await fetch('/mcp'))),
      check('4_api', async () => describe(await fetch('/api/'))),
      check('5_localStorage', async () => `execucoes=${runs} chaves=${localStorage.length}`),
      check('6_share', async () => {
        const res = await fetch('/s/N4IgzglgNjBiB7AT.gWwK4wIYDUC/', { headers: { accept: 'text/html' } });
        return `${res.status} spa=${(await res.text()).includes('/optimizer/panel.js')}`;
      }),
    ]);
    fetch('/__desktop/selfcheck?r=' + encodeURIComponent(JSON.stringify(Object.fromEntries(results))));
  };
  window.addEventListener('load', () => setTimeout(run, 1500), { once: true });
})();
