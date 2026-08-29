import { useEffect, useState } from 'react'
import { CreditCard, Phone, ShareNetwork, ShoppingCartSimple } from '@phosphor-icons/react'
import './public-pages.css'

const privacySections = [
  ['scope','1. Scope',<><p>This Privacy Policy applies to the Tappy website, online ordering, payment verification, customer support, first-party analytics, and managed profile pages. Tappy acts as the personal information controller for information collected through these services.</p><p>By giving us information about another person, you confirm that you have authority to do so and that they have been informed about the relevant processing.</p></>],
  ['collect','2. Information we collect',<><h3>Orders and delivery</h3><p>We collect your name, email address, mobile number, delivery address, city, postal code, quantity, and order details.</p><h3>GCash payment verification</h3><p>We collect the transaction reference, sender name, sender mobile number, and payment receipt image. We do not collect your GCash password, PIN, wallet credentials, or full account access.</p><h3>Managed Tappy pages</h3><p>We may process your display name, headline, introduction, photo, email, phone number, location, public links, and selected design.</p><h3>Site activity and messages</h3><p>Our first-party analytics record events such as visits, order clicks, checkout starts, completed orders, and managed-profile visits. Records can include random session and page identifiers, path, and event time. We also keep information you provide when contacting us.</p></>],
  ['use','3. How we use information',<><p>We use personal information to process and deliver orders, verify GCash payments, create and update managed pages, send transactional emails, respond to questions, protect the service, measure performance, resolve disputes, and meet legal obligations.</p><p>Depending on the activity, processing is based on consent, performance of a contract, legal obligations, or our legitimate interest in operating Tappy without overriding your rights.</p></>],
  ['share','4. Who receives information',<><p>We do not sell personal information. We disclose only what is necessary to Supabase for database and private file storage, Vercel for hosting, Resend for transactional email, Sentry for privacy-limited error monitoring, delivery providers for fulfillment, and advisers or authorities when legally required.</p><p>Some providers may process information outside the Philippines. We take reasonable steps to require appropriate protection from processors.</p></>],
  ['public','5. Managed pages are public',<><p>A managed profile is publicly accessible to anyone who has its link. Its non-meaningful identifier reduces casual guessing but does not make the page secret.</p><p>Only submit details the owner is comfortable publishing. Search engines are instructed not to index profiles, but we cannot control copies, screenshots, or saved links.</p></>],
  ['retention','6. How long we keep information',<><p>We keep information only while needed for its stated purpose, legitimate business records, accounting and tax requirements, fraud prevention, consumer support, or legal claims. Payment proof is removed or de-identified when no longer reasonably necessary.</p><p>A managed page remains available until it is unpublished, the service relationship ends, or removal is requested, subject to lawful retention requirements.</p></>],
  ['security','7. Security',<p>We use reasonable organizational and technical safeguards, including restricted administrative access, private storage for payment receipts, hashed and expiring page-editing credentials, and error monitoring configured to avoid order bodies and customer credentials. No online service can guarantee absolute security. Keep private editing links confidential and contact us if one may be compromised.</p>],
  ['rights','8. Your privacy rights',<><p>Under the Philippine Data Privacy Act, you may have rights to information, access, correction, objection, withdrawal of consent, blocking or deletion, portability where applicable, complaint, and damages for unlawful processing.</p><p>We may request reasonable proof of identity. A request may be limited where processing or retention is required by law or needed for legal claims.</p></>],
  ['children','9. Children',<p>Tappy is not intended for children under 18 to place orders or publish managed profiles without a parent or legal guardian. Contact us if a child submitted information without appropriate authorization.</p>],
  ['changes','10. Policy changes',<p>We may update this policy when our services or legal obligations change. The effective date shows the latest revision, and material changes will be communicated when appropriate.</p>],
  ['contact','11. Contact Tappy',<div className="legal-callout"><p>For privacy requests, questions, or complaints:</p><a href="mailto:hello@tappycard.tech?subject=Privacy%20request">hello@tappycard.tech</a><p>You may also contact the National Privacy Commission.</p></div>],
]

