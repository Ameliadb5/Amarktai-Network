import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

function genToken() {
  return `amkt_${crypto.randomBytes(32).toString('hex')}`
}

function genMetricPoints(productId: number, metricKey: string, count: number, min: number, max: number) {
  return Array.from({ length: count }, (_, i) => ({
    productId,
    metricKey,
    metricValue: parseFloat((min + Math.random() * (max - min)).toFixed(2)),
    metricLabel: '',
    timestamp: new Date(Date.now() - (count - 1 - i) * 30 * 60 * 1000),
  }))
}

function genVpsSnapshots(productId: number, count: number) {
  const cpuBase = 20 + Math.random() * 40
  const ramBase = 30 + Math.random() * 40
  return Array.from({ length: count }, (_, i) => ({
    productId,
    cpuPercent: parseFloat((Math.max(5, Math.min(95, cpuBase + (Math.random() * 20 - 10)))).toFixed(1)),
    ramPercent: parseFloat((Math.max(10, Math.min(90, ramBase + (Math.random() * 15 - 7)))).toFixed(1)),
    ramUsedMb: parseFloat(((ramBase / 100) * 4096 + (Math.random() * 512 - 256)).toFixed(0)),
    ramTotalMb: 4096,
    diskPercent: parseFloat((15 + Math.random() * 35).toFixed(1)),
    diskUsedGb: parseFloat((3 + Math.random() * 15).toFixed(2)),
    diskTotalGb: 80,
    netInKbps: parseFloat((50 + Math.random() * 300).toFixed(1)),
    netOutKbps: parseFloat((20 + Math.random() * 150).toFixed(1)),
    timestamp: new Date(Date.now() - (count - 1 - i) * 5 * 60 * 1000),
  }))
}

