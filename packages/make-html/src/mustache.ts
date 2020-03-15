export function ankiMustache (s: string, d?: Record<string, any>, front: string = ''): string {
  d = d || []
  s = s.replace(/{{FrontSide}}/g, front.replace(/@html\n/g, ''))

  for (const [k, v] of Object.entries(d)) {
    s = s.replace(
      new RegExp(`{{(\\S+:)?${escapeRegExp(k)}}}`, 'g'),
      v.replace(/^@[^\n]+\n/gs, ''),
    )
  }

  const keys = Object.keys(d)

  s = s.replace(/{{#(\S+)}}([^]*){{\1}}/gs, (m, p1, p2) => {
    return keys.includes(p1) ? p2 : ''
  })

  s = s.replace(/{{[^}]+}}/g, '')

  return s
}

function escapeRegExp (s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}
