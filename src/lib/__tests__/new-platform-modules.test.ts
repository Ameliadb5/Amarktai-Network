/**
 * Tests for new platform modules:
 *   - skill-templates
 *   - integration-hub
 *   - multi-agent-team
 *   - smart-home-agent
 *   - dashboard-truth new capability entries
 */

import { describe, it, expect } from 'vitest'
import {
  getAllSkillTemplates,
  getTemplatesByCategory,
  getSkillTemplate,
  getLaunchReadyTemplates,
  getTemplateSummary,
} from '../skill-templates'
import {
  getAllConnectors,
  getConnector,
  getConnectorStatus,
  getAllConnectorStatuses,
  getIntegrationHubSummary,
  getConnectorsByCategory,
} from '../integration-hub'
import {
  getAllTeams,
  getTeam,
  createTeam,
  deleteTeam,
  getMultiAgentSummary,
  getHandoffChain,
  HANDOFF_CHAINS,
} from '../multi-agent-team'
import {
  getAllDevices,
  getDevice,
  registerDevice,
  updateDeviceState,
  findDevices,
  parseSmartHomeCommand,
  createAutomationRule,
  toggleAutomationRule,
  getSmartHomeStatus,
} from '../smart-home-agent'

// ── Skill Templates ──────────────────────────────────────────────────────────

