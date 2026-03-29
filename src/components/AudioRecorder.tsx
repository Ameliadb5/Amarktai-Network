'use client'

/**
 * AudioRecorder — Browser audio recording component
 *
 * Captures audio from the user's microphone using the MediaRecorder API.
 * Records in webm format and provides:
 *   - Start / stop recording controls
 *   - Upload to /api/brain/stt for transcription
 *   - Real-time recording indicator
 *   - Audio playback before submission
 */

import { useState, useRef, useCallback } from 'react'

export interface AudioRecorderProps {
  /** Callback fired when transcription completes. */
  onTranscript?: (transcript: string) => void
  /** Optional STT endpoint override (default: /api/brain/stt). */
  sttEndpoint?: string
  /** Whisper model to use (default: whisper-1). */
  model?: string
  /** ISO language code for transcription. */
  language?: string
}

export default function AudioRecorder({
  onTranscript,
  sttEndpoint = '/api/brain/stt',
  model = 'whisper-1',
  language,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setError(null)
    setTranscript(null)
    setAudioUrl(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone access denied: ${err.message}`
          : 'Failed to access microphone',
      )
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const transcribeAudio = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    setIsTranscribing(true)
    setError(null)

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')
      formData.append('model', model)
      if (language) formData.append('language', language)

      const response = await fetch(sttEndpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Transcription failed (${response.status})`)
      }

      const data = await response.json()
      const text = data.transcript || data.text || ''
      setTranscript(text)
      onTranscript?.(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [model, language, sttEndpoint, onTranscript])

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-white/10 bg-black/20">
      <div className="flex items-center gap-3">
        {/* Record / Stop button */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <span className="w-3 h-3 rounded-full bg-white" />
            Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
          >
            <span className="w-3 h-3 rounded-sm bg-white" />
            Stop
          </button>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <span className="flex items-center gap-2 text-red-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording…
          </span>
        )}

        {/* Transcribe button */}
        {audioUrl && !isRecording && (
          <button
            onClick={transcribeAudio}
            disabled={isTranscribing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {isTranscribing ? 'Transcribing…' : 'Transcribe'}
          </button>
        )}
      </div>

      {/* Audio playback */}
      {audioUrl && (
        <audio controls src={audioUrl} className="w-full h-8" />
      )}

      {/* Transcript display */}
      {transcript && (
        <div className="p-3 rounded-lg bg-green-900/20 border border-green-500/20">
          <p className="text-xs text-green-400 mb-1 font-medium">Transcript:</p>
          <p className="text-sm text-white/90">{transcript}</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
