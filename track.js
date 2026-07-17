// Vercel Node serverless function: /api/track
// Receives a visit summary (text/plain JSON) and emails it via Brevo.
module.exports = async function handler(req, res) {
  // Open CORS so the browser can post from the site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read raw body (sent as text/plain to avoid a CORS preflight)
  let raw = '';
  try {
    if (typeof req.body === 'string') raw = req.body;
    else if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
    else raw = await new Promise((resolve, reject) => {
      let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d)); req.on('error', reject);
    });
  } catch (e) { raw = ''; }

  let d = {};
  try { d = JSON.parse(raw || '{}'); } catch (e) { d = {}; }

  const KEY = process.env.BREVO_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'BREVO_API_KEY environment variable not set' });

  const SENDER = process.env.SENDER_EMAIL || 'jaun.husselmann@gmail.com';
  const TO = process.env.NOTIFY_EMAIL || 'jaun.husselmann@gmail.com';

  const esc = s => String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const row = (k, v) => `<tr><td style="padding:6px 12px;color:#666;font:13px sans-serif">${esc(k)}</td>` +
    `<td style="padding:6px 12px;font:13px sans-serif;color:#111"><b>${esc(v)}</b></td></tr>`;

  const html =
    `<div style="font-family:sans-serif">
      <h2 style="color:#8C122B;margin:0 0 12px">Visitor left a page</h2>
      <table style="border-collapse:collapse;background:#faf7f4;border-radius:8px">
        ${row('Page', d.page_name)}
        ${row('Time on page', d.time_spent)}
        ${row('Seconds', d.seconds)}
        ${row('Location', d.visitor_location)}
        ${row('Country', d.country)}
        ${row('Traffic source', d.source)}
        ${row('Page URL', d.page_link)}
        ${row('Fired on', d.reason)}
        ${row('Timestamp', d.timestamp)}
      </table>
    </div>`;

  const payload = {
    sender: { name: 'NCR Rate Sheet', email: SENDER },
    to: [{ email: TO }],
    subject: `Visit · ${d.page_name || 'page'} · ${d.time_spent || ''} · ${d.country || ''}`.trim(),
    htmlContent: html,
  };

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': KEY, 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await r.text();
    if (!r.ok) return res.status(502).json({ error: 'brevo_error', status: r.status, detail: txt });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'send_failed', detail: String(e) });
  }
};
