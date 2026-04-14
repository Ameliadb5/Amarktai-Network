/**
 * @module skill-templates
 * @description Pre-built AI workflow skill templates for AmarktAI Network.
 *
 * Each template is a named, ready-to-instantiate workflow definition that
 * can be submitted directly to the workflow engine (`createWorkflow`) or
 * run ad-hoc via the /api/admin/skill-templates API.
 *
 * Templates are organised into the capability buckets from the AmarktAI
 * feature catalog:
 *
 *   1. Developer / Engineering Automation
 *   2. Productivity / Personal Operations
 *   3. Content & Media
 *   4. Integrations / Messaging / Cross-Platform
 *   5. Multi-Agent / Team Assistants
 *   6. Automation Workflows
 *   7. Smart Home / Device (framework-ready stubs)
 *
 * Server-side only.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type TemplateCategory =
  | 'developer'
  | 'productivity'
  | 'content'
  | 'integration'
  | 'multi_agent'
  | 'automation'
  | 'smart_home'

export interface SkillTemplateStep {
  id: string
  type: 'input' | 'ai_completion' | 'transform' | 'condition' | 'webhook' | 'output'
  name: string
  /** AI prompt template — supports {variable} interpolation */
  prompt?: string
  config: Record<string, unknown>
  next?: string
  branches?: Array<{ condition: string; stepId: string }>
}

export interface SkillTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  /** High-level tags for search / filtering */
  tags: string[]
  /** Which AI capabilities this template uses */
  requiredCapabilities: string[]
  /** Whether this template requires external service credentials */
  requiresExternalService: boolean
  /** Label for the external service if required */
  externalServiceLabel?: string
  /** If true, this template is ready to run with only AI credentials */
  launchReady: boolean
  /** Step definitions — passed directly to workflow engine */
  steps: SkillTemplateStep[]
  entryStepId: string
  /** Example input payload */
  exampleInput: Record<string, unknown>
}

// ── Template Registry ─────────────────────────────────────────────────────────

