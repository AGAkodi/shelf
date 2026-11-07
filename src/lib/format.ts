/** Two-letter initials from an email's local part, used for the account avatar. */
export function initials(email: string | undefined) {
  const name = (email ?? '').split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim()
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?'
}

const dayMs = 86400000

/** Whole days left until `expires`, measured against `now` (server time when available). */
export function daysLeft(expires: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(expires) - now) / dayMs))
}

export function timeLeftLabel(expires: string, now: number) {
  const ms = Date.parse(expires) - now
  if (ms <= 0) return 'Ended'
  if (ms < dayMs) {
    const hours = Math.max(1, Math.ceil(ms / 3600000))
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`
  }
  const days = daysLeft(expires, now)
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