const termsSections = [
  ['acceptance','1. Accepting these terms',<p>These terms form an agreement between you and Tappy when you place an order, request or use a managed page, or otherwise use the service. You must be at least 18, or have a parent or legal guardian involved, to place an order.</p>],
  ['service','2. What Tappy provides',<><p>Tappy provides physical NFC cards and related digital destination services. A compatible phone can open a managed profile, review page, map, menu, booking page, social profile, portfolio, or website.</p><p>No visitor app is generally required. A compatible NFC-enabled device, enabled NFC setting, internet connection, and browser are still required. Device settings, cases, hardware, networks, and third-party sites can affect performance.</p></>],
  ['orders','3. Orders, prices, and GCash payment',<><p>Prices and delivery charges shown at checkout apply when the order is submitted. Review all order and delivery details carefully.</p><p>GCash payments are manually verified. An order confirmation only means we received the order. We may request clearer proof, reject altered or duplicate proof, or cancel an unpaid order. Never send a PIN, password, one-time code, or wallet credentials.</p></>],
  ['delivery','4. Preparation and delivery',<><p>Fulfillment begins after payment approval. Tappy may use J&amp;T Express or another suitable delivery provider. The delivery fee shown at checkout is Tappy's quoted fee for the delivery information submitted with the order. When J&amp;T is used, we may reference its <a href="https://www.jtexpress.ph/shipping-rates" target="_blank" rel="noreferrer">official shipping-rate calculator</a>, which considers details such as origin, destination, parcel weight and dimensions, service type, and optional additional fees.</p><p>Courier rates may change. We will not increase a paid order's delivery fee without informing you first. An additional charge may apply if you request a delivery-address change, submit incomplete or inaccurate delivery information, or cause a failed delivery or redelivery. We will confirm any additional amount before dispatch, and applicable cancellation or refund rights remain available.</p><p>Delivery timing may vary by location, availability, courier operations, weather, and events beyond reasonable control. Dates are estimates unless expressly agreed otherwise. You are responsible for providing a complete and reachable delivery address and contact number.</p></>],
  ['returns','5. Cancellations, defects, and refunds',<><p>Contact us promptly to cancel. Cancellation may be accepted before payment approval or preparation. Once a card is prepared, encoded, customized, or dispatched, cancellation may no longer be possible unless the product is defective, damaged, materially different from the order, or law provides otherwise.</p><p>Nothing in these terms limits mandatory rights under Philippine consumer law.</p></>],
  ['profiles','6. Managed profiles and customer content',<><p>Tappy may create and administer a public managed profile from information you provide. A paid customer may receive a private, expiring self-service link for approved public fields. The link is a credential: you are responsible for keeping it private and notifying Tappy if it may be compromised.</p><p>You retain rights in your materials and give Tappy limited permission to host, format, and display them. You confirm submitted content is accurate, lawful, and yours to use. Tappy may revoke editing access or remove unlawful, deceptive, infringing, harmful, or unsafe content.</p></>],
  ['use','7. Acceptable use',<><p>Do not use Tappy to impersonate others, publish unlawful or infringing content, distribute malware or phishing pages, disrupt systems, submit false payment proof, or violate privacy and intellectual-property rights.</p><p>We may suspend content when reasonably necessary to protect users, investigate abuse, or comply with law.</p></>],
  ['third-party','8. Third-party services',<p>Tappy can link to GCash, social networks, maps, booking services, couriers, and other services governed by their own terms and privacy policies. We do not control their availability, content, or security.</p>],
  ['ownership','9. Tappy intellectual property',<p>The Tappy name, branding, website design, software, and original content belong to Tappy or its licensors. Purchasing a card does not transfer these intellectual-property rights.</p>],
  ['availability','10. Availability and changes',<p>Maintenance, security incidents, provider outages, internet failures, and other events may interrupt access. We may improve, replace, or discontinue features and will provide reasonable notice of material changes when practicable.</p>],
  ['liability','11. Responsibility and limits',<><p>To the extent permitted by law, Tappy is not responsible for indirect loss caused by third-party platforms, incompatible devices, network outages, customer-supplied content, or use contrary to instructions.</p><p>Nothing excludes liability that cannot lawfully be excluded or limits statutory consumer rights.</p></>],
  ['law','12. Philippine law and disputes',<p>These terms are governed by Philippine law. Contact us first so we can try to resolve a concern fairly. You may still use any complaint, mediation, regulatory, or court process available by law.</p>],
  ['changes','13. Changes to these terms',<p>We may revise these terms as the service changes. Terms in effect when an order is placed govern that order unless law requires otherwise or we agree with you.</p>],
  ['contact','14. Contact Tappy',<div className="legal-callout"><p>Questions about an order or these terms:</p><a href="mailto:hello@tappycard.tech?subject=Terms%20or%20order%20question">hello@tappycard.tech</a></div>],
]

