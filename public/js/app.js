const $ = (id) => document.getElementById(id);
const input = $('urlInput');
let openCode = null;
let toastTimer;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(ts).toLocaleDateString();
}

async function shorten() {
  $('error').textContent = '';
  const url = input.value.trim();
  if (!url) return ($('error').textContent = 'Paste a link first.');
  $('shortenBtn').disabled = true;
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) return ($('error').textContent = data.error);
    $('shortLink').textContent = $('shortLink').href = data.short;
    $('result').classList.remove('hidden');
    input.value = '';
    loadLinks();
  } catch {
    $('error').textContent = 'Could not reach the server. Check your connection and try again.';
  } finally {
    $('shortenBtn').disabled = false;
  }
}

async function loadLinks() {
  const links = await (await fetch('/api/links')).json();
  $('empty').classList.toggle('hidden', links.length > 0);
  $('links').innerHTML = links.map((l) => `
    <div class="row ${l.code === openCode ? 'active' : ''}" tabindex="0" data-code="${esc(l.code)}">
      <div class="info"><div class="s">${esc(l.short.replace(/^https?:\/\//, ''))}</div><div class="o">${esc(l.url)}</div></div>
      <div class="nums"><span>${l.clicks}</span><span>${l.visits}</span></div>
    </div>`).join('');
  if (openCode) loadStats(openCode);
}

function bars(obj) {
  const total = Object.values(obj).reduce((a, b) => a + b, 0);
  if (!total) return '<p class="muted">No data yet</p>';
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
    `<div class="bar-row"><span>${esc(k)}</span><span>${Math.round((v / total) * 100)}%</span></div>
     <div class="track"><i style="width:${(v / total) * 100}%"></i></div>`).join('');
}

async function loadStats(code) {
  openCode = code;
  const res = await fetch('/api/links/' + code);
  if (!res.ok) return;
  const s = await res.json();
  $('stats').classList.remove('hidden');
  $('statCode').textContent = '/' + code;
  $('statUrl').textContent = s.url;
  $('sClicks').textContent = s.clicks;
  $('sVisits').textContent = s.visits;
  $('devices').innerHTML = bars(s.devices);
  $('os').innerHTML = bars(s.os);
  $('browsers').innerHTML = bars(s.browsers);
  $('recent').innerHTML = s.recent.length
    ? s.recent.map((r) => `<tr><td>${ago(r.time)}</td><td>${esc(r.device)}</td><td>${esc(r.os)}</td><td>${esc(r.browser)}</td><td>${esc(r.referrer)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">Nobody has opened this link yet.</td></tr>';
}

function select(row) {
  if (!row) return;
  openCode = row.dataset.code;
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('active', r === row));
  loadStats(openCode);
  $('stats').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('shortenBtn').onclick = shorten;
input.addEventListener('keydown', (e) => e.key === 'Enter' && shorten());

// Paste button (needs HTTPS, which Render provides)
$('pasteBtn').onclick = async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) return toast('Your clipboard is empty');
    input.value = text;
    input.focus();
  } catch {
    input.focus();
    toast('Allow clipboard access, or press Ctrl + V');
  }
};

// Ctrl + V anywhere on the page fills the input
document.addEventListener('paste', (e) => {
  if (document.activeElement === input) return;
  const text = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim();
  if (!text) return;
  input.value = text;
  input.focus();
  toast('Link pasted. Press Enter to shorten.');
});

$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText($('shortLink').href); toast('Link copied'); }
  catch { toast('Copy failed. Select the link and press Ctrl + C'); }
};

$('links').onclick = (e) => select(e.target.closest('.row'));
$('links').onkeydown = (e) => { if (e.key === 'Enter') select(e.target.closest('.row')); };
$('closeStats').onclick = () => {
  openCode = null;
  $('stats').classList.add('hidden');
  document.querySelectorAll('.row').forEach((r) => r.classList.remove('active'));
};

loadLinks();
setInterval(loadLinks, 5000);
