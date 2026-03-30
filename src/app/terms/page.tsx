import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2026'

const sections: { title: string; content: string }[] = [
  {
    title: 'Acceptance of Terms',
    content: 'By accessing or using the Amarktai Network platform and any of its associated applications and services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not access or use our Services.\n\nThese Terms constitute a legally binding agreement between you and Amarktai Network ("Company," "we," "our," or "us"). We reserve the right to update these Terms at any time, and your continued use of the Services after any changes constitutes acceptance of the new Terms.',
  },
  {
    title: 'Description of Services',
    content: 'Amarktai Network provides an interconnected suite of AI-powered applications and platforms spanning multiple domains:\n\n• Financial intelligence and market analysis tools\n• Community platforms and social networking\n• Educational services and learning environments\n• Security and identity verification products\n\nIndividual applications may be subject to additional terms. In cases of conflict, the specific application terms take precedence. We reserve the right to modify, suspend, or discontinue any part of our Services at any time.',
  },
  {
    title: 'User Accounts & Registration',
    content: 'To access certain features, you may be required to create an account. You agree to:\n\n• Provide accurate, current, and complete information during registration\n• Maintain and promptly update your account information\n• Keep your password secure and confidential\n• Accept responsibility for all activities under your account\n• Notify us immediately of any unauthorized use\n\nWe reserve the right to suspend or terminate accounts that violate these Terms or are used fraudulently.',
  },
  {
    title: 'Acceptable Use',
    content: 'You agree to use our Services only for lawful purposes. You must not:\n\n• Violate applicable local, national, or international laws\n• Restrict or inhibit anyone\'s use or enjoyment of the Services\n• Transmit unsolicited advertising or promotional material\n• Attempt unauthorized access to any part of our Services\n• Interfere with or disrupt the integrity or performance of the Services\n• Use automated tools to scrape or extract data without written consent\n• Impersonate any person or entity\n• Upload or transmit viruses, malware, or malicious code',
  },
  {
    title: 'Intellectual Property Rights',
    content: 'The Services and their original content, features, and functionality are the exclusive property of Amarktai Network and its licensors. Our trademarks may not be used without prior written consent.\n\nYou retain ownership of content you submit. By submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with operating the Services.',
  },
  {
    title: 'Financial Services Disclaimer',
    content: 'Certain applications provide financial market data, analysis, and intelligence tools. This information is for informational and educational purposes only and does not constitute financial, investment, or trading advice.\n\nAmarktai Network is not a registered investment advisor, broker-dealer, or financial institution. Investment decisions based on our Services are made solely at your own risk. Past performance is not indicative of future results. Consult a qualified financial advisor before making investment decisions.',
  },
  {
    title: 'Limitation of Liability',
    content: 'To the maximum extent permitted by law, Amarktai Network shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, resulting from:\n\n• Your access to or inability to access the Services\n• Any conduct or content of any third party on the Services\n• Any content obtained from the Services\n• Unauthorized access or alteration of your transmissions\n\nOur aggregate liability shall not exceed $100 or the amount you paid us in the twelve months prior to the claim.',
  },
  {
    title: 'Disclaimer of Warranties',
    content: 'The Services are provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.\n\nWe do not warrant that the Services will be uninterrupted, error-free, or completely secure. Some jurisdictions do not allow the exclusion of implied warranties, so the above may not apply to you.',
  },
  {
    title: 'Termination',
    content: 'We may terminate or suspend your access immediately, without prior notice or liability, for any reason, including breach of these Terms.\n\nUpon termination, your right to use the Services will immediately cease. All provisions that should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability. You may terminate your account at any time by contacting us.',
  },
  {
    title: 'Governing Law & Dispute Resolution',
    content: 'These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Disputes shall first be subject to good-faith negotiation.\n\nIf unresolved, disputes shall be submitted to binding arbitration. Each party shall bear their own costs unless the arbitrator determines otherwise. Nothing in this section prevents either party from seeking injunctive relief in cases of IP infringement or breach of confidentiality.',
  },
  {
    title: 'Changes to Terms',
    content: 'We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the "Last Updated" date and, where appropriate, by sending you an email or displaying a notice through our Services.\n\nYour continued use after changes constitutes acceptance of the revised Terms. If you do not agree, you must stop using the Services.',
  },
  {
    title: 'Contact Information',
    content: 'If you have questions about these Terms of Service, please contact us:\n\nAmarktai Network\nEmail: legal@amarktai.com\n\nWe will respond to all legitimate legal inquiries in a timely manner.',
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="ambient-drift absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-600/5 blur-[140px]" />
      </div>

      <div className="relative z-10">
      <section className="pt-32 pb-10 px-6 text-center">
        <h1 className="font-heading text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          Terms of Service
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          The rules and agreements governing your use of the Amarktai Network.
        </p>
        <p className="text-sm text-slate-600 mt-3">Last updated: {lastUpdated}</p>
      </section>

      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="border border-white/[0.06] rounded-xl p-8 mb-10 bg-white/[0.02]">
            <p className="text-slate-400 leading-relaxed text-[15px]">
              These Terms of Service govern your access to and use of the Amarktai Network platform, including all
              associated applications, features, and services. By using our Services, you confirm that you are at
              least 16 years of age and have the legal authority to enter into these Terms on your own behalf or on
              behalf of an organization.
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((section, i) => (
              <div key={i}>
                <h2 className="font-heading text-lg font-bold text-white mb-3">
                  {i + 1}. {section.title}
                </h2>
                <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors">
              &larr; Back to Home
            </Link>
            <Link href="/privacy" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View Privacy Policy &rarr;
            </Link>
          </div>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  )
}
