import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2025'

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Amarktai Network platform and any of its associated applications and services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use our Services.

These Terms constitute a legally binding agreement between you and Amarktai Network ("Company," "we," "our," or "us"). We reserve the right to update these Terms at any time, and your continued use of the Services after any changes constitutes acceptance of the new Terms.`,
  },
  {
    title: '2. Description of Services',
    content: `Amarktai Network provides an interconnected suite of AI-powered applications and platforms, including but not limited to financial intelligence tools, community platforms, educational services, employment matching, and security products.

Individual applications within the Amarktai Network may be subject to additional terms specific to those services. In cases of conflict, the specific application terms will take precedence for matters within that application's scope.

We reserve the right to modify, suspend, or discontinue any part of our Services at any time with or without notice.`,
  },
  {
    title: '3. User Accounts and Registration',
    content: `To access certain features of our Services, you may be required to create an account. You agree to:

• Provide accurate, current, and complete information during registration
• Maintain and promptly update your account information
• Keep your password secure and confidential
• Accept responsibility for all activities that occur under your account
• Notify us immediately of any unauthorized use of your account

We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably believe are being used fraudulently or in a manner that could harm other users or our Services.`,
  },
  {
    title: '4. Acceptable Use',
    content: `You agree to use our Services only for lawful purposes and in accordance with these Terms. You must not:

• Use our Services in any way that violates applicable local, national, or international laws or regulations
• Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Services
• Transmit any unsolicited or unauthorized advertising or promotional material
• Attempt to gain unauthorized access to any part of our Services or related systems
• Interfere with or disrupt the integrity or performance of the Services
• Use automated tools to scrape, crawl, or otherwise extract data without express written consent
• Impersonate any person or entity or misrepresent your affiliation with any person or entity
• Upload or transmit viruses, malware, or other malicious code`,
  },
  {
    title: '5. Intellectual Property Rights',
    content: `The Services and their original content, features, and functionality are and will remain the exclusive property of Amarktai Network and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.

You retain ownership of any content you submit to our Services. By submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with operating and improving the Services.

You represent and warrant that you have all rights necessary to grant us this license and that your content does not infringe the intellectual property rights of any third party.`,
  },
  {
    title: '6. Financial Services Disclaimer',
    content: `Certain Amarktai Network applications provide financial market data, analysis, and intelligence tools. This information is provided for informational and educational purposes only and does not constitute financial advice, investment advice, trading advice, or any other type of advice.

Amarktai Network is not a registered investment advisor, broker-dealer, or financial institution. Any investment decisions you make based on information provided through our Services are made solely at your own risk. Past performance of any financial instrument or strategy is not indicative of future results.

You should consult with a qualified financial advisor before making any investment decisions.`,
  },
  {
    title: '7. Limitation of Liability',
    content: `To the maximum extent permitted by applicable law, Amarktai Network and its officers, directors, employees, agents, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, goodwill, or other intangible losses, resulting from:

• Your access to or use of, or inability to access or use, the Services
• Any conduct or content of any third party on the Services
• Any content obtained from the Services
• Unauthorized access, use, or alteration of your transmissions or content

Our aggregate liability for all claims relating to the Services shall not exceed the greater of one hundred US dollars ($100) or the amount you paid us in the twelve months prior to the claim.`,
  },
  {
    title: '8. Disclaimer of Warranties',
    content: `The Services are provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.

We do not warrant that the Services will be uninterrupted, error-free, or completely secure. We do not warrant the accuracy, completeness, or reliability of any content available through the Services.

Some jurisdictions do not allow the exclusion of implied warranties, so the above exclusion may not apply to you.`,
  },
  {
    title: '9. Termination',
    content: `We may terminate or suspend your access to our Services immediately, without prior notice or liability, for any reason, including if you breach these Terms.

Upon termination, your right to use the Services will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.

You may terminate your account at any time by contacting us or through the account settings in the applicable application.`,
  },
  {
    title: '10. Governing Law and Dispute Resolution',
    content: `These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms or the Services shall first be subject to good-faith negotiation between the parties.

If a dispute cannot be resolved through negotiation, it shall be submitted to binding arbitration in accordance with established arbitration rules. Each party shall bear their own costs unless the arbitrator determines otherwise.

Nothing in this section shall prevent either party from seeking injunctive or other equitable relief in cases of intellectual property infringement or breach of confidentiality obligations.`,
  },
  {
    title: '11. Changes to Terms',
    content: `We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the "Last Updated" date at the top of this page and, where appropriate, by sending you an email or displaying a notice through our Services.

Your continued use of the Services after the effective date of any changes constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Services.

We encourage you to review these Terms periodically to stay informed of your rights and obligations.`,
  },
  {
    title: '12. Contact Information',
    content: `If you have questions about these Terms of Service, please contact us:

Amarktai Network
Email: legal@amarktai.com

We will respond to all legitimate legal inquiries in a timely manner.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-violet-600/8 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-blue-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6 border border-violet-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span className="text-[11px] font-bold text-violet-400 uppercase tracking-[0.18em]">Legal</span>
          </div>
          <h1 className="font-heading text-5xl md:text-6xl font-black mb-5 tracking-tight">
            Terms of <span className="gradient-text">Service</span>
          </h1>
          <p className="text-blue-100/50 text-lg leading-relaxed mb-4">
            The rules and agreements governing your use of the Amarktai Network.
          </p>
          <p className="text-sm text-slate-600 font-mono">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="relative px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          {/* Intro */}
          <div className="glass-card rounded-2xl border border-white/[0.07] p-8 mb-8">
            <p className="text-blue-100/65 leading-relaxed text-[15px]">
              These Terms of Service govern your access to and use of the Amarktai Network platform, including all
              associated applications, features, and services. By using our Services, you confirm that you are at
              least 16 years of age and have the legal authority to enter into these Terms on your own behalf or on
              behalf of an organization.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.title}
                className="glass-card rounded-2xl border border-white/[0.07] p-8 hover:border-violet-500/15 transition-colors duration-300"
              >
                <h2 className="font-heading text-lg font-bold text-white mb-4">
                  {section.title}
                </h2>
                <div className="text-blue-100/55 text-sm leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors">
              ← Back to Home
            </Link>
            <Link href="/privacy" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View Privacy Policy →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
