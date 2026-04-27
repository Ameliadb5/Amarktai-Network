import { redirect } from 'next/navigation'

/** GenX Models route has been renamed to AI Engine. */
export default function GenXModelsPage() {
  redirect('/admin/dashboard/ai-engine')
}
