import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getStorageDriver } from '@/lib/storage-driver'

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  pdf: 'application/pdf',
}

function guessContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key } = await params
  const raw = Array.isArray(key) ? key.join('/') : ''
  const decodedKey = decodeURIComponent(raw)
  if (!decodedKey) {
    return NextResponse.json({ error: 'File key is required' }, { status: 400 })
  }

  const driver = getStorageDriver()
  const data = await driver.get(decodedKey)
  if (!data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': guessContentType(decodedKey),
      'Cache-Control': 'private, max-age=300',
    },
  })
}