async function main() {
  console.log('🌱 Seeding Amarktai Network database...')

  // ── Admin ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123!', 12)
  await prisma.adminUser.upsert({
    where: { email: 'admin@amarktai.com' },
    update: {},
    create: { email: 'admin@amarktai.com', passwordHash },
  })
  console.log('✅ Admin user: admin@amarktai.com / admin123!')

  // ── Rename legacy slugs if they exist ────────────────────────────
  await prisma.product.updateMany({
    where: { slug: 'kinship' },
    data: { name: 'Amarktai Travel', slug: 'amarktai-travel' },
  })
  await prisma.product.updateMany({
    where: { slug: 'amarktai-family' },
    data: { name: 'Amarktai Travel', slug: 'amarktai-travel' },
  })

  // ── Products ───────────────────────────────────────────────────────
  const products = [
    {
      name: 'EquiProfile',
      slug: 'equiprofile',
      category: 'Finance & Web',
      shortDescription: 'Professional equity profiling and financial intelligence for serious investors.',
      longDescription: 'EquiProfile delivers deep equity analysis and financial profiling tools for investors who demand precision. Comprehensive company profiles, financial metrics, and investment intelligence in one clean platform.',
      status: 'live', accessType: 'public', featured: true,
      hostedHere: false, hostingScope: 'external_domain', subdomain: '', customDomain: 'equiprofile.online',
      environment: 'production', publicVisibility: true, monitoringEnabled: true, integrationEnabled: false,
      primaryUrl: 'https://equiprofile.online', sortOrder: 1,
      appType: 'app', readyToDeploy: true, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'connected',
      onboardingCompletedAt: new Date(),
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Amarktai Marketing',
      slug: 'amarktai-marketing',
      category: 'Marketing & AI',
      shortDescription: 'AI-powered marketing intelligence and automation for modern growth teams.',
      longDescription: 'Amarktai Marketing brings AI-driven campaign intelligence, audience segmentation, and automated growth workflows to teams that demand results.',
      status: 'live', accessType: 'public', featured: true,
      hostedHere: true, hostingScope: 'same_vps', subdomain: 'marketing', customDomain: '',
      environment: 'production', publicVisibility: true, monitoringEnabled: true, integrationEnabled: false,
      primaryUrl: 'https://marketing.amarktai.com', sortOrder: 2,
      appType: 'app', readyToDeploy: true, aiEnabled: true, connectedToBrain: false,
      onboardingStatus: 'configuring',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Amarktai Crypto',
      slug: 'amarktai-crypto',
      category: 'Finance & AI',
      shortDescription: 'Advanced cryptocurrency intelligence platform with real-time AI signals and portfolio analytics.',
      longDescription: 'Amarktai Crypto is an institutional-grade cryptocurrency intelligence platform. Our proprietary AI models analyze on-chain data, social sentiment, and order book dynamics to deliver high-confidence trading insights.',
      status: 'invite_only', accessType: 'invite', featured: true,
      hostedHere: true, hostingScope: 'subdomain', subdomain: 'crypto', customDomain: '',
      environment: 'production', publicVisibility: true, monitoringEnabled: true, integrationEnabled: true,
      primaryUrl: 'https://crypto.amarktai.com', sortOrder: 3,
      appType: 'app', readyToDeploy: true, aiEnabled: true, connectedToBrain: false,
      onboardingStatus: 'connected',
      onboardingCompletedAt: new Date(),
      appSecret: '', customInstructions: 'Crypto market intelligence platform. Analyze on-chain data and provide high-confidence trading insights.',
    },
    {
      name: 'Amarktai Forex',
      slug: 'amarktai-forex',
      category: 'Finance & AI',
      shortDescription: 'Institutional-grade forex analysis powered by proprietary AI models and market intelligence.',
      longDescription: 'Amarktai Forex brings institutional-level market intelligence to retail and professional traders. Our AI engine processes millions of data points per second.',
      status: 'in_development', accessType: 'invite', featured: false,
      hostedHere: true, hostingScope: 'subdomain', subdomain: 'forex', customDomain: '',
      environment: 'development', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 4,
      appType: 'app', readyToDeploy: false, aiEnabled: true, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: 'Forex trading intelligence platform. Provide macro analysis and proprietary AI signals.',
    },
    {
      name: 'Amarktai Travel',
      slug: 'amarktai-travel',
      category: 'Travel & AI',
      shortDescription: 'Intelligent travel platform bringing AI-powered discovery, planning, and booking to modern travellers.',
      longDescription: 'Amarktai Travel is a smart travel platform that uses AI to surface personalised destination recommendations, real-time pricing intelligence, and seamless itinerary planning — all in one connected experience.',
      status: 'live', accessType: 'public', featured: true,
      hostedHere: true, hostingScope: 'same_vps', subdomain: 'travel', customDomain: '',
      environment: 'production', publicVisibility: true, monitoringEnabled: true, integrationEnabled: false,
      primaryUrl: 'https://travel.amarktai.com', sortOrder: 5,
      appType: 'app', readyToDeploy: true, aiEnabled: true, connectedToBrain: false,
      onboardingStatus: 'configuring',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: 'Travel intelligence platform. Provide personalised recommendations, itinerary assistance, and destination insights.',
    },
    {
      name: 'Faith Haven',
      slug: 'faith-haven',
      category: 'Community',
      shortDescription: 'A digital space for faith communities to connect, grow, and build meaningful relationships.',
      longDescription: 'Faith Haven is building a premium digital sanctuary for faith communities worldwide.',
      status: 'in_development', accessType: 'public', featured: false,
      hostedHere: false, hostingScope: 'external_domain', subdomain: '', customDomain: 'faithhaven.app',
      environment: 'staging', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 6,
      appType: 'app', readyToDeploy: false, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Learn Digital',
      slug: 'learn-digital',
      category: 'Education',
      shortDescription: 'Adaptive digital learning platform designed for the next generation of technology professionals.',
      longDescription: 'Learn Digital is an adaptive education platform that meets learners where they are.',
      status: 'in_development', accessType: 'public', featured: false,
      hostedHere: true, hostingScope: 'same_vps', subdomain: '', customDomain: '',
      environment: 'staging', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 7,
      appType: 'app', readyToDeploy: false, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Jobs SA',
      slug: 'jobs-sa',
      category: 'Employment',
      shortDescription: 'South Africa-focused intelligent job matching platform connecting talent with opportunity.',
      longDescription: 'Jobs SA uses AI to match South African professionals with opportunities that align with their skills.',
      status: 'in_development', accessType: 'public', featured: false,
      hostedHere: false, hostingScope: 'external_domain', subdomain: '', customDomain: 'jobssa.co.za',
      environment: 'development', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 8,
      appType: 'app', readyToDeploy: false, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Amarktai Secure',
      slug: 'amarktai-secure',
      category: 'Security',
      shortDescription: 'Enterprise-grade security platform for digital asset protection and threat intelligence.',
      longDescription: 'Amarktai Secure provides threat detection, zero-trust architecture, and AI-powered anomaly detection for digital platforms.',
      status: 'concept', accessType: 'private', featured: false,
      hostedHere: false, hostingScope: 'external_vps', subdomain: '', customDomain: '',
      environment: 'development', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 9,
      appType: 'app', readyToDeploy: false, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
    {
      name: 'Crowd Lens',
      slug: 'crowd-lens',
      category: 'Media & AI',
      shortDescription: 'AI-powered crowd intelligence platform for real-time event analysis and social monitoring.',
      longDescription: 'Crowd Lens uses computer vision and NLP to analyze crowds, events, and social dynamics in real time.',
      status: 'concept', accessType: 'private', featured: false,
      hostedHere: false, hostingScope: 'external_vps', subdomain: '', customDomain: '',
      environment: 'development', publicVisibility: false, monitoringEnabled: false, integrationEnabled: false,
      primaryUrl: '', sortOrder: 10,
      appType: 'app', readyToDeploy: false, aiEnabled: false, connectedToBrain: false,
      onboardingStatus: 'unconfigured',
      onboardingCompletedAt: null,
      appSecret: '', customInstructions: '',
    },
  ]

  const createdProducts: Array<typeof products[0] & { id: number }> = []
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { ...p },
      create: { ...p },
    })
    createdProducts.push({ ...p, id: prod.id })
  }
  console.log(`✅ ${createdProducts.length} products seeded`)

  // ── Integrations ───────────────────────────────────────────────────
  const integratedProducts = createdProducts.filter(p => p.integrationEnabled)
  for (const prod of integratedProducts) {
    const existing = await prisma.appIntegration.findUnique({ where: { productId: prod.id } })
    if (!existing) {
      const isActive = prod.monitoringEnabled
      await prisma.appIntegration.create({
        data: {
          productId: prod.id,
          integrationToken: genToken(),
          heartbeatEnabled: true,
          metricsEnabled: true,
          eventsEnabled: true,
          vpsEnabled: isActive,
          lastHeartbeatAt: isActive ? new Date(Date.now() - Math.floor(Math.random() * 3 * 60 * 1000)) : null,
          healthStatus: isActive ? (Math.random() > 0.15 ? 'healthy' : 'degraded') : 'unknown',
          uptime: isActive ? parseFloat((99.5 + Math.random() * 0.49).toFixed(2)) : null,
          version: '1.0.0',
          environment: prod.environment,
        },
      })
    }
  }
  console.log('✅ Integrations seeded')

  // ── Metric Definitions ─────────────────────────────────────────────
  const metricDefs: Record<string, Array<{ key: string; label: string; type: string; chartType: string }>> = {
    'amarktai-crypto': [
      { key: 'active_users', label: 'Active Users', type: 'number', chartType: 'area' },
      { key: 'trades_per_hour', label: 'Trades / Hour', type: 'number', chartType: 'bar' },
      { key: 'signals_generated', label: 'Signals Generated', type: 'number', chartType: 'line' },
      { key: 'portfolio_value_usd', label: 'Portfolio Value (USD)', type: 'currency', chartType: 'area' },
    ],
    'amarktai-travel': [
      { key: 'active_users', label: 'Active Users', type: 'number', chartType: 'area' },
      { key: 'searches_per_hour', label: 'Searches / Hour', type: 'number', chartType: 'bar' },
      { key: 'bookings', label: 'Bookings', type: 'number', chartType: 'line' },
    ],
    'amarktai-marketing': [
      { key: 'campaigns_active', label: 'Active Campaigns', type: 'number', chartType: 'bar' },
      { key: 'leads_generated', label: 'Leads Generated', type: 'number', chartType: 'area' },
    ],
  }

  for (const prod of createdProducts) {
    const defs = metricDefs[prod.slug] ?? []
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      const existing = await prisma.appMetricDefinition.findFirst({ where: { productId: prod.id, metricKey: def.key } })
      if (!existing) {
        await prisma.appMetricDefinition.create({
          data: {
            productId: prod.id,
            metricKey: def.key,
            metricLabel: def.label,
            metricType: def.type,
            defaultChartType: def.chartType,
            isEnabled: true,
            sortOrder: i,
          },
        })
      }
    }
  }

  // ── Metric Points ──────────────────────────────────────────────────
  const cryptoProd = createdProducts.find(p => p.slug === 'amarktai-crypto')!
  const travelProd = createdProducts.find(p => p.slug === 'amarktai-travel')!
  const marketingProd = createdProducts.find(p => p.slug === 'amarktai-marketing')!

  const existingMetricCount = await prisma.appMetricPoint.count()
  if (existingMetricCount === 0 && cryptoProd) {
    await prisma.appMetricPoint.createMany({
      data: [
        ...genMetricPoints(cryptoProd.id, 'active_users', 48, 120, 350),
        ...genMetricPoints(cryptoProd.id, 'trades_per_hour', 48, 400, 1200),
        ...genMetricPoints(cryptoProd.id, 'signals_generated', 48, 80, 200),
        ...genMetricPoints(cryptoProd.id, 'portfolio_value_usd', 48, 2000000, 5000000),
        ...(travelProd ? genMetricPoints(travelProd.id, 'active_users', 48, 200, 600) : []),
        ...(travelProd ? genMetricPoints(travelProd.id, 'searches_per_hour', 48, 100, 400) : []),
        ...(travelProd ? genMetricPoints(travelProd.id, 'bookings', 48, 20, 80) : []),
        ...(marketingProd ? genMetricPoints(marketingProd.id, 'campaigns_active', 24, 5, 20) : []),
        ...(marketingProd ? genMetricPoints(marketingProd.id, 'leads_generated', 24, 50, 200) : []),
      ],
    })
    console.log('✅ Metric points seeded')
  }

  // ── VPS Snapshots ──────────────────────────────────────────────────
  const existingVpsCount = await prisma.vpsResourceSnapshot.count()
  if (existingVpsCount === 0) {
    const vpsProds = [cryptoProd, travelProd, marketingProd].filter(Boolean)
    for (const prod of vpsProds) {
      await prisma.vpsResourceSnapshot.createMany({ data: genVpsSnapshots(prod.id, 48) })
    }
    console.log('✅ VPS snapshots seeded')
  }

  // ── Events ─────────────────────────────────────────────────────────
  const eventTemplates = [
    { type: 'deployment', severity: 'info', title: 'New version deployed', message: 'v1.2.3 deployed successfully to production.' },
    { type: 'alert', severity: 'warning', title: 'High memory usage', message: 'RAM usage exceeded 85% threshold.' },
    { type: 'milestone', severity: 'info', title: 'User milestone reached', message: '1 000 active users milestone hit.' },
    { type: 'error', severity: 'error', title: 'API timeout detected', message: 'External API response exceeded 5 s.' },
    { type: 'health', severity: 'info', title: 'Health check passed', message: 'All services responding normally.' },
    { type: 'alert', severity: 'critical', title: 'CPU spike detected', message: 'CPU usage hit 95% for 2 minutes.' },
    { type: 'deployment', severity: 'info', title: 'Database migrated', message: 'Schema migration completed successfully.' },
    { type: 'security', severity: 'warning', title: 'Unusual login pattern', message: 'Multiple failed auth attempts detected.' },
  ]

  for (const prod of integratedProducts) {
    const existing = await prisma.appEvent.count({ where: { productId: prod.id } })
    if (existing === 0) {
      const count = 3 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const tmpl = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]
        await prisma.appEvent.create({
          data: {
            productId: prod.id,
            eventType: tmpl.type,
            severity: tmpl.severity,
            title: tmpl.title,
            message: tmpl.message,
            timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }
  console.log('✅ Events seeded')

  // ── Widget Configs ─────────────────────────────────────────────────
  const globalWidgets = [
    { widgetKey: 'network_overview', widgetType: 'stat_tile', sortOrder: 0 },
    { widgetKey: 'product_health_grid', widgetType: 'health_card', sortOrder: 1 },
    { widgetKey: 'recent_activity', widgetType: 'events_list', sortOrder: 2 },
    { widgetKey: 'contacts_chart', widgetType: 'area_chart', sortOrder: 3 },
    { widgetKey: 'vps_overview', widgetType: 'stat_tile', sortOrder: 4 },
  ]
  for (const w of globalWidgets) {
    const exists = await prisma.dashboardWidgetConfig.findFirst({ where: { widgetKey: w.widgetKey, productId: null } })
    if (!exists) {
      await prisma.dashboardWidgetConfig.create({ data: { ...w, isVisible: true, settingsJson: '{}' } })
    }
  }

  // ── Contacts & Waitlist ────────────────────────────────────────────
  const contacts = [
    { name: 'Sipho Ndlovu', email: 'sipho@example.com', companyOrProject: 'TechVentures SA', message: 'Interested in Amarktai Crypto integration for our platform.' },
    { name: 'Amara Diallo', email: 'amara@example.com', companyOrProject: 'FinEdge Ltd', message: 'We would like to discuss a partnership opportunity.' },
    { name: 'James Osei', email: 'james.osei@example.com', companyOrProject: '', message: 'Love the Travel platform — would like to explore integrating it with our booking service.' },
  ]
  for (const c of contacts) {
    const exists = await prisma.contactSubmission.findFirst({ where: { email: c.email } })
    if (!exists) await prisma.contactSubmission.create({ data: c })
  }

  const waitlist = [
    { name: 'Zara Ahmed', email: 'zara@example.com', interest: 'crypto' },
    { name: 'Kwame Mensah', email: 'kwame@example.com', interest: 'travel' },
    { name: 'Aisha Kamara', email: 'aisha@example.com', interest: 'marketing' },
    { name: 'Tendai Moyo', email: 'tendai@example.com', interest: 'equiprofile' },
    { name: 'Olumide Bello', email: 'olumide@example.com', interest: 'crypto' },
  ]
  for (const w of waitlist) {
    const exists = await prisma.waitlistEntry.findFirst({ where: { email: w.email } })
    if (!exists) await prisma.waitlistEntry.create({ data: w })
  }
  console.log('✅ Contacts & waitlist seeded')

  // ── API Keys ───────────────────────────────────────────────────────
  const apiKeys = [
    { provider: 'Anthropic', label: 'Claude API', apiKey: 'sk-ant-••••••••••••••••', isActive: true },
    { provider: 'Coinbase', label: 'Crypto Data Feed', apiKey: 'cb_••••••••••••••••••••', isActive: false },
  ]
  for (const k of apiKeys) {
    const exists = await prisma.apiKey.findFirst({ where: { provider: k.provider, label: k.label } })
    if (!exists) await prisma.apiKey.create({ data: k })
  }
  console.log('✅ API keys seeded')

  // ── AI Provider Vault ─────────────────────────────────────────────
  const aiProviders = [
    { providerKey: 'openai',      displayName: 'OpenAI',       sortOrder: 1 },
    { providerKey: 'gemini',      displayName: 'Google Gemini', sortOrder: 2 },
    { providerKey: 'grok',        displayName: 'Grok / xAI',   sortOrder: 3 },
    { providerKey: 'qwen',        displayName: 'Qwen',          sortOrder: 4 },
    { providerKey: 'huggingface', displayName: 'Hugging Face',  sortOrder: 5 },
    { providerKey: 'nvidia',      displayName: 'NVIDIA',        sortOrder: 6 },
  ]
  for (const p of aiProviders) {
    await prisma.aiProvider.upsert({
      where: { providerKey: p.providerKey },
      update: { displayName: p.displayName, sortOrder: p.sortOrder },
      create: {
        providerKey: p.providerKey,
        displayName: p.displayName,
        enabled: false,
        apiKey: '',
        maskedPreview: '',
        healthStatus: 'unconfigured',
        healthMessage: 'No API key configured',
        sortOrder: p.sortOrder,
      },
    })
  }
  console.log('✅ AI provider vault seeded (6 providers · all unconfigured)')

  console.log('\n✨ Seeding complete!')
  console.log('   Admin login: admin@amarktai.com / admin123!')
  console.log('   Dashboard:   /admin/login')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
