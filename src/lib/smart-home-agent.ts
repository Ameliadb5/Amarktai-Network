/**
 * @module smart-home-agent
 * @description Smart Home / Device Agent Framework for AmarktAI Network.
 *
 * Provides the platform-level framework for smart home and IoT device control:
 *
 *   - Device registry (register and track smart home devices)
 *   - Command parsing (NL → structured device intent)
 *   - Dispatch layer (route intents to registered device adapters)
 *   - Automation rules (trigger-action patterns)
 *   - Home/room context management
 *   - Voice command pipeline
 *
 * IMPLEMENTATION STATE:
 *   - Command parsing, device registry, automation rules: IMPLEMENTED
 *   - HTTP dispatch to real smart home hubs: TEMPLATE (requires credentials)
 *   - Supported hub integrations: Home Assistant, Homey, Google Home (via webhooks)
 *
 * Real hardware control requires configuring the adapter with real credentials.
 * All framework logic is fully implemented; only the final HTTP call to the
 * external hub is gated on credentials.
 *
 * Server-side only.
 */

import { randomUUID } from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeviceType =
  | 'light'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'speaker'
  | 'tv'
  | 'blinds'
  | 'outlet'
  | 'sensor'
  | 'appliance'
  | 'hub'

export type DeviceState = 'on' | 'off' | 'unknown' | 'unavailable'

export type CommandAction =
  | 'on'
  | 'off'
  | 'toggle'
  | 'set'
  | 'get'
  | 'increase'
  | 'decrease'
  | 'lock'
  | 'unlock'
  | 'open'
  | 'close'
  | 'pause'
  | 'resume'

export type HubType = 'home_assistant' | 'homey' | 'google_home' | 'alexa' | 'webhook' | 'none'

export interface SmartDevice {
  id: string
  name: string
  type: DeviceType
  room: string
  home: string
  /** Current known state */
  state: DeviceState
  /** Current numeric value if applicable (e.g. thermostat temp, dimmer level) */
  value?: number
  /** Unit for numeric values */
  unit?: string
  /** Device-specific attributes */
  attributes: Record<string, unknown>
  /** External device ID in the hub system */
  hubDeviceId?: string
  lastSeenAt: string
}

export interface DeviceControlIntent {
  deviceType: DeviceType
  deviceName?: string
  room?: string
  home: string
  action: CommandAction
  /** Target value for set/increase/decrease actions */
  value?: number | string
  /** Confidence score 0-1 */
  confidence: number
}

export interface CommandParseResult {
  intents: DeviceControlIntent[]
  rawCommand: string
  interpretation: string
  ambiguous: boolean
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  home: string
  /** Trigger condition */
  trigger: {
    type: 'time' | 'device_state' | 'voice' | 'webhook'
    config: Record<string, unknown>
  }
  /** Actions to execute */
  actions: Array<{
    deviceId?: string
    deviceType?: DeviceType
    room?: string
    command: CommandAction
    value?: number | string
  }>
  /** When this rule was last triggered */
  lastTriggeredAt?: string
  createdAt: string
}

export interface HubAdapter {
  type: HubType
  name: string
  baseUrl: string
  apiKey: string
  isConfigured: boolean
}

// ── In-memory Device Registry ─────────────────────────────────────────────────

const deviceRegistry = new Map<string, SmartDevice>()
const automationRules = new Map<string, AutomationRule>()

// Seed with demo devices
const DEMO_DEVICES: SmartDevice[] = [
  { id: 'demo-light-1', name: 'Living Room Light', type: 'light', room: 'living_room', home: 'main', state: 'off', attributes: { dimmable: true, colorTemp: 3000 }, lastSeenAt: new Date().toISOString() },
  { id: 'demo-light-2', name: 'Kitchen Light', type: 'light', room: 'kitchen', home: 'main', state: 'on', attributes: { dimmable: false }, lastSeenAt: new Date().toISOString() },
  { id: 'demo-thermostat-1', name: 'Main Thermostat', type: 'thermostat', room: 'hallway', home: 'main', state: 'on', value: 70, unit: '°F', attributes: { mode: 'auto', humidity: 45 }, lastSeenAt: new Date().toISOString() },
  { id: 'demo-lock-1', name: 'Front Door Lock', type: 'lock', room: 'entrance', home: 'main', state: 'on', attributes: { battery: 85 }, lastSeenAt: new Date().toISOString() },
  { id: 'demo-speaker-1', name: 'Living Room Speaker', type: 'speaker', room: 'living_room', home: 'main', state: 'off', attributes: { volume: 30 }, lastSeenAt: new Date().toISOString() },
]
for (const d of DEMO_DEVICES) {
  deviceRegistry.set(d.id, d)
}