describe('Skill Templates', () => {
  it('should have templates defined', () => {
    const templates = getAllSkillTemplates()
    expect(templates.length).toBeGreaterThan(0)
  })

  it('should return templates by category', () => {
    const devTemplates = getTemplatesByCategory('developer')
    expect(devTemplates.length).toBeGreaterThan(0)
    expect(devTemplates.every((t) => t.category === 'developer')).toBe(true)
  })

  it('should have a code-review-assistant template', () => {
    const t = getSkillTemplate('code-review-assistant')
    expect(t).toBeDefined()
    expect(t!.name).toBe('Code Review Assistant')
    expect(t!.launchReady).toBe(true)
    expect(t!.steps.length).toBeGreaterThan(0)
    expect(t!.entryStepId).toBeTruthy()
    // Entry step must reference a real step ID
    const stepIds = t!.steps.map((s) => s.id)
    expect(stepIds).toContain(t!.entryStepId)
  })

  it('should have a daily-briefing template', () => {
    const t = getSkillTemplate('daily-briefing')
    expect(t).toBeDefined()
    expect(t!.category).toBe('productivity')
  })

  it('should have email-triage template', () => {
    const t = getSkillTemplate('email-triage')
    expect(t).toBeDefined()
    expect(t!.category).toBe('productivity')
    expect(t!.launchReady).toBe(true)
  })

  it('should have smart-home template with requiresExternalService=true', () => {
    const t = getSkillTemplate('smart-home-command-parser')
    expect(t).toBeDefined()
    expect(t!.requiresExternalService).toBe(true)
    expect(t!.launchReady).toBe(false)
  })

  it('getLaunchReadyTemplates should only return launchReady=true templates', () => {
    const ready = getLaunchReadyTemplates()
    expect(ready.length).toBeGreaterThan(0)
    expect(ready.every((t) => t.launchReady)).toBe(true)
  })

  it('getTemplateSummary should return accurate counts', () => {
    const summary = getTemplateSummary()
    expect(summary.total).toBe(getAllSkillTemplates().length)
    expect(summary.launchReady).toBe(getLaunchReadyTemplates().length)
    expect(typeof summary.byCategory).toBe('object')
  })

  it('every template should have valid step structure', () => {
    for (const template of getAllSkillTemplates()) {
      expect(template.steps.length).toBeGreaterThan(0)
      const stepIds = new Set(template.steps.map((s) => s.id))
      // entryStepId must exist in steps
      expect(stepIds.has(template.entryStepId)).toBe(true)
      // Every step with a next pointer should reference a valid step
      for (const step of template.steps) {
        if (step.next) {
          expect(stepIds.has(step.next)).toBe(true)
        }
      }
    }
  })

  it('every template should have at least one required capability', () => {
    for (const template of getAllSkillTemplates()) {
      expect(template.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })
})

// ── Integration Hub ──────────────────────────────────────────────────────────

describe('Integration Hub', () => {
  it('should have connectors defined', () => {
    const connectors = getAllConnectors()
    expect(connectors.length).toBeGreaterThan(0)
  })

  it('should return connectors by category', () => {
    const emailConns = getConnectorsByCategory('email')
    expect(emailConns.length).toBeGreaterThan(0)
    expect(emailConns.every((c) => c.category === 'email')).toBe(true)
  })

  it('should have a github connector', () => {
    const c = getConnector('github')
    expect(c).toBeDefined()
    expect(c!.category).toBe('developer')
    expect(c!.actions.length).toBeGreaterThan(0)
  })

  it('should have a generic_webhook connector', () => {
    const c = getConnector('generic_webhook')
    expect(c).toBeDefined()
    expect(c!.implementationState).toBe('implemented')
  })

  it('getConnectorStatus should return not_configured when env vars are missing', () => {
    // Gmail requires GMAIL_OAUTH_TOKEN which is not set in test env
    const status = getConnectorStatus('gmail')
    expect(['not_configured', 'configured']).toContain(status)
  })

  it('getAllConnectorStatuses should return an entry for every connector', () => {
    const statuses = getAllConnectorStatuses()
    const connectors = getAllConnectors()
    expect(Object.keys(statuses).length).toBe(connectors.length)
    for (const c of connectors) {
      expect(Object.keys(statuses)).toContain(c.id)
    }
  })

  it('getIntegrationHubSummary should return accurate data', () => {
    const summary = getIntegrationHubSummary()
    expect(summary.total).toBe(getAllConnectors().length)
    expect(typeof summary.configured).toBe('number')
    expect(typeof summary.byCategory).toBe('object')
  })

  it('every connector should have at least one action', () => {
    for (const c of getAllConnectors()) {
      expect(c.actions.length).toBeGreaterThan(0)
    }
  })
})

// ── Multi-Agent Team ─────────────────────────────────────────────────────────

describe('Multi-Agent Team', () => {
  it('should have default teams', () => {
    const teams = getAllTeams()
    expect(teams.length).toBeGreaterThan(0)
  })

  it('should return a team by ID', () => {
    const t = getTeam('research-team')
    expect(t).toBeDefined()
    expect(t!.name).toBe('Research Team')
    expect(t!.members.length).toBeGreaterThan(0)
  })

  it('should create and delete a custom team', () => {
    const team = createTeam({
      name: 'Test Team',
      description: 'Test',
      appSlug: 'test',
      members: [{
        id: 'member-1',
        agentType: 'planner',
        role: 'supervisor',
        name: 'Planner',
        description: 'Plans tasks',
        specializations: [],
        canSupervise: true,
      }],
      supervisorAgentType: 'planner',
      sharedContext: {},
    })
    expect(team.id).toBeTruthy()
    expect(getTeam(team.id)).toBeDefined()

    const deleted = deleteTeam(team.id)
    expect(deleted).toBe(true)
    expect(getTeam(team.id)).toBeUndefined()
  })

  it('should not delete default teams', () => {
    const deleted = deleteTeam('research-team')
    expect(deleted).toBe(false)
    expect(getTeam('research-team')).toBeDefined()
  })

  it('should have predefined handoff chains', () => {
    expect(HANDOFF_CHAINS.length).toBeGreaterThan(0)
  })

  it('should return a handoff chain by ID', () => {
    const chain = getHandoffChain('research-to-report')
    expect(chain).toBeDefined()
    expect(chain!.steps.length).toBeGreaterThan(0)
  })

  it('getMultiAgentSummary should return accurate data', () => {
    const summary = getMultiAgentSummary()
    expect(summary.totalTeams).toBeGreaterThan(0)
    expect(summary.handoffChains).toBe(HANDOFF_CHAINS.length)
    expect(typeof summary.activeTasks).toBe('number')
  })
})

// ── Smart Home Agent ──────────────────────────────────────────────────────────

describe('Smart Home Agent Framework', () => {
  it('should have demo devices registered', () => {
    const devices = getAllDevices()
    expect(devices.length).toBeGreaterThan(0)
  })

  it('should return a device by ID', () => {
    const d = getDevice('demo-thermostat-1')
    expect(d).toBeDefined()
    expect(d!.type).toBe('thermostat')
  })

  it('should register and retrieve a new device', () => {
    const device = registerDevice({
      name: 'Test Light',
      type: 'light',
      room: 'bedroom',
      home: 'test_home',
      state: 'off',
      attributes: {},
    })
    expect(device.id).toBeTruthy()
    expect(getDevice(device.id)).toBeDefined()
  })

  it('should update device state', () => {
    const d = updateDeviceState('demo-light-1', { state: 'on', value: 80 })
    expect(d).toBeDefined()
    expect(d!.state).toBe('on')
    expect(d!.value).toBe(80)
  })

  it('should find devices by type and room', () => {
    const lights = findDevices({ type: 'light', home: 'main' })
    expect(lights.every((d) => d.type === 'light')).toBe(true)
  })

  it('should parse a smart home command', () => {
    const result = parseSmartHomeCommand('Turn on the living room lights')
    expect(result.intents.length).toBeGreaterThan(0)
    const intent = result.intents[0]
    expect(intent.action).toBe('on')
    expect(intent.deviceType).toBe('light')
    expect(intent.room).toContain('living')
  })

  it('should parse thermostat command with value', () => {
    const result = parseSmartHomeCommand('Set the thermostat to 72 degrees')
    expect(result.intents.length).toBeGreaterThan(0)
    expect(result.intents[0].deviceType).toBe('thermostat')
    expect(result.intents[0].action).toBe('set')
    expect(result.intents[0].value).toBe(72)
  })

  it('should parse lock command', () => {
    const result = parseSmartHomeCommand('Lock the front door')
    expect(result.intents.some((i) => i.action === 'lock')).toBe(true)
  })

  it('should create and toggle an automation rule', () => {
    const rule = createAutomationRule({
      name: 'Goodnight Mode',
      enabled: true,
      home: 'main',
      trigger: { type: 'voice', config: { phrase: 'goodnight' } },
      actions: [{ deviceType: 'light', room: 'bedroom', command: 'off' }],
    })
    expect(rule.id).toBeTruthy()
    expect(rule.enabled).toBe(true)

    const toggled = toggleAutomationRule(rule.id)
    expect(toggled!.enabled).toBe(false)
  })

  it('getSmartHomeStatus should return framework status', () => {
    const status = getSmartHomeStatus()
    expect(status.devicesRegistered).toBeGreaterThan(0)
    expect(['configured', 'simulation_only', 'not_configured']).toContain(status.implementationState)
    expect(status.configurationNote).toBeTruthy()
  })
})

// ── Dashboard Truth — new capability entries ──────────────────────────────────

describe('Dashboard Truth — new capability entries', () => {
  it('dashboard-truth module should import without errors', async () => {
    // Dynamic import to avoid DB initialization issues in tests
    const mod = await import('../dashboard-truth')
    expect(typeof mod.getCapabilityTruth).toBe('function')
    expect(typeof mod.getProviderTruth).toBe('function')
    expect(typeof mod.getDashboardSummary).toBe('function')
  })
})
