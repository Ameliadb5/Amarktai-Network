import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getAllSkillTemplates,
  getTemplatesByCategory,
  getSkillTemplate,
  getTemplateSummary,
  type TemplateCategory,
} from '@/lib/skill-templates'

/**
 * GET /api/admin/skill-templates
 *
 * Query params:
 *   id       - get a single template by ID
 *   category - filter by category
 *   launchReady - return only launch-ready templates (any truthy value)
 *   summary  - return summary stats only
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const category = searchParams.get('category') as TemplateCategory | null
  const launchReadyOnly = searchParams.has('launchReady')
  const summaryOnly = searchParams.has('summary')

  if (summaryOnly) {
    return NextResponse.json({ summary: getTemplateSummary() })
  }

  if (id) {
    const template = getSkillTemplate(id)
    if (!template) {
      return NextResponse.json({ error: `Template not found: ${id}` }, { status: 404 })
    }
    return NextResponse.json({ template })
  }

  let templates = category
    ? getTemplatesByCategory(category)
    : getAllSkillTemplates()

  if (launchReadyOnly) {
    templates = templates.filter((t) => t.launchReady)
  }

  return NextResponse.json({
    templates,
    count: templates.length,
    summary: getTemplateSummary(),
  })
}