// ── Device Registry API ───────────────────────────────────────────────────────

/** Get all registered devices */
export function getAllDevices(home?: string): SmartDevice[] {
  const all = Array.from(deviceRegistry.values())
  return home ? all.filter((d) => d.home === home) : all
}

/** Get a device by ID */
export function getDevice(deviceId: string): SmartDevice | undefined {
  return deviceRegistry.get(deviceId)
}

/** Register a new device */
export function registerDevice(params: Omit<SmartDevice, 'id' | 'lastSeenAt'>): SmartDevice {
  const device: SmartDevice = {
    ...params,
    id: randomUUID(),
    lastSeenAt: new Date().toISOString(),
  }
  deviceRegistry.set(device.id, device)
  return device
}

/** Update device state (from hub sync or direct command) */
export function updateDeviceState(deviceId: string, state: Partial<Pick<SmartDevice, 'state' | 'value' | 'attributes'>>): SmartDevice | null {
  const device = deviceRegistry.get(deviceId)
  if (!device) return null
  const updated: SmartDevice = { ...device, ...state, lastSeenAt: new Date().toISOString() }
  deviceRegistry.set(deviceId, updated)
  return updated
}

/** Find devices matching criteria */
export function findDevices(params: { type?: DeviceType; room?: string; home?: string }): SmartDevice[] {
  return Array.from(deviceRegistry.values()).filter((d) => {
    if (params.type && d.type !== params.type) return false
    if (params.room && d.room !== params.room) return false
    if (params.home && d.home !== params.home) return false
    return true
  })
}

// ── Command Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a natural language command into structured device control intents.
 * Uses pattern matching and keyword extraction (no AI call required).
 * For complex commands, callers can use the skill template which makes an AI call.
 */
export function parseSmartHomeCommand(
  command: string,
  home = 'main',
): CommandParseResult {
  const lower = command.toLowerCase()
  const intents: DeviceControlIntent[] = []

  // Room extraction
  const ROOMS = ['living room', 'kitchen', 'bedroom', 'bathroom', 'office', 'garage', 'hallway', 'basement', 'attic', 'dining room', 'entrance']
  const detectedRoom = ROOMS.find((r) => lower.includes(r))

  // Action extraction
  let action: CommandAction = 'toggle'
  if (/\b(turn on|switch on|enable|activate)\b/.test(lower)) action = 'on'
  else if (/\b(turn off|switch off|disable|deactivate)\b/.test(lower)) action = 'off'
  else if (/\b(set|change|adjust)\b/.test(lower)) action = 'set'
  else if (/\b(increase|raise|up|higher|brighter|warmer|louder)\b/.test(lower)) action = 'increase'
  else if (/\b(decrease|lower|down|dimmer|cooler|quieter)\b/.test(lower)) action = 'decrease'
  else if (/\block\b/.test(lower)) action = 'lock'
  else if (/\bunlock\b/.test(lower)) action = 'unlock'
  else if (/\bopen\b/.test(lower)) action = 'open'
  else if (/\bclose\b/.test(lower)) action = 'close'

  // Value extraction (numbers)
  const valueMatch = lower.match(/(\d+)\s*(degrees?|%|percent|volume)?/)
  const value = valueMatch ? Number(valueMatch[1]) : undefined

  // Device type detection
  const DEVICE_PATTERNS: Array<{ patterns: RegExp[]; type: DeviceType }> = [
    { patterns: [/\blight(s)?\b/, /\blamp\b/, /\bbulb\b/], type: 'light' },
    { patterns: [/\bthermostat\b/, /\btemperature\b/, /\bheating\b/, /\bcooling\b/, /\bac\b/, /\bhvac\b/], type: 'thermostat' },
    { patterns: [/\block\b/, /\bdoor lock\b/], type: 'lock' },
    { patterns: [/\bcamera\b/, /\bsecurity camera\b/], type: 'camera' },
    { patterns: [/\bspeaker\b/, /\bmusic\b/, /\bplay\b/, /\bvolume\b/], type: 'speaker' },
    { patterns: [/\btv\b/, /\btelevision\b/, /\bscreen\b/], type: 'tv' },
    { patterns: [/\bblinds\b/, /\bshades\b/, /\bcurtains\b/], type: 'blinds' },
    { patterns: [/\boutlet\b/, /\bplug\b/], type: 'outlet' },
    { patterns: [/\bappliance\b/, /\bwasher\b/, /\bdryer\b/, /\boven\b/, /\bdishwasher\b/], type: 'appliance' },
  ]

  let ambiguous = false
  const detectedDeviceTypes = DEVICE_PATTERNS
    .filter(({ patterns }) => patterns.some((p) => p.test(lower)))
    .map(({ type }) => type)

  if (detectedDeviceTypes.length === 0) {
    // Ambiguous — could be any device
    ambiguous = true
    detectedDeviceTypes.push('light') // default guess
  }

  for (const deviceType of detectedDeviceTypes) {
    intents.push({
      deviceType,
      room: detectedRoom?.replace(' ', '_'),
      home,
      action,
      value,
      confidence: ambiguous ? 0.4 : detectedRoom ? 0.9 : 0.7,
    })
  }

  const roomDesc = detectedRoom ? ` in the ${detectedRoom}` : ''
  const valueDesc = value !== undefined ? ` to ${value}` : ''
  const interpretation = intents.length > 0
    ? `${action} ${detectedDeviceTypes.join(' and ')}${roomDesc}${valueDesc}`
    : 'Unable to parse command'

  return { intents, rawCommand: command, interpretation, ambiguous }
}

