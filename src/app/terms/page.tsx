import Link from 'next/link'
import { Scale, ArrowLeft, ChevronRight } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2026'

const sections = [
  {
    number: '01',
    title: 'Acceptance of Terms',
    content: `By accessing or using the Amarktai Network platform and any of its associated applications and services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not access or use our Services.\n\nThese Terms constitute a legally binding agreement between you and Amarktai Network ("Company," "we," "our," or "us"). We reserve the right to update these Terms at any time, and your continued use of the Services after any changes constitutes acceptance of the new Terms.`,
  },
  {
    number: '02',
    title: 'Description of Services',
    content: `Amarktai Network provides an interconnected suite of AI-powered applications and platforms spanning multiple domains:\n\n• Financial intelligence and market analysis tools\n• Community platforms and social networking\n• Educational services and learning environments\n• Security and identity verification products\n\nIndividual applications may be subject to additional terms. In cases of conflict, the specific application terms take precedence. We reserve the right to modify, suspend, or discontinue any part of our Services at any time.`,
  },
  {
    number: '03',
    title: 'User Accounts & Registration',
    content: `To access certain features, you may be required to create an account. You agree to:\n\n• Provide accurate, current, and complete information during registration\n• Maintain and promptly update your account information\n• Keep your password secure and confidential\n• Accept responsibility for all activities under your account\n• Notify us immediately of any unauthorized use\n\nWe reserve the right to suspend or terminate accounts that violate these Terms or are used fraudulently.`,
  },
  {
    number: '04',
    title: 'Acceptable Use',
    content: `You agree to use our Services only for lawful purposes. You must not:\n\n• Violate applicable local, national, or international laws\n• Restrict or inhibit anyone's use or enjoyment of the Services\n• Transmit unsolicited advertising or promotional material\n• Attempt unauthorized access to any part of our Services\n• Interfere with or disrupt the integrity or performance of the Services\n• Use automated tools to scrape or extract data without written consent\n• Impersonate any person or entity\n• Upload or transmit viruses, malware, or malicious code`,
  },
  {
    number: '05',
    title: 'Intellectual Property Rights',
    content: `The Services and their original content, features, and functionality are the exclusive property of Amarktai Network and its licensors. Our trademarks may not be used without prior written consent.\n\nYou retain ownership of content you submit. By submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with operating the Services.`,
  },
  {
    number: '06',
    title: 'Financial Services Disclaimer',
    content: `Certain applications provide financial market data, analysis, and intelligence tools. This information is for informational and educational purposes only and does not constitute financial, investment, or trading advice.\n\nAmarktai Network is not a registered investment advisor, broker-dealer, or financial institution. Investment decisions based on our Services are made solely at your own risk. Past performance is not indicative of future results. Consult a qualified financial advisor before making investment decisions.`,
  },
  {
    number: '07',
    title: 'Limitation of Liability',
    content: `To the maximum extent permitted by law, Amarktai Network shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, resulting from:\n\n• Your access to or inability to access the Services\n• Any conduct or content of any third party on the Services\n• Any content obtained from the Services\n• Unauthorized access or alteration of your transmissions\n\nOur aggregate liability shall not exceed $100 or the amount you paid us in the twelve months prior to the claim.`,
  },
  {
    number: '08',
    title: 'Disclaimer of Warranties',
    content: `The Services are provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.\n\nWe do not warrant that the Services will be uninterrupted, error-free, or completely secure. Some jurisdictions do not allow the exclusion of implied warranties, so the above may not apply to you.`,
  },
  {
    number: '09',
    title: 'Termination',
    content: `We may terminate or suspend your access immediately, without prior notice or liability, for any reason, including breach of these Terms.\n\nUpon termination, your right to use the Services will immediately cease. All provisions that should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability. You may terminate your account at any time by contacting us.`,
  },
  {
    number: '10',
    title: 'Governing Law & Dispute Resolution',
    content: `These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Disputes shall first be subject to good-faith negotiation.\n\nIf unresolved, disputes shall be submitted to binding arbitration. Each party shall bear their own costs unless the arbitrator determines otherwise. Nothing in this section prevents either party from seeking injunctive relief in cases of IP infringement or breach of confidentiality.`,
  },
  {
    number: '11',
    title: 'Changes to Terms',
    content: `We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the "Last Updated" date and, where appropriate, by sending you an email or displaying a notice through our Services.\n\nYour continued use after changes constitutes acceptance of the revised Terms. If you do not agree, you must stop using the Services.`,
  },
  {
    number: '12',
    title: 'Contact Information',
    content: `If you have questions about these Terms of Service, please contact us:\n\nAmarktai Network\nEmail: legal@amarktai.com\n\nWe will respond to all legitimate legal inquiries in a timely manner.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-violet-600/8 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-blue-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-400 transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
              <Scale className="w-8 h-8 text-violet-400" />
            </div>
            <h1 className="font-heading text-5xl md:text-6xl font-black mb-4 tracking-tight">
              Terms of <span className="gradient-text">Service</span>
            </h1>
            <p className="text-blue-100/50 text-lg leading-relaxed mb-3 max-w-xl mx-auto">
              The rules and agreements governing your use of the Amarktai Network.
            </p>
            <p className="text-sm text-slate-600 font-mono">Last updated: {lastUpdated}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="relative px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          {/* Intro card */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 mb-10">
            <p className="text-blue-100/65 leading-relaxed text-[15px]">
              These Terms of Service govern your access to and use of the Amarktai Network platform, including all
              associated applications, features, and services. By using our Services, you confirm that you are at
              least 16 years of age and have the legal authority to enter into these Terms on your own behalf or on
              behalf of an organization.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {sections.map((section) => (
              <div
                key={section.number}
                className="group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 hover:border-violet-500/20 transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <span className="shrink-0 text-2xl font-black font-heading bg-gradient-to-br from-violet-400 to-blue-400 bg-clip-text text-transparent opacity-40 group-hover:opacity-70 transition-opacity">
                    {section.number}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-bold text-white mb-3 tracking-tight">
                      {section.title}
                    </h2>
                    <div className="text-blue-100/55 text-sm leading-relaxed whitespace-pre-line">
                      {section.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom navigation */}
          <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
            <Link href="/privacy" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5">
              View Privacy Policy
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
