// Space-Worx contact form handler
// Deploy to Cloudflare Workers, then set these two secrets in the dashboard:
//   RESEND_API_KEY  — your Resend API key
//   TO_EMAIL        — the inbox that receives submissions (can be multiple, see below)

const CORS = {
  'Access-Control-Allow-Origin': '*',   // tighten to your domain once live
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const to = (env.TO_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);
    if (!to.length) return json({ error: 'TO_EMAIL not configured' }, 500);

    let subject, html;

    if (data.type === 'booking') {
      subject = `Tour Request — ${data.fname} ${data.lname} · ${data.date} at ${data.time}`;
      html = `
        <h2 style="font-family:sans-serif;color:#1a1713">New Tour Request</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:6px 16px 6px 0;color:#888;white-space:nowrap">Name</td><td style="padding:6px 0"><strong>${data.fname} ${data.lname}</strong></td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Phone</td><td style="padding:6px 0">${data.phone || '—'}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Date</td><td style="padding:6px 0">${data.date}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Time</td><td style="padding:6px 0">${data.time}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Interest</td><td style="padding:6px 0">${data.interest || '—'}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888;vertical-align:top">Notes</td><td style="padding:6px 0">${data.notes || '—'}</td></tr>
        </table>`;
    } else if (data.type === 'contact') {
      subject = `Message from ${data.fname} ${data.lname}${data.topic ? ' — ' + data.topic : ''}`;
      html = `
        <h2 style="font-family:sans-serif;color:#1a1713">New Contact Message</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:6px 16px 6px 0;color:#888;white-space:nowrap">Name</td><td style="padding:6px 0"><strong>${data.fname} ${data.lname}</strong></td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Email</td><td style="padding:6px 0"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Phone</td><td style="padding:6px 0">${data.phone || '—'}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888">Topic</td><td style="padding:6px 0">${data.topic || '—'}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#888;vertical-align:top">Message</td><td style="padding:6px 0;white-space:pre-wrap">${data.msg}</td></tr>
        </table>`;
    } else {
      return json({ error: 'Unknown form type' }, 400);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'Space-Worx <noreply@spaceworx.com>',
        to,
        reply_to: data.email,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return json({ error: 'Email delivery failed' }, 500);
    }

    return json({ ok: true });
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
