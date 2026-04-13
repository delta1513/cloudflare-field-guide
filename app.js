const routes = {
  '/':               'content/home.md',
  '/r2':             'content/r2.md',
  '/containers':     'content/containers.md',
  '/workers':        'content/workers.md',
  '/pages':          'content/pages.md',
  '/d1':             'content/d1.md',
  '/kv':             'content/kv.md',
  '/durable-objects': 'content/durable-objects.md',
  '/workers-ai':      'content/workers-ai.md',
  '/ai-gateway':      'content/ai-gateway.md',
  '/vectorize':       'content/vectorize.md',
  '/ddos':            'content/ddos.md',
  '/ai-agents':       'content/ai-agents.md',
  '/dns':             'content/dns.md',
  '/waf':             'content/waf.md',
  '/cdn':             'content/cdn.md',
  '/tunnel':          'content/tunnel.md',
  '/gateway':         'content/gateway.md',
  '/access':          'content/access.md',
};

const STUB = (name) => `# ${name}\n\nThis page is coming soon.\n`;

async function loadPage(path) {
  const article = document.getElementById('content');
  const file = routes[path];

  article.innerHTML = '<div class="loading">Loading\u2026</div>';

  let text;
  if (!file) {
    text = STUB(path.replace('/', '').replace(/-/g, ' '));
  } else {
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error('not found');
      text = await res.text();
    } catch {
      text = STUB(path.replace('/', '').replace(/-/g, ' '));
    }
  }

  article.innerHTML = marked.parse(text);

  // Scroll to top
  window.scrollTo(0, 0);

  // Update active nav link
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href').replace(/^#/, '');
    a.classList.toggle('active', href === path || (path === '/' && href === '/'));
  });
}

function currentPath() {
  const hash = location.hash.replace(/^#/, '').trim();
  return hash || '/';
}

window.addEventListener('hashchange', () => loadPage(currentPath()));
window.addEventListener('DOMContentLoaded', () => loadPage(currentPath()));
