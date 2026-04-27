import { redirect } from 'next/navigation'

/** Voice access is not exposed in the current product surface. Redirect to access page. */
export default function VoiceAccessPage() {
  redirect('/contact')
}
