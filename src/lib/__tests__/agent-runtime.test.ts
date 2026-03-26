/**
 * Agent Runtime Tests
 *
 * Validates agent definitions, task creation, permission checks,
 * and runtime status reporting.
 */
import { describe, it, expect } from 'vitest'
import {
  getAgentDefinitions,
  getAgentDefinition,
  createAgentTask,
  getAgentStatus,
  isAgentPermitted,
  type AgentType,
} from '@/lib/agent-runtime'

describe('Agent Runtime', () => {
  describe('getAgentDefinitions', () => {
    it('returns definitions for all 10 agents', () => {
      const defs = getAgentDefinitions()
      expect(defs.size).toBe(10)
    })

    it('includes all required agent types', () => {
      const defs = getAgentDefinitions()
      const expectedTypes: AgentType[] = [
        'planner', 'router', 'validator', 'memory', 'retrieval',
        'creative', 'campaign', 'trading_analyst', 'app_ops', 'learning',
      ]
      for (const type of expectedTypes) {
        expect(defs.get(type), `Missing agent: ${type}`).toBeDefined()
        expect(defs.get(type)!.name).toBeTruthy()
        expect(defs.get(type)!.description).toBeTruthy()
      }
    })

    it('every agent has capabilities defined', () => {
      const defs = getAgentDefinitions()
      for (const [type, def] of defs) {
        expect(def.capabilities.length, `${type} has no capabilities`).toBeGreaterThan(0)
      }
    })
  })

  describe('getAgentDefinition', () => {
    it('returns definition for specific agent type', () => {
      const planner = getAgentDefinition('planner')
      expect(planner).toBeDefined()
      expect(planner.type).toBe('planner')
    })

    it('throws for unknown type', () => {
      expect(() => getAgentDefinition('nonexistent' as AgentType)).toThrow()
    })
  })

  describe('createAgentTask', () => {
    it('creates a task with generated id for permitted app', () => {
      // amarktai-network has FULL_AGENT_PERMISSIONS
      const task = createAgentTask('planner', 'amarktai-network', {
        message: 'Plan a marketing campaign',
      })
      expect(task.id).toBeTruthy()
      expect(task.agentType).toBe('planner')
      expect(task.appSlug).toBe('amarktai-network')
      expect(task.status).toBe('idle')
      expect(task.output).toBeNull()
      expect(task.startedAt).toBeInstanceOf(Date)
    })

    it('throws when app lacks permission', () => {
      // Default/unknown apps may not have all agent permissions
      expect(() => createAgentTask('trading_analyst', 'test-app', {
        message: 'Analyze the market',
      })).toThrow(/not permitted/)
    })
  })

  describe('getAgentStatus', () => {
    it('returns runtime status summary', () => {
      const status = getAgentStatus()
      expect(status).toBeDefined()
      expect(typeof status.configuredAgents).toBe('number')
      expect(status.configuredAgents).toBe(10)
    })
  })

  describe('isAgentPermitted', () => {
    it('checks permission based on app profile', () => {
      const result = isAgentPermitted('planner', 'amarktai-network')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('agent handoff rules', () => {
    it('planner can hand off to router', () => {
      const planner = getAgentDefinition('planner')
      expect(planner.canHandoff).toContain('router')
    })

    it('campaign can hand off to creative', () => {
      const campaign = getAgentDefinition('campaign')
      expect(campaign.canHandoff).toContain('creative')
    })
  })
})
