import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2026'

const sections: { title: string; content: string }[] = [
  {
    title: 'Information We Collect',
    content: 'We collect information you provide directly to us, such as when you create an account, fill out a contact form, or sign up for our waitlist. This may include your name, email address, and any other information you choose to provide.\n\nWe also automatically collect certain technical information when you use our services, including your IP address, browser type, operating system, referring URLs, device information, and pages visited.',
  },
  {
    title: 'How We Use Your Information',
    content: 'We use the information we collect to:\n\n• Provide, maintain, and improve our services\n• Send you updates, security alerts, and support messages\n• Respond to your comments, questions, and requests\n• Monitor and analyze usage patterns and trends\n• Protect the security and integrity of our platform\n• Comply with legal obligations\n\nWe do not sell, trade, or rent your personal information to third parties for marketing purposes.',
  },
  {
    title: 'Information Sharing',
    content: 'We may share your information in the following limited circumstances:\n\nWith service providers who assist us in operating our platform, subject to confidentiality agreements. When required by law, regulation, or legal process. In connection with any merger, acquisition, or sale of assets, provided that the acquiring entity agrees to honor this Privacy Policy.\n\nWe will not share your personal information with third parties for their own marketing purposes without your explicit consent.',
  },
  {
    title: 'Data Security',
    content: 'We implement industry-standard security measures to protect your personal information, including encryption in transit and at rest, access controls, and regular security assessments.\n\nHowever, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security. In the event of a data breach, we will notify you as required by applicable law.',
  },
  {
    title: 'Cookies & Tracking Technologies',
    content: 'We use cookies and similar tracking technologies to enhance your experience:\n\n• Essential cookies required for the platform to function\n• Analytics cookies that help us understand user interactions\n• Preference cookies that remember your settings and choices\n\nYou can control cookies through your browser settings. Disabling certain cookies may affect the functionality of our services.',
  },
  {
    title: 'Data Retention',
    content: 'We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy, unless a longer retention period is required by law.\n\nWhen you close your account or request deletion, we will delete or anonymize your personal information within a reasonable period, except where retention is required for legal, regulatory, or legitimate business purposes.',
  },
  {
    title: 'Your Rights',
    content: 'Depending on your location, you may have certain rights regarding your personal information:\n\n• Access the personal information we hold about you\n• Correct inaccurate or incomplete information\n• Request deletion of your personal information\n• Restrict or object to certain processing activities\n• Data portability\n\nTo exercise any of these rights, please contact us at the address provided below.',
  },
  {
    title: 'Third-Party Links',
    content: 'Our platform may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. Applications within the Amarktai Network that have their own independent domains are subject to their own privacy policies for data processed on those platforms.',
  },
  {
    title: "Children's Privacy",
    content: 'Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected such information, we will take steps to delete it promptly.\n\nIf you believe we have inadvertently collected information from a child under 16, please contact us immediately.',
  },
  {
    title: 'Changes to This Policy',
    content: 'We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last Updated" date and, where appropriate, notify you by email or through a prominent notice on our platform.\n\nYour continued use of our services after any changes constitutes acceptance of the updated policy.',
  },
  {
    title: 'Contact Us',
    content: 'If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\nAmarktai Network\nEmail: privacy@amarktai.com\n\nWe take your privacy seriously and will respond to all legitimate inquiries promptly.',
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="ambient-drift absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-600/5 blur-[140px]" />
      </div>

      <div className="relative z-10">
      <section className="pt-32 pb-10 px-6 text-center">
        <h1 className="font-heading text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          How we collect, use, and protect your information across the Amarktai Network.
        </p>
        <p className="text-sm text-slate-600 mt-3">Last updated: {lastUpdated}</p>
      </section>

      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="border border-white/[0.06] rounded-xl p-8 mb-10 bg-white/[0.02]">
            <p className="text-slate-400 leading-relaxed text-[15px]">
              Amarktai Network (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting
              your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our platform and services. Please read this policy carefully. If you disagree with its terms,
              please discontinue use of our services.
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
            <Link href="/terms" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View Terms of Service &rarr;
            </Link>
          </div>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  )
}
