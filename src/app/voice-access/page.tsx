import { redirect } from 'next/navigation'

/** Voice access route removed in Phase 3I. Redirect to home. */
export default function VoiceAccessPage() {
  redirect('/')
}
