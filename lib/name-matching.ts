function normalizedNameTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['\u2019\u0060]/g, '')
    .split(/[^\p{Letter}\p{Number}]+/gu)
    .filter(Boolean)
}

export function normalizeFootballName(value: string): string {
  return normalizedNameTokens(value).join('')
}

export function footballNamesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeFootballName(left)
  const normalizedRight = normalizeFootballName(right)
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      )
    }

    previous = current
  }

  return previous[right.length]
}

function fuzzyCompactMatch(left: string, right: string): boolean {
  const shorterLength = Math.min(left.length, right.length)
  const longerLength = Math.max(left.length, right.length)

  if (shorterLength < 5 || longerLength - shorterLength > 2) return false

  const allowedDistance = longerLength >= 10 ? 2 : 1
  return editDistance(left, right) <= allowedDistance
}

function fuzzyFullNameMatch(left: string, right: string): boolean {
  const shorterLength = Math.min(left.length, right.length)
  const longerLength = Math.max(left.length, right.length)

  if (shorterLength < 8 || longerLength - shorterLength > 3) return false

  const allowedDistance = longerLength >= 12 ? 3 : 2
  return editDistance(left, right) <= allowedDistance
}

/**
 * Matches a free-text scorer prediction against an official API/admin name.
 * It accepts reordered names, a single full-name component, and small
 * dictation/spelling errors while remaining strict for short names.
 */
export function topScorerNamesMatch(left: string, right: string): boolean {
  const leftTokens = normalizedNameTokens(left)
  const rightTokens = normalizedNameTokens(right)
  if (!leftTokens.length || !rightTokens.length) return false

  const normalizedLeft = leftTokens.join('')
  const normalizedRight = rightTokens.join('')
  if (normalizedLeft === normalizedRight) return true

  const sortedLeft = [...leftTokens].sort().join('')
  const sortedRight = [...rightTokens].sort().join('')
  if (sortedLeft === sortedRight) return true

  const leftIsSingleName = leftTokens.length === 1
  const rightIsSingleName = rightTokens.length === 1
  if (
    leftIsSingleName && rightIsSingleName
      ? fuzzyCompactMatch(normalizedLeft, normalizedRight)
      : fuzzyFullNameMatch(normalizedLeft, normalizedRight)
  ) {
    return true
  }

  if (!leftIsSingleName && !rightIsSingleName) return false

  const singleName = leftIsSingleName ? leftTokens[0] : rightTokens[0]
  const fullNameTokens = leftIsSingleName ? rightTokens : leftTokens

  return fullNameTokens.some(token =>
    token === singleName || fuzzyCompactMatch(token, singleName)
  )
}
