import Link from 'next/link'
import { Shield, ArrowLeft, ChevronRight } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2026'

const sections = [
  {
    number: '01',
    title: 'Information We Collect',
    content: `We collect information you provide directly to us, such as when you create an account, fill out a contact form, or sign up for our waitlist. This may include your name, email address, and any other information you choose to provide.\n\nWe also automatically collect certain technical information when you use our services, including your IP address, browser type, operating system, referring URLs, device information, and pages visited.`,
  },
  {
    number: '02',
    title: 'How We Use Your Information',
    content: `We use the information we collect to:\n\n• Provide, maintain, and improve our services\n• Send you updates, security alerts, and support messages\n• Respond to your comments, questions, and requests\n• Monitor and analyze usage patterns and trends\n• Protect the security and integrity of our platform\n• Comply with legal obligations\n\nWe do not sell, trade, or rent your personal information to third parties for marketing purposes.`,
  },
  {
    number: '03',
    title: 'Information Sharing',
    content: `We may share your information in the following limited circumstances:\n\nWith service providers who assist us in operating our platform, subject to confidentiality agreements. When required by law, regulation, or legal process. In connection with any merger, acquisition, or sale of assets, provided that the acquiring entity agrees to honor this Privacy Policy.\n\nWe will not share your personal information with third parties for their own marketing purposes without your explicit consent.`,
  },
  {
    number: '04',
    title: 'Data Security',
    content: `We implement industry-standard security measures to protect your personal information, including encryption in transit and at rest, access controls, and regular security assessments.\n\nHowever, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security. In the event of a data breach, we will notify you as required by applicable law.`,
  },
  {
    number: '05',
    title: 'Cookies & Tracking Technologies',
    content: `We use cookies and similar tracking technologies to enhance your experience:\n\n• Essential cookies required for the platform to function\n• Analytics cookies that help us understand user interactions\n• Preference cookies that remember your settings and choices\n\nYou can control cookies through your browser settings. Disabling certain cookies may affect the functionality of our services.`,
  },
  {
    number: '06',
    title: 'Data Retention',
    content: `We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy, unless a longer retention period is required by law.\n\nWhen you close your account or request deletion, we will delete or anonymize your personal information within a reasonable period, except where retention is required for legal, regulatory, or legitimate business purposes.`,
  },
  {
    number: '07',
    title: 'Your Rights',
    content: `Depending on your location, you may have certain rights regarding your personal information:\n\n• Access the personal information we hold about you\n• Correct inaccurate or incomplete information\n• Request deletion of your personal information\n• Restrict or object to certain processing activities\n• Data portability\n\nTo exercise any of these rights, please contact us at the address provided below.`,
  },
  {
    number: '08',
    title: 'Third-Party Links',
    content: `Our platform may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. Applications within the Amarktai Network that have their own independent domains are subject to their own privacy policies for data processed on those platforms.`,
  },
  {
    number: '09',
    title: "Children's Privacy",
    content: `Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected such information, we will take steps to delete it promptly.\n\nIf you believe we have inadvertently collected information from a child under 16, please contact us immediately.`,
  },
  {
    number: '10',
    title: 'Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last Updated" date and, where appropriate, notify you by email or through a prominent notice on our platform.\n\nYour continued use of our services after any changes constitutes acceptance of the updated policy.`,
  },
  {
    number: '11',
    title: 'Contact Us',
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\nAmarktai Network\nEmail: privacy@amarktai.com\n\nWe take your privacy seriously and will respond to all legitimate inquiries promptly.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-violet-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-400 transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="font-heading text-5xl md:text-6xl font-black mb-4 tracking-tight">
              Privacy <span className="gradient-text-blue-cyan">Policy</span>
            </h1>
            <p className="text-blue-100/50 text-lg leading-relaxed mb-3 max-w-xl mx-auto">
              How we collect, use, and protect your information across the Amarktai Network.
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
              Amarktai Network (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting
              your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our platform and services. Please read this policy carefully. If you disagree with its terms,
              please discontinue use of our services.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {sections.map((section) => (
              <div
                key={section.number}
                className="group rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8 hover:border-blue-500/20 transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <span className="shrink-0 text-2xl font-black font-heading bg-gradient-to-br from-blue-400 to-violet-400 bg-clip-text text-transparent opacity-40 group-hover:opacity-70 transition-opacity">
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
            <Link href="/terms" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5">
              View Terms of Service
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
