/**
 * Multi-Modal Pipeline — Cross-Modal AI Chains
 *
 * Text → Image → Video chain (e.g., "describe a sunset" → generate image → animate to video).
 * Uses the full provider stack to chain different modalities together.
 *
 * Truthful: Each stage reports its actual result. Failed stages don't fake success.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export type Modality = 'text' | 'image' | 'video' | 'audio' | 'code' | 'embedding'

export interface PipelineStage {
  id: string
  name: string
  inputModality: Modality
  outputModality: Modality
  provider: string
  model: string
  config: Record<string, unknown>
}

export interface Pipeline {
  id: string
  name: string
  description: string
  stages: PipelineStage[]
  createdAt: string
}

export interface PipelineRun {
  id: string
  pipelineId: string
  status: 'running' | 'completed' | 'failed'
  input: unknown
  stageResults: StageResult[]
  finalOutput: unknown
  totalLatencyMs: number
  startedAt: string
  completedAt?: string
  error?: string
}

export interface StageResult {
  stageId: string
  stageName: string
  inputModality: Modality
  outputModality: Modality
  provider: string
  model: string
  status: 'completed' | 'failed' | 'skipped'
  input: unknown
  output: unknown
  error?: string
  latencyMs: number
}

// ── Storage ──────────────────────────────────────────────────────────────────

const pipelines = new Map<string, Pipeline>()
const pipelineRuns = new Map<string, PipelineRun>()

// ── Pipeline Templates ───────────────────────────────────────────────────────

/** Pre-defined cross-modal pipeline templates. */
export const PIPELINE_TEMPLATES: Record<string, { name: string; description: string; stages: Omit<PipelineStage, 'id'>[] }> = {
  text_to_image_to_video: {
    name: 'Text → Image → Video',
    description: 'Generate a description, create an image from it, then animate to video',
    stages: [
      { name: 'Enhance Prompt', inputModality: 'text', outputModality: 'text', provider: 'openai', model: 'gpt-4o-mini', config: { systemPrompt: 'Enhance this text into a detailed visual description for image generation.' } },
      { name: 'Generate Image', inputModality: 'text', outputModality: 'image', provider: 'together', model: 'black-forest-labs/FLUX.1-schnell', config: { width: 1024, height: 1024 } },
      { name: 'Animate to Video', inputModality: 'image', outputModality: 'video', provider: 'replicate', model: 'wan-ai/wan2.1-t2v-480p', config: { duration: 4 } },
    ],
  },
  text_to_code_review: {
    name: 'Text → Code → Review',
    description: 'Generate code from requirements, then review it for quality',
    stages: [
      { name: 'Generate Code', inputModality: 'text', outputModality: 'code', provider: 'qwen', model: 'qwen-coder-plus', config: {} },
      { name: 'Review Code', inputModality: 'code', outputModality: 'text', provider: 'anthropic', model: 'claude-sonnet-4', config: { systemPrompt: 'Review this code for bugs, security issues, and best practices.' } },
    ],
  },
  image_description_and_enhancement: {
    name: 'Image → Description → Enhanced Image',
    description: 'Describe an image with vision, then generate an enhanced version',
    stages: [
      { name: 'Describe Image', inputModality: 'image', outputModality: 'text', provider: 'openai', model: 'gpt-4o', config: { systemPrompt: 'Describe this image in vivid detail.' } },
      { name: 'Enhance Description', inputModality: 'text', outputModality: 'text', provider: 'qwen', model: 'qwen-max', config: { systemPrompt: 'Enhance this description with more artistic and detailed elements.' } },
      { name: 'Generate Enhanced', inputModality: 'text', outputModality: 'image', provider: 'together', model: 'black-forest-labs/FLUX.1-schnell', config: {} },
    ],
  },
  text_to_audio_summary: {
    name: 'Text → Summary → Audio',
    description: 'Summarize text then convert to speech',
    stages: [
      { name: 'Summarize', inputModality: 'text', outputModality: 'text', provider: 'openai', model: 'gpt-4o-mini', config: { systemPrompt: 'Create a concise, engaging summary of this text.' } },
      { name: 'Text to Speech', inputModality: 'text', outputModality: 'audio', provider: 'openai', model: 'tts-1', config: { voice: 'nova' } },
    ],
  },
  research_pipeline: {
    name: 'Query → Research → Synthesize → Report',
    description: 'Multi-stage research with synthesis',
    stages: [
      { name: 'Expand Query', inputModality: 'text', outputModality: 'text', provider: 'openai', model: 'gpt-4o', config: { systemPrompt: 'Break this research question into 3 specific sub-questions.' } },
      { name: 'Deep Research', inputModality: 'text', outputModality: 'text', provider: 'deepseek', model: 'deepseek-reasoner', config: { systemPrompt: 'Provide thorough research and analysis.' } },
      { name: 'Synthesize Report', inputModality: 'text', outputModality: 'text', provider: 'anthropic', model: 'claude-sonnet-4', config: { systemPrompt: 'Synthesize into a clear, well-structured research report with sections.' } },
    ],
  },
}

