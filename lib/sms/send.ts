// SMS — ONE door. SMS_PROVIDER=twilio sends by the Twilio REST API (fetch, no
// SDK); anything else (dev, CI, production without a contract) logs WITHOUT
// the code. Never throws to the caller's user: returns the status.
export type SmsStatus = 'SENT' | 'LOGGED' | 'FAILED'

export async function sendSms(to: string, text: string, redactedPreview = ''): Promise<SmsStatus> {
  const provider = (process.env.SMS_PROVIDER ?? 'mock').trim().toLowerCase()
  if (provider !== 'twilio') {
    console.log(`[sms] (${provider}) para ${to.slice(0, 6)}…: ${redactedPreview}`)
    if (process.env.NODE_ENV !== 'production' && process.env.SMS_ECHO === '1') console.log(text)
    return 'LOGGED'
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim(), token = process.env.TWILIO_AUTH_TOKEN?.trim(), from = process.env.TWILIO_FROM?.trim()
  if (!sid || !token || !from) { console.error('[sms] twilio sem TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM'); return 'FAILED' }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) { console.error('[sms] twilio respondeu', res.status); return 'FAILED' }
    return 'SENT'
  } catch (e) {
    console.error('[sms] falha ao enviar:', e instanceof Error ? e.name : e)
    return 'FAILED'
  }
}
