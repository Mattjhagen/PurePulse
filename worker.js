/**
 * PurePulse Lead Worker
 * POST /api/leads — stores in Supabase, emails via Resend
 * Deploy to: Cloudflare Workers
 * Env vars needed:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const { name, email, project, plan } = body

    if (!name || !email) {
      return json({ error: 'Name and email are required' }, 400)
    }

    // 1. Store in Supabase
    const supaRes = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name,
        email,
        project: project || '',
        plan: plan || 'not_sure',
        created_at: new Date().toISOString(),
        status: 'new',
      }),
    })

    if (!supaRes.ok) {
      const err = await supaRes.text()
      console.error('Supabase error:', err)
      return json({ error: 'Failed to save lead' }, 500)
    }

    // 2. Email YOU (notification)
    await sendEmail(env.RESEND_API_KEY, {
      from: 'PurePulse Leads <leads@purepulse.one>',
      to: 'matty@purepulse.one',
      subject: `New lead: ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#7B2FFF">New consultation request</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:600;width:120px">Name</td><td style="padding:8px">${esc(name)}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:600">Email</td><td style="padding:8px"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
            <tr><td style="padding:8px;font-weight:600">Plan</td><td style="padding:8px">${esc(plan || 'Not sure yet')}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:600;vertical-align:top">Project</td><td style="padding:8px">${esc(project || '—')}</td></tr>
          </table>
          <p style="margin-top:24px">
            <a href="https://login.purepulse.one/leads" style="background:#7B2FFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              View in Dashboard →
            </a>
          </p>
        </div>
      `,
    })

    // 3. Email THE CLIENT (confirmation)
    await sendEmail(env.RESEND_API_KEY, {
      from: 'Matty at PurePulse <matty@purepulse.one>',
      to: email,
      subject: `Got it, ${name.split(' ')[0]} — talk soon`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
          <div style="background:#07070D;padding:24px 32px;border-radius:12px 12px 0 0">
            <span style="font-size:20px;font-weight:800;color:#fff">Pure<span style="color:#A066FF">Pulse</span></span>
          </div>
          <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <h2 style="margin-top:0">Hey ${esc(name.split(' ')[0])}, we got your request.</h2>
            <p style="color:#555;line-height:1.7">
              Thanks for reaching out. I'll review what you shared and get back to you within one business day.
              No pressure, no pitch — just a real conversation about what you need.
            </p>
            ${project ? `
            <div style="background:#f9f9f9;border-left:3px solid #7B2FFF;padding:12px 16px;margin:24px 0;border-radius:0 8px 8px 0">
              <p style="margin:0;font-size:14px;color:#555;font-style:italic">"${esc(project)}"</p>
            </div>` : ''}
            <p style="color:#555;line-height:1.7">
              In the meantime, feel free to browse our
              <a href="https://purepulse.one/home.html#pricing" style="color:#7B2FFF">pricing plans</a>
              or check out some of our
              <a href="https://purepulse.one/home.html#portfolio" style="color:#7B2FFF">recent work</a>.
            </p>
            <p style="color:#555">— Matty<br><span style="font-size:13px;color:#999">PurePulse · Web Design & Development</span></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="font-size:12px;color:#999;margin:0">
              You're receiving this because you submitted a consultation request at
              <a href="https://purepulse.one" style="color:#999">purepulse.one</a>.
            </p>
          </div>
        </div>
      `,
    })

    return json({ success: true })
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendEmail(apiKey, { from, to, subject, html }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
    }
  } catch (e) {
    console.error('sendEmail failed:', e)
  }
}