function LegalPage({ type, Header, Footer }) {
  const sections = type === 'privacy' ? privacySections : termsSections
  const [active, setActive] = useState(sections[0][0])
  useEffect(() => {
    const update = () => {
      const marker = window.scrollY + Math.min(220, window.innerHeight * .3)
      let current = sections[0][0]
      sections.forEach(([id]) => { if (document.getElementById(id)?.offsetTop <= marker) current = id })
      setActive(current)
    }
    update(); window.addEventListener('scroll', update, { passive:true }); window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [sections])
  useEffect(() => {
    const nav = document.querySelector('.legal-contents')
    const current = nav?.querySelector('a.active')
    if (!nav || !current || nav.scrollHeight <= nav.clientHeight) return
    const top = current.offsetTop
    const bottom = top + current.offsetHeight
    const visibleTop = nav.scrollTop
    const visibleBottom = visibleTop + nav.clientHeight
    if (top < visibleTop + 24 || bottom > visibleBottom - 24) {
      nav.scrollTo({ top:Math.max(0, top - nav.clientHeight * .35), behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [active])
  useEffect(() => {
    const rail = document.querySelector('.legal-contents-rail')
    const nav = rail?.querySelector('.legal-contents')
    if (!rail || !nav) return undefined
    const pin = () => {
      if (window.innerWidth <= 800) {
        nav.classList.remove('is-fixed','is-ended')
        nav.style.removeProperty('left')
        nav.style.removeProperty('width')
        return
      }
      const railBox = rail.getBoundingClientRect()
      const top = 104
      const ending = railBox.bottom <= top + nav.offsetHeight
      const fixed = railBox.top <= top && !ending
      nav.classList.toggle('is-fixed', fixed)
      nav.classList.toggle('is-ended', ending)
      if (fixed) {
        nav.style.left = `${railBox.left}px`
        nav.style.width = `${railBox.width}px`
      } else {
        nav.style.removeProperty('left')
        nav.style.removeProperty('width')
      }
    }
    pin(); window.addEventListener('scroll', pin, { passive:true }); window.addEventListener('resize', pin)
    return () => { window.removeEventListener('scroll', pin); window.removeEventListener('resize', pin) }
  }, [])
  const privacy = type === 'privacy'
  return <main className="page public-page legal-page" id="top"><a className="skip-link" href="#content">Skip to content</a><Header/><header className="public-masthead shell"><h1>{privacy ? 'Privacy, plainly stated.' : 'Terms, without the fine-print fog.'}</h1><p>{privacy ? 'What Tappy handles, why we need it, and the choices available to you.' : 'How Tappy orders, payments, delivery, NFC cards, and managed pages work.'}</p><span className="legal-effective-date"><small>Effective date</small><strong>August 29, 2026</strong></span></header><div className="legal-layout shell" id="content"><aside className="legal-contents-rail"><nav className="legal-contents" aria-label={`${privacy ? 'Privacy policy' : 'Terms'} sections`}><strong>Contents</strong>{sections.map(([id,title]) => <a className={active === id ? 'active' : ''} aria-current={active === id ? 'location' : undefined} href={`#${id}`} key={id}>{title.replace(/^\d+\. /,'')}</a>)}</nav></aside><article className="legal-copy">{sections.map(([id,title,body]) => <section id={id} key={id}><h2>{title}</h2>{body}</section>)}</article></div><div className="footer-reveal"><div className="footer-stack"><Footer/></div></div></main>
}

function HowPage({ Header, Footer }) {
  const facts = [['Phone','NFC enabled'],['Connection','Mobile data or Wi-Fi'],['Visitor app','Not required']]
  const questions = [['Does the person tapping need an app?','No. The selected page opens in the phone browser.'],['Will it work with every phone?','Tappy works with NFC-enabled smartphones when NFC is available and enabled.'],['Can the destination change later?','Yes. The destination can be updated while the physical card stays the same.'],['What can the card open?','A managed profile, social page, review link, map, menu, booking page, portfolio, or website.'],['Does it require internet access?','Yes. The phone needs mobile data or Wi-Fi to load the destination.'],['How much does a Tappy NFC Card cost in the Philippines?','Tappy NFC Cards start at ₱199 as a one-time purchase. Delivery fees vary by location: ₱80 for Luzon, ₱100 for Visayas, and ₱120 for Mindanao.'],['What information can I share on my Tappy page?','You can share your name, photo, role or headline, bio, phone number, email, location, and up to 8 links — including Facebook, Instagram, LinkedIn, Google Reviews, Google Maps, a booking link, portfolio, or website.'],['Does Tappy ship nationwide in the Philippines?','Yes. Tappy ships to all provinces across Luzon, Visayas, and Mindanao.']]
  return <main className="page public-page how-page" id="top"><a className="skip-link" href="#content">Skip to content</a><Header/><header className="public-masthead shell" id="content"><h1>Frequently asked questions.</h1><p>Everything you need to know about Tappy NFC Cards.</p></header><section className="how-explanation shell"><article><CreditCard size={30}/><h2>Tap and open.</h2><p>Hold an NFC-enabled phone near Tappy. The selected page opens in the browser without asking the visitor to install an app.</p><dl>{facts.map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></article><article><Phone size={30}/><h2>Change where it goes.</h2><p>Use Tappy for a contact profile, social page, review link, map, menu, booking page, portfolio, or website. Update the destination without replacing the card.</p><div className="how-purchase"><strong>₱199</strong><a className="button" href="/order"><ShoppingCartSimple size={18}/>Order Tappy</a></div></article></section><section className="public-faq shell"><h2>Common questions.</h2><div>{questions.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section><div className="footer-reveal"><div className="footer-stack"><Footer/></div></div></main>
}

export default function PublicPage({ type, Header, Footer }) {
  return type === 'how' ? <HowPage Header={Header} Footer={Footer}/> : <LegalPage type={type} Header={Header} Footer={Footer}/>
}