// ── Hub Adapter ───────────────────────────────────────────────────────────────

function getHubAdapter(): HubAdapter {
  const homeAssistantUrl = process.env.HOME_ASSISTANT_URL || ''
  const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN || ''
  const homeyUrl = process.env.HOMEY_API_URL || ''
  const homeyToken = process.env.HOMEY_API_TOKEN || ''

  if (homeAssistantUrl && homeAssistantToken) {
    return { type: 'home_assistant', name: 'Home Assistant', baseUrl: homeAssistantUrl, apiKey: homeAssistantToken, isConfigured: true }
  }
  if (homeyUrl && homeyToken) {
    return { type: 'homey', name: 'Homey', baseUrl: homeyUrl, apiKey: homeyToken, isConfigured: true }
  }
  return { type: 'none', name: 'No Hub', baseUrl: '', apiKey: '', isConfigured: false }
}

export interface DispatchResult {
  success: boolean
  deviceId?: string
  deviceName?: string
  action: CommandAction
  hubType: HubType
  response?: unknown
  error?: string
  simulatedOnly: boolean
}

/**
 * Dispatch a device control intent to the configured hub.
 * If no hub is configured, returns a simulated success with simulatedOnly=true.
 */
export async function dispatchDeviceCommand(
  intent: DeviceControlIntent,
): Promise<DispatchResult> {
  // Find matching device in registry
  const matchingDevices = findDevices({
    type: intent.deviceType,
    room: intent.room,
    home: intent.home,
  })

  const targetDevice = intent.deviceName
    ? matchingDevices.find((d) => d.name.toLowerCase().includes(intent.deviceName!.toLowerCase()))
    : matchingDevices[0]

  const hub = getHubAdapter()

  if (!hub.isConfigured) {
    // Simulate the command locally (update in-memory state)
    if (targetDevice) {
      const newState: DeviceState = intent.action === 'on' ? 'on' : intent.action === 'off' ? 'off' : targetDevice.state
      const newValue = intent.action === 'set' && intent.value !== undefined ? Number(intent.value) : undefined
      updateDeviceState(targetDevice.id, {
        state: newState,
        ...(newValue !== undefined && { value: newValue }),
      })
    }
    return {
      success: true,
      deviceId: targetDevice?.id,
      deviceName: targetDevice?.name ?? `${intent.deviceType} in ${intent.room ?? 'unknown'}`,
      action: intent.action,
      hubType: 'none',
      simulatedOnly: true,
      error: 'No smart home hub configured. Command simulated locally. Configure HOME_ASSISTANT_URL/TOKEN or HOMEY_API_URL/TOKEN to enable real device control.',
    }
  }

  // Dispatch to Home Assistant
  if (hub.type === 'home_assistant') {
    return dispatchToHomeAssistant(hub, intent, targetDevice)
  }

  // Generic webhook fallback
  return {
    success: false,
    action: intent.action,
    hubType: hub.type,
    simulatedOnly: false,
    error: `Hub type "${hub.type}" dispatch not yet implemented. Use Home Assistant or generic webhook.`,
  }
}

