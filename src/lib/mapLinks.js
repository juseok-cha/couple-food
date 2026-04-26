function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isLatitude(value) {
  return value != null && Math.abs(value) <= 90
}

function isLongitude(value) {
  return value != null && Math.abs(value) <= 180
}

function pairFromValues(first, second, firstIsLat = true) {
  const a = toNumber(first)
  const b = toNumber(second)

  if (firstIsLat && isLatitude(a) && isLongitude(b)) {
    return { latitude: a, longitude: b }
  }

  if (!firstIsLat && isLongitude(a) && isLatitude(b)) {
    return { latitude: b, longitude: a }
  }

  return null
}

function extractByParams(url) {
  const lat = url.searchParams.get('lat') || url.searchParams.get('latitude') || url.searchParams.get('y')
  const lng = url.searchParams.get('lng') || url.searchParams.get('lon') || url.searchParams.get('longitude') || url.searchParams.get('x')

  if (lat && lng) {
    return pairFromValues(lat, lng, true)
  }

  const center = url.searchParams.get('c') || url.searchParams.get('center')
  if (center) {
    const values = center.split(',').map((part) => part.trim())

    return (
      pairFromValues(values[0], values[1], false) ||
      pairFromValues(values[0], values[1], true)
    )
  }

  return null
}

function extractByPath(pathname) {
  const kakaoLinkChunk = pathname.split('/').find((segment) => segment.includes(','))
  if (kakaoLinkChunk) {
    const values = kakaoLinkChunk.split(',').map((part) => part.trim())
    const numbers = values.filter((value) => /^-?\d+(\.\d+)?$/.test(value))

    if (numbers.length >= 2) {
      return (
        pairFromValues(numbers[numbers.length - 2], numbers[numbers.length - 1], true) ||
        pairFromValues(numbers[numbers.length - 2], numbers[numbers.length - 1], false)
      )
    }
  }

  return null
}

function extractByRegex(text) {
  const matches = text.match(/-?\d+\.\d+/g) || []

  for (let i = 0; i < matches.length - 1; i += 1) {
    const direct = pairFromValues(matches[i], matches[i + 1], true)
    if (direct) return direct

    const swapped = pairFromValues(matches[i], matches[i + 1], false)
    if (swapped) return swapped
  }

  return null
}

export function parseMapLink(rawUrl) {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { ok: true, latitude: null, longitude: null, normalizedUrl: null }
  }

  let url

  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: '올바른 네이버/카카오맵 링크를 붙여 주세요.' }
  }

  const host = url.hostname.replace(/^www\./, '')
  const supported =
    host.includes('naver.com') ||
    host.includes('naver.me') ||
    host.includes('kakao.com') ||
    host.includes('kakao.to')

  if (!supported) {
    return { ok: false, error: '네이버지도나 카카오맵 링크를 붙여 주세요.' }
  }

  const extracted =
    extractByParams(url) ||
    extractByPath(url.pathname) ||
    extractByRegex(`${url.pathname}${url.search}${url.hash}`)

  if (!extracted) {
    return {
      ok: false,
      error: '링크에서 위치를 읽지 못했어요. 공유용 전체 지도 링크를 다시 붙여 주세요.',
    }
  }

  return {
    ok: true,
    latitude: extracted.latitude,
    longitude: extracted.longitude,
    normalizedUrl: url.toString(),
  }
}