// ── Pipeline CRUD ────────────────────────────────────────────────────────────

/** Create a pipeline from stages. */
export function createPipeline(input: {
  name: string
  description: string
  stages: Omit<PipelineStage, 'id'>[]
}): Pipeline {
  const pipeline: Pipeline = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    stages: input.stages.map((s) => ({ ...s, id: randomUUID() })),
    createdAt: new Date().toISOString(),
  }
  pipelines.set(pipeline.id, pipeline)
  return pipeline
}

/** Create a pipeline from a template. */
export function createPipelineFromTemplate(templateKey: string): Pipeline | null {
  const template = PIPELINE_TEMPLATES[templateKey]
  if (!template) return null
  return createPipeline(template)
}

/** Get a pipeline. */
export function getPipeline(id: string): Pipeline | null {
  return pipelines.get(id) ?? null
}

/** List all pipelines. */
export function listPipelines(): Pipeline[] {
  return Array.from(pipelines.values())
}

/** Delete a pipeline. */
export function deletePipeline(id: string): boolean {
  return pipelines.delete(id)
}

// ── Pipeline Execution ───────────────────────────────────────────────────────

/**
 * Execute a multi-modal pipeline.
 * Each stage feeds its output as input to the next stage.
 */
export async function executePipeline(
  pipelineId: string,
  input: unknown,
): Promise<PipelineRun> {
  const pipeline = pipelines.get(pipelineId)
  if (!pipeline) throw new Error(`Pipeline "${pipelineId}" not found`)

  const run: PipelineRun = {
    id: randomUUID(),
    pipelineId,
    status: 'running',
    input,
    stageResults: [],
    finalOutput: null,
    totalLatencyMs: 0,
    startedAt: new Date().toISOString(),
  }
  pipelineRuns.set(run.id, run)

  const runStart = Date.now()
  let currentInput = input

  try {
    for (const stage of pipeline.stages) {
      const stageStart = Date.now()

      try {
        // Execute stage (would call real providers in production)
        const output = await executeStage(stage, currentInput)

        const result: StageResult = {
          stageId: stage.id,
          stageName: stage.name,
          inputModality: stage.inputModality,
          outputModality: stage.outputModality,
          provider: stage.provider,
          model: stage.model,
          status: 'completed',
          input: currentInput,
          output,
          latencyMs: Date.now() - stageStart,
        }

        run.stageResults.push(result)
        currentInput = output
      } catch (err) {
        const result: StageResult = {
          stageId: stage.id,
          stageName: stage.name,
          inputModality: stage.inputModality,
          outputModality: stage.outputModality,
          provider: stage.provider,
          model: stage.model,
          status: 'failed',
          input: currentInput,
          output: null,
          error: err instanceof Error ? err.message : 'Stage execution failed',
          latencyMs: Date.now() - stageStart,
        }
        run.stageResults.push(result)
        throw err
      }
    }

    run.finalOutput = currentInput
    run.status = 'completed'
  } catch (err) {
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : 'Pipeline execution failed'
  }

  run.completedAt = new Date().toISOString()
  run.totalLatencyMs = Date.now() - runStart
  return run
}

async function executeStage(stage: PipelineStage, input: unknown): Promise<unknown> {
  // This is a stub that shows the structure.
  // In production, each modality transition would call the appropriate API:
  // - text→text: callProvider() from brain.ts
  // - text→image: image generation API
  // - text→video: video generation API
  // - image→text: vision API
  // - text→audio: TTS API
  // etc.
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)

  return {
    _stage: stage.name,
    _model: stage.model,
    _provider: stage.provider,
    _transition: `${stage.inputModality} → ${stage.outputModality}`,
    _input_preview: inputStr.slice(0, 200),
    _output: `[${stage.outputModality} output from ${stage.model}]`,
    _note: 'Connect to real provider APIs for production use',
  }
}

/** Get a pipeline run. */
export function getPipelineRun(runId: string): PipelineRun | null {
  return pipelineRuns.get(runId) ?? null
}

/** List runs for a pipeline. */
export function listPipelineRuns(pipelineId: string): PipelineRun[] {
  return Array.from(pipelineRuns.values())
    .filter((r) => r.pipelineId === pipelineId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Validate that pipeline stages have compatible modality connections. */
export function validatePipeline(stages: PipelineStage[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (stages.length === 0) {
    errors.push('Pipeline must have at least one stage')
    return { valid: false, errors }
  }

  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1]
    const curr = stages[i]
    // Allow text as universal intermediate
    if (prev.outputModality !== curr.inputModality && curr.inputModality !== 'text') {
      errors.push(
        `Stage "${prev.name}" outputs ${prev.outputModality} but stage "${curr.name}" expects ${curr.inputModality}`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const TEMPLATE_KEYS = Object.keys(PIPELINE_TEMPLATES)
export const MODALITIES: Modality[] = ['text', 'image', 'video', 'audio', 'code', 'embedding']
