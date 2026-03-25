import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const lastUpdated = 'March 2025'

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly to us, such as when you create an account, fill out a contact form, or sign up for our waitlist. This may include your name, email address, and any other information you choose to provide.

We also automatically collect certain technical information when you use our services, including your IP address, browser type, operating system, referring URLs, device information, and pages visited. This information helps us operate and improve our platform.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:

• Provide, maintain, and improve our services
• Send you updates, security alerts, and support messages
• Respond to your comments, questions, and requests
• Monitor and analyze usage patterns and trends
• Protect the security and integrity of our platform
• Comply with legal obligations

We do not sell, trade, or rent your personal information to third parties for marketing purposes.`,
  },
  {
    title: '3. Information Sharing',
    content: `We may share your information in the following limited circumstances:

With service providers who assist us in operating our platform and conducting our business, subject to confidentiality agreements.

When required by law, regulation, or legal process, or to protect the rights, property, or safety of Amarktai Network, our users, or the public.

In connection with any merger, acquisition, or sale of assets, provided that the acquiring entity agrees to honor this Privacy Policy.

We will not share your personal information with third parties for their own marketing purposes without your explicit consent.`,
  },
  {
    title: '4. Data Security',
    content: `We implement industry-standard security measures to protect your personal information, including encryption in transit and at rest, access controls, and regular security assessments.

However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security. In the event of a data breach that affects your rights or freedoms, we will notify you as required by applicable law.`,
  },
  {
    title: '5. Cookies and Tracking Technologies',
    content: `We use cookies and similar tracking technologies to enhance your experience on our platform. These may include:

• Essential cookies required for the platform to function
• Analytics cookies that help us understand how users interact with our services
• Preference cookies that remember your settings and choices

You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of our services.`,
  },
  {
    title: '6. Data Retention',
    content: `We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy, unless a longer retention period is required by law.

When you close your account or request deletion of your data, we will delete or anonymize your personal information within a reasonable period, except where we are required to retain it for legal, regulatory, or legitimate business purposes.`,
  },
  {
    title: '7. Your Rights',
    content: `Depending on your location, you may have certain rights regarding your personal information, including:

• The right to access the personal information we hold about you
• The right to correct inaccurate or incomplete information
• The right to request deletion of your personal information
• The right to restrict or object to certain processing activities
• The right to data portability

To exercise any of these rights, please contact us at the address provided below. We will respond to your request within the timeframe required by applicable law.`,
  },
  {
    title: '8. Third-Party Links',
    content: `Our platform may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites you visit.

Applications within the Amarktai Network that have their own independent domains (such as EquiProfile at equiprofile.online) are subject to their own privacy policies for data processed on those platforms.`,
  },
  {
    title: '9. Children\'s Privacy',
    content: `Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected personal information from a child under 16, we will take steps to delete that information promptly.

If you believe we have inadvertently collected information from a child under 16, please contact us immediately.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. When we make material changes, we will update the "Last Updated" date at the top of this policy and, where appropriate, notify you by email or through a prominent notice on our platform.

Your continued use of our services after any changes constitutes your acceptance of the updated policy. We encourage you to review this policy periodically.`,
  },
  {
    title: '11. Contact Us',
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

Amarktai Network
Email: privacy@amarktai.com

We take your privacy seriously and will respond to all legitimate inquiries promptly.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-violet-600/6 rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.18em]">Legal</span>
          </div>
          <h1 className="font-heading text-5xl md:text-6xl font-black mb-5 tracking-tight">
            Privacy <span className="gradient-text-blue-cyan">Policy</span>
          </h1>
          <p className="text-blue-100/50 text-lg leading-relaxed mb-4">
            How we collect, use, and protect your information.
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
              Amarktai Network (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
              platform and services. Please read this policy carefully. If you disagree with its terms, please discontinue
              use of our services.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.title}
                className="glass-card rounded-2xl border border-white/[0.07] p-8 hover:border-blue-500/15 transition-colors duration-300"
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
            <Link href="/terms" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View Terms of Service →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
