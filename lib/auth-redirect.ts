export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export function withNext(path: string, next: string): string {
  const safeNext = safeNextPath(next)
  return `${path}?next=${encodeURIComponent(safeNext)}`
}
