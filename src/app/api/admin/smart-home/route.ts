import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getAllDevices,
  getDevice,
  registerDevice,
  updateDeviceState,
  findDevices,
  parseSmartHomeCommand,
  dispatchDeviceCommand,
  getAllAutomationRules,
  createAutomationRule,
  toggleAutomationRule,
  getSmartHomeStatus,
  type DeviceType,
} from '@/lib/smart-home-agent'

/**
 * GET /api/admin/smart-home
 *
 * Query params:
 *   id        - get a single device
 *   type      - filter devices by type
 *   room      - filter devices by room
 *   home      - filter devices by home
 *   rules     - get automation rules
 *   status    - get framework status
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') as DeviceType | null
  const room = searchParams.get('room') ?? undefined
  const home = searchParams.get('home') ?? undefined
  const rulesOnly = searchParams.has('rules')
  const statusOnly = searchParams.has('status')

  if (statusOnly) {
    return NextResponse.json({ status: getSmartHomeStatus() })
  }

  if (rulesOnly) {
    return NextResponse.json({ rules: getAllAutomationRules(home) })
  }

  if (id) {
    const device = getDevice(id)
    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    return NextResponse.json({ device })
  }

  const devices = type || room
    ? findDevices({ type: type ?? undefined, room, home })
    : getAllDevices(home)

  return NextResponse.json({
    devices,
    count: devices.length,
    status: getSmartHomeStatus(),
  })
}

/**
 * POST /api/admin/smart-home
 *
 * Body actions:
 *   { action: 'register_device', ...deviceParams }
 *   { action: 'command', command, home }          — parse + dispatch NL command
 *   { action: 'dispatch_intent', intent }          — dispatch a pre-parsed intent
 *   { action: 'update_state', deviceId, state }
 *   { action: 'create_rule', ...ruleParams }
 *   { action: 'toggle_rule', ruleId }
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'register_device') {
      const { name, type, room, home, attributes, hubDeviceId } = body
      if (!name || !type || !room || !home) {
        return NextResponse.json({ error: 'name, type, room, and home are required' }, { status: 400 })
      }
      const device = registerDevice({ name, type, room, home, state: 'unknown', attributes: attributes ?? {}, hubDeviceId })
      return NextResponse.json({ success: true, device })
    }

    if (action === 'command') {
      const { command, home = 'main' } = body
      if (!command) return NextResponse.json({ error: 'command is required' }, { status: 400 })

      const parsed = parseSmartHomeCommand(command, home)
      const dispatchResults = await Promise.all(parsed.intents.map((intent) => dispatchDeviceCommand(intent)))

      return NextResponse.json({
        success: dispatchResults.every((r) => r.success),
        parsed,
        dispatched: dispatchResults,
      })
    }

    if (action === 'dispatch_intent') {
      const { intent } = body
      if (!intent) return NextResponse.json({ error: 'intent is required' }, { status: 400 })
      const result = await dispatchDeviceCommand(intent)
      return NextResponse.json({ success: result.success, result })
    }

    if (action === 'update_state') {
      const { deviceId, state } = body
      if (!deviceId) return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
      const device = updateDeviceState(deviceId, state)
      if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
      return NextResponse.json({ success: true, device })
    }

    if (action === 'create_rule') {
      const { name, home, trigger, actions: ruleActions } = body
      if (!name || !trigger || !ruleActions?.length) {
        return NextResponse.json({ error: 'name, trigger, and actions are required' }, { status: 400 })
      }
      const rule = createAutomationRule({ name, enabled: true, home: home ?? 'main', trigger, actions: ruleActions })
      return NextResponse.json({ success: true, rule })
    }

    if (action === 'toggle_rule') {
      const { ruleId } = body
      if (!ruleId) return NextResponse.json({ error: 'ruleId is required' }, { status: 400 })
      const rule = toggleAutomationRule(ruleId)
      if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
      return NextResponse.json({ success: true, rule })
    }

    return NextResponse.json({ error: 'Invalid action. Use: register_device, command, dispatch_intent, update_state, create_rule, toggle_rule' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Smart home operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