const SKILL_TEMPLATES: SkillTemplate[] = [
  // ── 1. DEVELOPER / ENGINEERING AUTOMATION ──────────────────────────────────

  {
    id: 'code-review-assistant',
    name: 'Code Review Assistant',
    description:
      'Paste a code diff or PR description and receive a structured review: bugs, improvements, security issues, and style suggestions.',
    category: 'developer',
    tags: ['code', 'github', 'pr', 'review', 'developer'],
    requiredCapabilities: ['coding', 'code_review'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { code: 'function add(a, b) { return a + b }', language: 'javascript' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Code Input',
        config: { fields: ['code', 'language', 'context'] },
        next: 'review',
      },
      {
        id: 'review',
        type: 'ai_completion',
        name: 'AI Code Review',
        prompt:
          'You are an expert code reviewer. Review the following {language} code and provide:\n1. Bugs or logic errors\n2. Security vulnerabilities\n3. Performance issues\n4. Code style and readability improvements\n5. A summary rating (1-10)\n\nCode:\n```{language}\n{code}\n```\n\nContext: {context}',
        config: { capability: 'coding', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Review Report',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'test-generator',
    name: 'Test Generator',
    description:
      'Generate unit tests for any function or module. Supports Jest, Vitest, pytest, and more.',
    category: 'developer',
    tags: ['testing', 'code', 'vitest', 'jest', 'pytest', 'developer'],
    requiredCapabilities: ['coding'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { code: 'function multiply(a, b) { return a * b }', framework: 'vitest', language: 'typescript' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Function Input',
        config: { fields: ['code', 'framework', 'language'] },
        next: 'generate',
      },
      {
        id: 'generate',
        type: 'ai_completion',
        name: 'Generate Tests',
        prompt:
          'Generate comprehensive {framework} unit tests for the following {language} code. Include edge cases, boundary conditions, and error cases. Output only the test file content.\n\nCode:\n```{language}\n{code}\n```',
        config: { capability: 'coding', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Test File',
        config: { format: 'code' },
      },
    ],
  },

  {
    id: 'debug-assistant',
    name: 'Debug Assistant',
    description:
      'Paste an error message and stack trace to receive root-cause analysis, fix suggestions, and prevention tips.',
    category: 'developer',
    tags: ['debug', 'error', 'stack-trace', 'developer'],
    requiredCapabilities: ['coding', 'deep_reasoning'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { error: 'TypeError: Cannot read property of undefined', stackTrace: '...', code: '' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Error Input',
        config: { fields: ['error', 'stackTrace', 'code', 'context'] },
        next: 'analyze',
      },
      {
        id: 'analyze',
        type: 'ai_completion',
        name: 'Root Cause Analysis',
        prompt:
          'You are an expert debugger. Analyze the following error and provide:\n1. Root cause explanation\n2. Step-by-step fix\n3. Code example if applicable\n4. How to prevent this in the future\n\nError: {error}\nStack trace: {stackTrace}\nRelevant code: {code}\nContext: {context}',
        config: { capability: 'coding', model_preference: 'premium' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Debug Report',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'diagram-generator',
    name: 'Diagram Generator',
    description:
      'Describe a system or process and receive a Mermaid.js diagram (flowchart, sequence diagram, ER diagram, etc.).',
    category: 'developer',
    tags: ['diagram', 'mermaid', 'architecture', 'documentation', 'developer'],
    requiredCapabilities: ['coding', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { description: 'User authentication flow with JWT tokens', diagramType: 'sequence' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'System Description',
        config: { fields: ['description', 'diagramType'] },
        next: 'generate',
      },
      {
        id: 'generate',
        type: 'ai_completion',
        name: 'Generate Mermaid Diagram',
        prompt:
          'Generate a Mermaid.js {diagramType} diagram for the following system/process. Output ONLY the Mermaid code block, no explanations.\n\nDescription: {description}\n\nUse proper Mermaid syntax. If diagramType is "sequence" use sequenceDiagram, if "flowchart" use flowchart TD, if "er" use erDiagram.',
        config: { capability: 'coding', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Mermaid Diagram',
        config: { format: 'code', language: 'mermaid' },
      },
    ],
  },

  // ── 2. PRODUCTIVITY / PERSONAL OPERATIONS ───────────────────────────────────

  {
    id: 'daily-briefing',
    name: 'Morning Briefing',
    description:
      'Generate a structured morning briefing from your priorities, tasks, and notes. Includes a daily focus, time blocks, and reminders.',
    category: 'productivity',
    tags: ['briefing', 'daily', 'calendar', 'productivity', 'morning'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { priorities: 'Ship feature X, Review PR #42', tasks: 'Call dentist, Buy groceries', date: '2026-04-14' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Day Input',
        config: { fields: ['priorities', 'tasks', 'meetings', 'date', 'notes'] },
        next: 'brief',
      },
      {
        id: 'brief',
        type: 'ai_completion',
        name: 'Generate Briefing',
        prompt:
          'Create a structured morning briefing for {date}.\n\nTop priorities: {priorities}\nTasks: {tasks}\nMeetings: {meetings}\nNotes: {notes}\n\nFormat as:\n## Morning Briefing — {date}\n### 🎯 Today\'s Focus (top 1-3 items)\n### 📅 Time Blocks (suggested schedule)\n### ✅ Task List\n### 💡 Daily Intention\n\nBe concise and actionable.',
        config: { capability: 'general_chat', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Daily Briefing',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'email-triage',
    name: 'Email Triage Assistant',
    description:
      'Paste email content to get priority classification, suggested action, draft reply, and whether it can be auto-archived.',
    category: 'productivity',
    tags: ['email', 'triage', 'inbox', 'productivity'],
    requiredCapabilities: ['general_chat', 'summarization'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { emailContent: 'Subject: Urgent: Server down\nFrom: ops@example.com\nBody: The prod server is down...', sender: 'ops@example.com' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Email Input',
        config: { fields: ['emailContent', 'sender', 'context'] },
        next: 'triage',
      },
      {
        id: 'triage',
        type: 'ai_completion',
        name: 'Triage Email',
        prompt:
          'You are an intelligent email triage assistant. Analyze this email and provide a structured response.\n\nEmail:\n{emailContent}\n\nProvide:\n## Priority: [URGENT / HIGH / NORMAL / LOW]\n## Category: [e.g. Action Required, FYI, Meeting, Support, Spam]\n## Summary (1-2 sentences)\n## Suggested Action: [e.g. Reply within 1 hour, Archive, Forward to team]\n## Draft Reply (if action required)\n## Can auto-archive: [YES / NO]\n\nSender context: {context}',
        config: { capability: 'general_chat', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Triage Report',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'daily-summary',
    name: 'End-of-Day Summary',
    description:
      'Compile a structured end-of-day summary from your completed tasks, blockers, wins, and notes.',
    category: 'productivity',
    tags: ['summary', 'daily', 'standup', 'productivity'],
    requiredCapabilities: ['general_chat', 'summarization'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { completed: 'Fixed login bug, reviewed PRs', blockers: 'Waiting for design assets', wins: 'Deployed to staging' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Day Input',
        config: { fields: ['completed', 'blockers', 'wins', 'tomorrow', 'notes'] },
        next: 'summarize',
      },
      {
        id: 'summarize',
        type: 'ai_completion',
        name: 'Generate Summary',
        prompt:
          'Create a professional end-of-day summary.\n\nCompleted today: {completed}\nBlockers: {blockers}\nWins: {wins}\nPlanned for tomorrow: {tomorrow}\nNotes: {notes}\n\nFormat as:\n## End-of-Day Summary\n### ✅ Completed\n### 🏆 Wins\n### 🚧 Blockers\n### 📋 Tomorrow\'s Focus\n### 💬 Notes',
        config: { capability: 'general_chat', model_preference: 'cheap' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Day Summary',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'idea-pipeline',
    name: 'Idea Pipeline',
    description:
      'Capture a raw idea and transform it into a structured plan with research questions, next steps, and feasibility notes.',
    category: 'productivity',
    tags: ['idea', 'brainstorm', 'planning', 'productivity'],
    requiredCapabilities: ['general_chat', 'deep_reasoning'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { idea: 'Build an AI-powered grocery list app that learns from purchase history' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Idea Input',
        config: { fields: ['idea', 'context', 'constraints'] },
        next: 'develop',
      },
      {
        id: 'develop',
        type: 'ai_completion',
        name: 'Develop Idea',
        prompt:
          'Transform this raw idea into a structured plan.\n\nIdea: {idea}\nContext: {context}\nConstraints: {constraints}\n\nProvide:\n## Idea Refinement\n### Core Value Proposition\n### Target Users\n### Key Features (top 5)\n### Open Questions to Research\n### Quick Feasibility Assessment\n### Suggested First 3 Next Steps\n### Similar Existing Solutions',
        config: { capability: 'deep_reasoning', model_preference: 'premium' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Idea Plan',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'video-summarizer',
    name: 'Video / Article Summarizer',
    description:
      'Paste a transcript, article, or video description to get a concise summary with key takeaways, action items, and quotes.',
    category: 'productivity',
    tags: ['summarize', 'youtube', 'article', 'research', 'productivity'],
    requiredCapabilities: ['summarization', 'general_chat'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { content: 'Full video transcript or article text here...', sourceType: 'youtube', title: 'How to build a startup' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Content Input',
        config: { fields: ['content', 'sourceType', 'title'] },
        next: 'summarize',
      },
      {
        id: 'summarize',
        type: 'ai_completion',
        name: 'Summarize Content',
        prompt:
          'Summarize the following {sourceType} content.\n\nTitle: {title}\nContent: {content}\n\nProvide:\n## TL;DR (2-3 sentences)\n## Key Takeaways (bullet points)\n## Notable Quotes\n## Action Items (if any)\n## My Rating (1-10 + why)',
        config: { capability: 'summarization', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Summary',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'meal-planner',
    name: 'Weekly Meal Planner',
    description:
      'Generate a personalized weekly meal plan with recipes, grocery list, and prep tips based on dietary preferences.',
    category: 'productivity',
    tags: ['meal', 'food', 'grocery', 'health', 'planning'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { preferences: 'vegetarian, high protein', peopleCount: 2, budget: '$100/week', excludes: 'nuts' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Preferences Input',
        config: { fields: ['preferences', 'peopleCount', 'budget', 'excludes', 'cuisines'] },
        next: 'plan',
      },
      {
        id: 'plan',
        type: 'ai_completion',
        name: 'Generate Meal Plan',
        prompt:
          'Create a 7-day meal plan for {peopleCount} people.\n\nDietary preferences: {preferences}\nBudget: {budget}\nExclusions: {excludes}\nPreferred cuisines: {cuisines}\n\nFor each day provide: Breakfast, Lunch, Dinner, Snack.\nInclude a consolidated grocery list organized by category.\nAdd 3 meal prep tips.',
        config: { capability: 'general_chat', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Meal Plan',
        config: { format: 'markdown' },
      },
    ],
  },

  // ── 3. CONTENT & MEDIA ────────────────────────────────────────────────────

  {
    id: 'content-curation',
    name: 'Content Curation Digest',
    description:
      'Compile and summarize a set of article URLs or text snippets into a themed digest with commentary.',
    category: 'content',
    tags: ['content', 'curation', 'digest', 'newsletter'],
    requiredCapabilities: ['summarization', 'general_chat'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { items: 'Article 1: ... Article 2: ...', theme: 'AI & Technology', audience: 'developers' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Content Items',
        config: { fields: ['items', 'theme', 'audience'] },
        next: 'curate',
      },
      {
        id: 'curate',
        type: 'ai_completion',
        name: 'Curate & Summarize',
        prompt:
          'Create a curated digest on the theme: {theme} for audience: {audience}.\n\nContent items:\n{items}\n\nFor each item provide a 2-sentence summary and why it matters to {audience}.\nEnd with a "Curator\'s Pick" (best item) and 1 overall insight.',
        config: { capability: 'summarization', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Curated Digest',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'seo-analyzer',
    name: 'SEO Content Analyzer',
    description:
      'Analyze a web page or article for SEO quality: keyword density, readability, structure, and improvement suggestions.',
    category: 'content',
    tags: ['seo', 'content', 'marketing', 'analysis'],
    requiredCapabilities: ['general_chat', 'deep_research'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { content: 'Full page content here...', targetKeyword: 'AI automation platform', url: 'https://example.com' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Content Input',
        config: { fields: ['content', 'targetKeyword', 'url'] },
        next: 'analyze',
      },
      {
        id: 'analyze',
        type: 'ai_completion',
        name: 'SEO Analysis',
        prompt:
          'Perform an SEO analysis for target keyword: "{targetKeyword}"\n\nContent:\n{content}\n\nAnalyze:\n1. Keyword usage (density, placement, variations)\n2. Title/H1/H2 structure\n3. Readability score (1-10)\n4. Content completeness vs search intent\n5. Internal/external link opportunities\n6. Meta description suggestion\n7. Top 5 improvements ranked by impact\n\nURL: {url}',
        config: { capability: 'general_chat', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'SEO Report',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'speed-read-converter',
    name: 'Speed-Read Converter',
    description:
      'Convert any article or document into a speed-reading optimized format with key sentence highlights and RSVP-style chunking.',
    category: 'content',
    tags: ['reading', 'productivity', 'speed-read', 'content'],
    requiredCapabilities: ['summarization', 'general_chat'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { content: 'Long article text...', readingLevel: 'advanced', targetMinutes: 5 },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Content Input',
        config: { fields: ['content', 'readingLevel', 'targetMinutes'] },
        next: 'convert',
      },
      {
        id: 'convert',
        type: 'ai_completion',
        name: 'Speed-Read Format',
        prompt:
          'Convert this content into a speed-reading optimized format for {targetMinutes}-minute reading.\n\nContent: {content}\nReading level: {readingLevel}\n\nProvide:\n1. Executive Summary (30 seconds)\n2. Key Points (2 minutes) — each as a single bolded sentence\n3. Supporting Details (remaining time) — trimmed to essentials\n4. Vocabulary notes for complex terms\n\nRemove all filler phrases and passive voice.',
        config: { capability: 'summarization', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Speed-Read Version',
        config: { format: 'markdown' },
      },
    ],
  },

  // ── 4. INTEGRATIONS / MESSAGING / CROSS-PLATFORM ────────────────────────────

  {
    id: 'negotiation-draft',
    name: 'Negotiation Email Drafter',
    description:
      'Draft professional negotiation emails for salary, pricing, contracts, or vendor terms.',
    category: 'integration',
    tags: ['negotiation', 'email', 'communication', 'professional'],
    requiredCapabilities: ['general_chat', 'creative_writing'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { context: 'Salary negotiation, was offered $80k, want $95k', counterparty: 'Hiring Manager', relationship: 'new' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Negotiation Context',
        config: { fields: ['context', 'counterparty', 'relationship', 'currentOffer', 'desiredOutcome'] },
        next: 'draft',
      },
      {
        id: 'draft',
        type: 'ai_completion',
        name: 'Draft Negotiation',
        prompt:
          'Draft a professional negotiation email.\n\nContext: {context}\nCounterparty: {counterparty}\nRelationship: {relationship}\nCurrent offer/situation: {currentOffer}\nDesired outcome: {desiredOutcome}\n\nTone: professional, confident, collaborative — not aggressive.\nInclude: acknowledgment, value statement, counter-proposal, flexibility signal, next step.\n\nProvide 2 versions: one assertive, one gentle.',
        config: { capability: 'general_chat', model_preference: 'premium' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Negotiation Drafts',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'receipt-parser',
    name: 'Receipt / Document Parser',
    description:
      'Paste receipt or document text to extract structured data: line items, totals, dates, vendor info.',
    category: 'automation',
    tags: ['receipt', 'parsing', 'finance', 'document', 'extraction'],
    requiredCapabilities: ['structured_output', 'general_chat'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { documentText: 'Walmart receipt text here...', documentType: 'receipt' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Document Input',
        config: { fields: ['documentText', 'documentType'] },
        next: 'extract',
      },
      {
        id: 'extract',
        type: 'ai_completion',
        name: 'Extract Structured Data',
        prompt:
          'Extract structured data from this {documentType}.\n\nDocument:\n{documentText}\n\nReturn a JSON object with:\n{\n  "vendor": "",\n  "date": "",\n  "total": 0,\n  "tax": 0,\n  "subtotal": 0,\n  "paymentMethod": "",\n  "lineItems": [{ "description": "", "quantity": 1, "unitPrice": 0, "total": 0 }],\n  "notes": ""\n}\n\nReturn ONLY valid JSON, no markdown wrapping.',
        config: { capability: 'structured_output', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Parsed Document',
        config: { format: 'json' },
      },
    ],
  },

  // ── 5. MULTI-AGENT / TEAM ASSISTANTS ─────────────────────────────────────

  {
    id: 'research-to-doc',
    name: 'Research-to-Document Pipeline',
    description:
      'Multi-step pipeline: research a topic, synthesize findings, and produce a structured document or report.',
    category: 'multi_agent',
    tags: ['research', 'document', 'pipeline', 'multi-step'],
    requiredCapabilities: ['deep_research', 'deep_reasoning', 'summarization'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { topic: 'Impact of AI on software engineering jobs', depth: 'comprehensive', outputFormat: 'report' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Research Topic',
        config: { fields: ['topic', 'depth', 'outputFormat', 'audience'] },
        next: 'outline',
      },
      {
        id: 'outline',
        type: 'ai_completion',
        name: 'Create Outline',
        prompt:
          'Create a structured research outline for: "{topic}"\n\nDepth: {depth}\nAudience: {audience}\n\nReturn 6-8 section headings with 2-3 sub-points each. Be specific and exhaustive.',
        config: { capability: 'deep_reasoning', model_preference: 'premium' },
        next: 'research',
      },
      {
        id: 'research',
        type: 'ai_completion',
        name: 'Deep Research',
        prompt:
          'Using the outline provided, research and write a comprehensive document on: "{topic}"\n\nOutline: {outline_output}\n\nWrite each section with current knowledge, concrete examples, statistics where known, and balanced perspectives. Cite limitations of your knowledge where relevant.',
        config: { capability: 'deep_research', model_preference: 'premium' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Research Document',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'team-briefing-generator',
    name: 'Team Briefing Generator',
    description:
      'Generate team standup notes, sprint summaries, or project status updates from raw team input.',
    category: 'multi_agent',
    tags: ['team', 'standup', 'sprint', 'project', 'management'],
    requiredCapabilities: ['general_chat', 'summarization'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { teamUpdates: 'Alice: finished auth module. Bob: blocked on design. Charlie: deployed v2.1', format: 'standup' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Team Updates',
        config: { fields: ['teamUpdates', 'format', 'period', 'projectName'] },
        next: 'generate',
      },
      {
        id: 'generate',
        type: 'ai_completion',
        name: 'Generate Briefing',
        prompt:
          'Generate a professional {format} briefing for project: {projectName}\nPeriod: {period}\n\nTeam updates:\n{teamUpdates}\n\nFormat as:\n## Team {format} — {period}\n### ✅ Completed\n### 🚧 In Progress\n### 🚫 Blocked\n### 📌 Key Decisions\n### ➡️ Next Steps\n\nHighlight risks and blockers prominently.',
        config: { capability: 'summarization', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Team Briefing',
        config: { format: 'markdown' },
      },
    ],
  },

  // ── 6. AUTOMATION WORKFLOWS ──────────────────────────────────────────────

  {
    id: 'claims-form-assistant',
    name: 'Claims / Insurance Form Assistant',
    description:
      'Parse insurance or claims documents to extract key fields, flag missing information, and draft correspondence.',
    category: 'automation',
    tags: ['insurance', 'claims', 'forms', 'document', 'admin'],
    requiredCapabilities: ['structured_output', 'general_chat'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { claimText: 'Claim document text here...', claimType: 'medical', policyNumber: 'POL-12345' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Claim Input',
        config: { fields: ['claimText', 'claimType', 'policyNumber'] },
        next: 'extract',
      },
      {
        id: 'extract',
        type: 'ai_completion',
        name: 'Extract Claim Data',
        prompt:
          'Extract and analyze this {claimType} claim.\n\nClaim: {claimText}\nPolicy: {policyNumber}\n\nProvide:\n1. Extracted key fields (claimant, date, amount, description, supporting docs)\n2. Missing required fields\n3. Validity assessment\n4. Draft response letter\n5. Next steps for processing',
        config: { capability: 'structured_output', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Claims Analysis',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'lab-results-organizer',
    name: 'Lab Results Organizer',
    description:
      'Paste medical lab results to get a plain-language explanation, flag abnormal values, and suggested follow-up questions.',
    category: 'automation',
    tags: ['health', 'medical', 'lab', 'results', 'wellness'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { labResults: 'CBC panel results here...', patientAge: 35, patientSex: 'F' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Lab Results Input',
        config: { fields: ['labResults', 'patientAge', 'patientSex', 'medications'] },
        next: 'analyze',
      },
      {
        id: 'analyze',
        type: 'ai_completion',
        name: 'Analyze Results',
        prompt:
          'IMPORTANT: This is for educational purposes only. Always consult a healthcare provider.\n\nAnalyze these lab results for a {patientAge}yo {patientSex} patient taking {medications}.\n\nResults: {labResults}\n\nProvide:\n1. Plain-language explanation of each test\n2. Results flagged as abnormal (with reference ranges)\n3. Potential significance of abnormal values\n4. Questions to ask the doctor\n5. Lifestyle factors that commonly affect these markers\n\nDisclaimer: This is NOT medical advice.',
        config: { capability: 'general_chat', model_preference: 'premium' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Lab Report Summary',
        config: { format: 'markdown' },
      },
    ],
  },

  {
    id: 'report-generator',
    name: 'Automated Report Generator',
    description:
      'Generate a professional report from raw data, metrics, or notes in multiple formats (executive summary, technical, weekly).',
    category: 'automation',
    tags: ['report', 'analytics', 'data', 'business', 'automation'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { data: 'Sales: $45k (+12%), Users: 1200 (+8%), Churn: 2.1%', reportType: 'executive', period: 'Q1 2026' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Data Input',
        config: { fields: ['data', 'reportType', 'period', 'audience', 'context'] },
        next: 'generate',
      },
      {
        id: 'generate',
        type: 'ai_completion',
        name: 'Generate Report',
        prompt:
          'Generate a {reportType} report for period: {period}\nAudience: {audience}\nContext: {context}\n\nData:\n{data}\n\nFormat as a professional report with:\n- Executive Summary\n- Key Metrics (with trend indicators)\n- Analysis & Insights\n- Risks & Opportunities\n- Recommendations\n- Next Steps\n\nUse clear headings and bullet points.',
        config: { capability: 'structured_output', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Generated Report',
        config: { format: 'markdown' },
      },
    ],
  },

  // ── 7. SMART HOME / DEVICE (Framework-Ready Templates) ───────────────────

  {
    id: 'smart-home-command-parser',
    name: 'Smart Home Command Parser',
    description:
      'Parse natural language smart home commands into structured device control intents. Connects to smart home API via webhook step.',
    category: 'smart_home',
    tags: ['smart-home', 'iot', 'voice', 'automation', 'device'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: true,
    externalServiceLabel: 'Smart Home API (Home Assistant / Homey / Google Home)',
    launchReady: false,
    entryStepId: 'input',
    exampleInput: { command: 'Turn on the living room lights and set the thermostat to 72 degrees', home: 'main' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Voice/Text Command',
        config: { fields: ['command', 'home', 'room', 'user'] },
        next: 'parse',
      },
      {
        id: 'parse',
        type: 'ai_completion',
        name: 'Parse Command Intent',
        prompt:
          'Parse this smart home command into structured device control intents.\n\nCommand: "{command}"\nHome: {home}\nRoom context: {room}\n\nReturn JSON array of intents:\n[{\n  "device_type": "light|thermostat|lock|camera|speaker|tv",\n  "device_name": "",\n  "room": "",\n  "action": "on|off|set|get|toggle|increase|decrease",\n  "value": null,\n  "confidence": 0.0-1.0\n}]\n\nReturn ONLY valid JSON array.',
        config: { capability: 'structured_output', model_preference: 'cheap' },
        next: 'dispatch',
      },
      {
        id: 'dispatch',
        type: 'webhook',
        name: 'Dispatch to Smart Home API',
        config: {
          url: '{SMART_HOME_API_URL}/api/command',
          method: 'POST',
          headers: { Authorization: 'Bearer {SMART_HOME_API_KEY}' },
          body: '{ "intents": {parse_output}, "home": "{home}", "user": "{user}" }',
          note: 'Configure SMART_HOME_API_URL and SMART_HOME_API_KEY in integration settings',
        },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Command Result',
        config: { format: 'json' },
      },
    ],
  },

  {
    id: 'home-project-manager',
    name: 'Home Project Manager',
    description:
      'Manage home improvement projects: break down work into tasks, estimate costs, track materials, and generate contractor briefs.',
    category: 'smart_home',
    tags: ['home', 'project', 'renovation', 'planning', 'diy'],
    requiredCapabilities: ['general_chat', 'structured_output'],
    requiresExternalService: false,
    launchReady: true,
    entryStepId: 'input',
    exampleInput: { project: 'Renovate master bathroom', budget: '$8000', timeline: '6 weeks', details: 'Replace vanity, retile floor, repaint' },
    steps: [
      {
        id: 'input',
        type: 'input',
        name: 'Project Input',
        config: { fields: ['project', 'budget', 'timeline', 'details', 'diyOrContractor'] },
        next: 'plan',
      },
      {
        id: 'plan',
        type: 'ai_completion',
        name: 'Generate Project Plan',
        prompt:
          'Create a comprehensive home project plan.\n\nProject: {project}\nBudget: {budget}\nTimeline: {timeline}\nDetails: {details}\nApproach: {diyOrContractor}\n\nProvide:\n## Project Overview\n## Phase Breakdown (with durations)\n## Task List with Dependencies\n## Materials & Cost Estimate\n## Tools Required\n## Contractor Brief (if applicable)\n## Risk Factors\n## Progress Milestones',
        config: { capability: 'general_chat', model_preference: 'balanced' },
        next: 'output',
      },
      {
        id: 'output',
        type: 'output',
        name: 'Project Plan',
        config: { format: 'markdown' },
      },
    ],
  },
]

// ── Accessors ─────────────────────────────────────────────────────────────────

/** Return all templates */
export function getAllSkillTemplates(): SkillTemplate[] {
  return SKILL_TEMPLATES
}

/** Return templates filtered by category */
export function getTemplatesByCategory(category: TemplateCategory): SkillTemplate[] {
  return SKILL_TEMPLATES.filter((t) => t.category === category)
}

/** Return a single template by ID */
export function getSkillTemplate(id: string): SkillTemplate | undefined {
  return SKILL_TEMPLATES.find((t) => t.id === id)
}

/** Return only launch-ready templates */
export function getLaunchReadyTemplates(): SkillTemplate[] {
  return SKILL_TEMPLATES.filter((t) => t.launchReady)
}

/** Return templates that match given capability requirements */
export function getTemplatesForCapabilities(capabilities: string[]): SkillTemplate[] {
  const capSet = new Set(capabilities)
  return SKILL_TEMPLATES.filter((t) =>
    t.requiredCapabilities.some((c) => capSet.has(c)),
  )
}

/** Return summary stats for the template library */
export function getTemplateSummary(): {
  total: number
  launchReady: number
  byCategory: Record<TemplateCategory, number>
} {
  const byCategory: Record<string, number> = {}
  for (const t of SKILL_TEMPLATES) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1
  }
  return {
    total: SKILL_TEMPLATES.length,
    launchReady: SKILL_TEMPLATES.filter((t) => t.launchReady).length,
    byCategory: byCategory as Record<TemplateCategory, number>,
  }
}