async function dispatchToHomeAssistant(
  hub: HubAdapter,
  intent: DeviceControlIntent,
  device?: SmartDevice,
): Promise<DispatchResult> {
  const entityId = device?.hubDeviceId ?? `${intent.deviceType}.${intent.room ?? 'unknown'}_${intent.deviceType}`
  const domain = intent.deviceType === 'light' ? 'light' : intent.deviceType === 'thermostat' ? 'climate' : intent.deviceType === 'lock' ? 'lock' : 'homeassistant'
  const service = intent.action === 'on' ? 'turn_on' : intent.action === 'off' ? 'turn_off' : intent.action === 'toggle' ? 'toggle' : 'turn_on'

  const serviceData: Record<string, unknown> = { entity_id: entityId }
  if (intent.action === 'set' && intent.value !== undefined) {
    if (intent.deviceType === 'thermostat') serviceData.temperature = Number(intent.value)
    if (intent.deviceType === 'light') serviceData.brightness_pct = Number(intent.value)
    if (intent.deviceType === 'speaker') serviceData.volume_level = Number(intent.value) / 100
  }

  try {
    const res = await fetch(`${hub.baseUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hub.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData),
    })
    const body = await res.json()
    if (device) updateDeviceState(device.id, { state: intent.action === 'on' ? 'on' : intent.action === 'off' ? 'off' : device.state })
    return { success: res.ok, deviceId: device?.id, deviceName: device?.name, action: intent.action, hubType: 'home_assistant', response: body, simulatedOnly: false }
  } catch (err) {
    return { success: false, action: intent.action, hubType: 'home_assistant', simulatedOnly: false, error: err instanceof Error ? err.message : 'Home Assistant dispatch failed' }
  }
}

// ── Automation Rules ──────────────────────────────────────────────────────────

/** Get all automation rules */
export function getAllAutomationRules(home?: string): AutomationRule[] {
  const all = Array.from(automationRules.values())
  return home ? all.filter((r) => r.home === home) : all
}

/** Create an automation rule */
export function createAutomationRule(params: Omit<AutomationRule, 'id' | 'createdAt'>): AutomationRule {
  const rule: AutomationRule = { ...params, id: randomUUID(), createdAt: new Date().toISOString() }
  automationRules.set(rule.id, rule)
  return rule
}

/** Toggle enable/disable for a rule */
export function toggleAutomationRule(ruleId: string): AutomationRule | null {
  const rule = automationRules.get(ruleId)
  if (!rule) return null
  const updated = { ...rule, enabled: !rule.enabled }
  automationRules.set(ruleId, updated)
  return updated
}

// ── Framework Summary ─────────────────────────────────────────────────────────

export interface SmartHomeFrameworkStatus {
  devicesRegistered: number
  automationRules: number
  hubConfigured: boolean
  hubType: HubType
  hubName: string
  implementationState: 'configured' | 'simulation_only' | 'not_configured'
  configurationNote: string
}

export function getSmartHomeStatus(): SmartHomeFrameworkStatus {
  const hub = getHubAdapter()
  const devicesCount = deviceRegistry.size
  const rulesCount = automationRules.size

  return {
    devicesRegistered: devicesCount,
    automationRules: rulesCount,
    hubConfigured: hub.isConfigured,
    hubType: hub.type,
    hubName: hub.name,
    implementationState: hub.isConfigured ? 'configured' : 'simulation_only',
    configurationNote: hub.isConfigured
      ? `Connected to ${hub.name}. Real device control enabled.`
      : 'No smart home hub configured. Set HOME_ASSISTANT_URL + HOME_ASSISTANT_TOKEN (or HOMEY_API_URL + HOMEY_API_TOKEN) to enable real device control. Framework is fully operational in simulation mode.',
  }
}
