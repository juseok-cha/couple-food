const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function toNumber(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isLatitude(value: number | null) {
  return value != null && Math.abs(value) <= 90
}

function isLongitude(value: number | null) {
  return value != null && Math.abs(value) <= 180
}

function pairFromValues(
  first: string | null | undefined,
  second: string | null | undefined,
  firstIsLat = true,
) {
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

function extractByParams(url: URL) {
  const lat = url.searchParams.get('lat') || url.searchParams.get('latitude') || url.searchParams.get('y')
  const lng = url.searchParams.get('lng') || url.searchParams.get('lon') || url.searchParams.get('longitude') || url.searchParams.get('x')

  if (lat && lng) {
    return pairFromValues(lat, lng, true)
  }

  const center = url.searchParams.get('c') || url.searchParams.get('center')
  if (center) {
    const values = center.split(',').map((part) => part.trim())
    return pairFromValues(values[0], values[1], false) || pairFromValues(values[0], values[1], true)
  }

  return null
}

function extractByPath(pathname: string) {
  const chunks = pathname
    .split('/')
    .flatMap((segment) => segment.split(','))
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (let i = 0; i < chunks.length - 1; i += 1) {
    const direct = pairFromValues(chunks[i], chunks[i + 1], true)
    if (direct) return direct

    const swapped = pairFromValues(chunks[i], chunks[i + 1], false)
    if (swapped) return swapped
  }

  return null
}

function extractByRegex(text: string) {
  const matches = text.match(/-?\d+\.\d+/g) || []

  for (let i = 0; i < matches.length - 1; i += 1) {
    const direct = pairFromValues(matches[i], matches[i + 1], true)
    if (direct) return direct

    const swapped = pairFromValues(matches[i], matches[i + 1], false)
    if (swapped) return swapped
  }

  return null
}

function parseSupportedMapUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  const host = url.hostname.replace(/^www\./, '')
  const supported =
    host.includes('naver.com') ||
    host.includes('naver.me') ||
    host.includes('kakao.com') ||
    host.includes('kakao.to')

  if (!supported) {
    return null
  }

  return (
    extractByParams(url) ||
    extractByPath(url.pathname) ||
    extractByRegex(`${url.pathname}${url.search}${url.hash}`)
  )
}

async function followShortLink(rawUrl: string) {
  const response = await fetch(rawUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'CoupleFoodBot/1.0',
    },
  })

  const finalUrl = response.url || rawUrl
  const text = response.headers.get('content-type')?.includes('text/html')
    ? await response.text()
    : ''

  return { finalUrl, html: text }
}

async function searchPlace(query: string, x?: number | null, y?: number | null) {
  const restKey = Deno.env.get('KAKAO_REST_API_KEY')
  if (!restKey || !query) return null

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
  url.searchParams.set('query', query)

  if (x != null && y != null) {
    url.searchParams.set('x', String(x))
    url.searchParams.set('y', String(y))
    url.searchParams.set('sort', 'distance')
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${restKey}`,
    },
  })

  if (!response.ok) return null

  const payload = await response.json()
  const first = payload.documents?.[0]
  if (!first) return null

  return {
    latitude: Number(first.y),
    longitude: Number(first.x),
    placeName: first.place_name || null,
    location: first.road_address_name || first.address_name || null,
    mapUrl: first.place_url || null,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mapUrl, placeName, location } = await request.json()

    if (!mapUrl) {
      return json({ mapUrl: null, latitude: null, longitude: null })
    }

    let resolvedUrl = mapUrl
    let coordinates = parseSupportedMapUrl(mapUrl)
    let html = ''

    if (!coordinates) {
      try {
        const followed = await followShortLink(mapUrl)
        resolvedUrl = followed.finalUrl
        html = followed.html
        coordinates =
          parseSupportedMapUrl(followed.finalUrl) ||
          extractByRegex(html)
      } catch {
        resolvedUrl = mapUrl
      }
    }

    let placeResult = null

    if (!coordinates) {
      const query = [placeName, location].filter(Boolean).join(' ').trim()
      if (query) {
        placeResult = await searchPlace(query)
        if (!placeResult && placeName) {
          placeResult = await searchPlace(placeName)
        }

        if (placeResult) {
          coordinates = {
            latitude: placeResult.latitude,
            longitude: placeResult.longitude,
          }
          resolvedUrl = placeResult.mapUrl || resolvedUrl
        }
      }
    }

    return json({
      mapUrl: resolvedUrl,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      placeName: placeResult?.placeName ?? null,
      location: placeResult?.location ?? null,
    })
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'unexpected_error',
    }, 500)
  }
})
