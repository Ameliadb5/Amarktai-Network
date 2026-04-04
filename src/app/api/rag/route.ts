import { NextRequest, NextResponse } from 'next/server'
import {
  ingestDocument,
  retrieve,
  getRAGHealth,
  type Document,
} from '@/lib/rag-pipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'ingest') {
      const { documents } = body
      if (!documents?.length) {
        return NextResponse.json({ error: 'documents array required' }, { status: 400 })
      }
      const results = await Promise.all(
        (documents as Document[]).map((doc: Document) => ingestDocument(doc)),
      )
      return NextResponse.json({ success: true, results })
    }

    if (action === 'query') {
      const { query, namespace, topK } = body
      if (!query) {
        return NextResponse.json({ error: 'query required' }, { status: 400 })
      }
      const context = await retrieve(query, namespace, topK)
      return NextResponse.json({ success: true, context })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: ingest, query' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RAG operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const health = await getRAGHealth()
    return NextResponse.json({ health })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get RAG stats'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
