const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data', 'links.json');

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const save = (d) => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

function parseUA(ua = '') {
  const device = /tablet|ipad/i.test(ua) ? 'Tablet' : /mobi|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop';
  const os = /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera'
    : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Other';
  return { device, os, browser };
}

const base = (req) => `${req.protocol}://${req.get('host')}`;
const tally = (arr, key) => arr.reduce((o, x) => ((o[x[key]] = (o[x[key]] || 0) + 1), o), {});

// Short link banao
app.post('/api/shorten', (req, res) => {
  let url = (req.body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: 'Enter a valid link, for example https://example.com' }); }
  const db = load();
  const code = crypto.randomBytes(5).toString('base64url').slice(0, 6);
  db[code] = { url, created: Date.now(), clicks: 0, visitors: [], log: [] };
  save(db);
  res.json({ code, short: `${base(req)}/${code}` });
});

// Saare links + summary
app.get('/api/links', (req, res) => {
  const db = load();
  res.json(Object.entries(db).map(([code, l]) => ({
    code, url: l.url, short: `${base(req)}/${code}`, created: l.created,
    clicks: l.clicks, visits: l.visitors.length
  })).sort((a, b) => b.created - a.created));
});

// Ek link ki detailed stats
app.get('/api/links/:code', (req, res) => {
  const l = load()[req.params.code];
  if (!l) return res.status(404).json({ error: 'Not found' });
  res.json({
    url: l.url, clicks: l.clicks, visits: l.visitors.length,
    devices: tally(l.log, 'device'), os: tally(l.log, 'os'), browsers: tally(l.log, 'browser'),
    recent: l.log.slice(-15).reverse()
  });
});

// Redirect + tracking
app.get('/:code([A-Za-z0-9_-]{6})', (req, res) => {
  const db = load();
  const l = db[req.params.code];
  if (!l) return res.status(404).send('Link not found');
  const ua = req.get('user-agent') || '';
  const vid = crypto.createHash('sha256').update(req.ip + ua).digest('hex').slice(0, 16);
  l.clicks++;
  if (!l.visitors.includes(vid)) l.visitors.push(vid);
  l.log.push({ time: Date.now(), ...parseUA(ua), referrer: req.get('referer') || 'Direct' });
  if (l.log.length > 200) l.log.shift();
  save(db);
  res.redirect(l.url);
});

app.listen(PORT, () => console.log(`LinkTrack is running at: http://localhost:${PORT}`));
