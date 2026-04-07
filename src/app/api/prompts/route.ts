import { NextRequest, NextResponse } from 'next/server'
import {
  createTemplate,
  getTemplate,
  listTemplates,
  deleteTemplate,
  renderTemplate,
  getVersionHistory,
  createABTest,
  startABTest,
  recordABResult,
  getABResults,
  listABTests,
} from '@/lib/prompt-studio'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { name, template, description, appSlug, variables, tags, category, systemPrompt } = body
      if (!name || !template) {
        return NextResponse.json({ error: 'name and template required' }, { status: 400 })
      }
      const prompt = await createTemplate({
        name,
        template,
        description: description || '',
        appSlug: appSlug || 'default',
        variables: variables || [],
        tags: tags || [],
        category: category || 'custom',
        systemPrompt,
      })
      return NextResponse.json({ success: true, prompt })
    }

    if (action === 'render') {
      const { templateId, variables } = body
      if (!templateId) {
        return NextResponse.json({ error: 'templateId required' }, { status: 400 })
      }
      const rendered = await renderTemplate(templateId, variables || {})
      if (!rendered) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, rendered })
    }

    if (action === 'create_experiment') {
      const { name, appSlug, variants, trafficSplit, minSamples } = body
      if (!name || !variants?.length) {
        return NextResponse.json(
          { error: 'name and variants required' },
          { status: 400 },
        )
      }
      const experiment = await createABTest({
        name,
        appSlug: appSlug || 'default',
        variants,
        trafficSplit,
        minSamples,
      })
      return NextResponse.json({ success: true, experiment })
    }

    if (action === 'start_experiment') {
      const { testId } = body
      if (!testId) {
        return NextResponse.json({ error: 'testId required' }, { status: 400 })
      }
      const started = await startABTest(testId)
      return NextResponse.json({ success: started })
    }

    if (action === 'record_result') {
      const { testId, variantId, metrics } = body
      if (!testId || !variantId) {
        return NextResponse.json(
          { error: 'testId and variantId required' },
          { status: 400 },
        )
      }
      await recordABResult(testId, variantId, metrics || {})
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { templateId } = body
      if (!templateId) {
        return NextResponse.json({ error: 'templateId required' }, { status: 400 })
      }
      const deleted = await deleteTemplate(templateId)
      return NextResponse.json({ success: deleted })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: create, render, create_experiment, start_experiment, record_result, delete' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prompt operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const templateId = searchParams.get('id')
    const testId = searchParams.get('testId')
    const appSlug = searchParams.get('appSlug') || 'default'

    if (testId) {
      const results = await getABResults(testId)
      return NextResponse.json({ results })
    }

    if (templateId) {
      const template = await getTemplate(templateId)
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      const versions = await getVersionHistory(templateId)
      return NextResponse.json({ template, versions })
    }

    const templates = await listTemplates(appSlug)
    const experiments = await listABTests(appSlug)
    return NextResponse.json({ templates, experiments })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list prompts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
