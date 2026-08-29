import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import PublicPage from './PublicPages'
import { track } from './analytics'
import { DELIVERY_PROVINCES, getDeliveryFee, getDeliveryRegion } from '../shared/delivery.js'
import {
  ArrowLeft, ArrowUp, ArrowUpRight, CheckCircle, Compass, CreditCard, FacebookLogo, FileText, Globe,
  InstagramLogo, List, MapPin, Phone,
  Minus, Plus, ShareNetwork, ShoppingCartSimple, Star, X,
} from '@phosphor-icons/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const AdminDashboard = React.lazy(() => import('./AdminDashboard'))
const TappyPage = React.lazy(() => import('./TappyPage'))
const CustomerPageEditor = React.lazy(() => import('./CustomerPageEditor'))

function RouteLoading() {
  return <main className="managed-page-state" aria-live="polite"><span className="managed-page-logo">tappy.</span><p>Opening…</p></main>
}

const destinations = [
  { name: 'Contact Profile', type: 'contact', icon: Phone, color: '#24503e', title: 'Juan Dela Cruz', meta: 'Business Owner', action: 'Save contact' },
  { name: 'Google Maps', type: 'maps', icon: MapPin, color: '#4285f4', title: 'Kape Muñoz', meta: 'Quezon City · Open today', action: 'Get directions' },
  { name: 'Instagram', type: 'instagram', icon: InstagramLogo, color: '#c13584', title: 'Juan Dela Cruz', meta: '@juandelacruz', action: 'View Instagram' },
  { name: 'Portfolio', type: 'portfolio', icon: Compass, color: '#d97706', title: 'Juan Dela Cruz', meta: 'Selected work and contact', action: 'View portfolio' },
  { name: 'Google Reviews', type: 'reviews', icon: Star, color: '#e3a008', title: 'Kape Muñoz', meta: '4.8 average rating', action: 'Leave a review' },
  { name: 'Website', type: 'website', icon: Globe, color: '#2563eb', title: 'Tappy', meta: 'One tap. Every connection.', action: 'Open website' },
]

function Logo() { return <a className="logo" href="/#top" aria-label="Tappy home" translate="no">tappy.</a> }

function NotFound() {
  return (
    <main className="not-found-screen">
      <div className="not-found-card">
        <h1 className="not-found-huge">404</h1>
        <h2 className="not-found-subtitle">Page not found.</h2>
        <p className="not-found-description">
          The link you followed may be broken,<br />
          or the page may have been removed.
        </p>
        <a className="not-found-cta" href="/">Go Home</a>
        <div className="not-found-image-wrapper">
          <img src="/assets/404.png" alt="Page not found" className="not-found-image" />
        </div>
      </div>
    </main>
  )
}
function Header({ staticNav = false, checkout = false }) {
  const [open, setOpen] = useState(false)
  return <header className={`header ${staticNav ? 'header-static' : ''} ${checkout ? 'checkout-header' : ''}`}>
    <nav className="nav shell" aria-label="Main navigation">
      <Logo />
      {checkout && <span className="checkout-label">Secure checkout</span>}
      <div className={`nav-links ${open ? 'open' : ''}`} id="main-menu">
        <a href="/#products" onClick={() => setOpen(false)}>Products</a>
        <a href="/faqs" onClick={() => setOpen(false)}>FAQs</a>
        <a href="/#business" onClick={() => setOpen(false)}>Use cases</a>
        <a href="/#pricing" onClick={() => setOpen(false)}>Pricing</a>
      </div>
      <div className="nav-actions">
        <a className="button button-small" href="/order"><ShoppingCartSimple size={17} aria-hidden="true" />Order Tappy</a>
        <button type="button" className="icon-button menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} aria-controls="main-menu">{open ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}</button>
      </div>
    </nav>
  </header>
}
function BackToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 640)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])
  return <a className={`back-to-top ${visible ? 'visible' : ''}`} href="#top" aria-label="Back to top"><ArrowUp size={19} weight="bold" aria-hidden="true" /></a>
}

function Hero() {
  return <div id="top">
    <section className="hero">
      <div className="hero-ambient" aria-hidden="true">
        <div className="ambient-glow"></div>
      </div>
      <div className="hero-inner shell fade" data-fade>
        <div className="hero-copy">
          <h1>One tap. <span className="highlight-text">Every connection.</span></h1>
          <div className="button-row">
            <a className="button" href="/order"><ShoppingCartSimple size={18} aria-hidden="true" />Order Tappy</a>
            <a className="text-link hero-text-link" href="/how-it-works"><FileText size={17} aria-hidden="true" />See How It Works</a>
          </div>
        </div>
        <div className="hero-mockup" aria-label="Tappy NFC card next to a smartphone showing a digital profile">
          <div className="hero-image-stage">
            <video src="/assets/video.mp4" poster="/assets/tappy-hero.jpg" autoPlay muted loop playsInline preload="auto" aria-label="A white Tappy NFC card beside a smartphone" />
          </div>
        </div>
      </div>
    </section>
  </div>
}

function HowItWorks() {
  const steps = [
    ['Tap', 'Hold an NFC-enabled phone near your Tappy.', CreditCard],
    ['Connect', 'Your selected profile or destination opens instantly.', Phone],
    ['Share', 'Visitors can follow, call, review, save or navigate.', ShareNetwork],
  ]
  return <section className="section shell fade" data-fade id="how">
    <div className="section-heading process-heading"><h2>Tap. Connect. Done.</h2><p>One simple gesture turns a physical moment into a useful digital action.</p></div>
    <div className="steps">
      {steps.map(([title, copy, Icon]) => <article className="step" key={title}>
        <div className="step-icon" aria-hidden="true"><Icon size={28} /></div><h3>{title}</h3><p>{copy}</p>
      </article>)}
    </div>
  </section>
}

function MobileDestinationPreview({ destination }) {
  const PreviewIcon = destination.icon
  const usesPortrait = destination.type === 'contact' || destination.type === 'instagram' || destination.type === 'portfolio'
  return <div className={`phone-destination phone-${destination.type}`}>
    <div className="phone-speaker" aria-hidden="true"></div>
    <div className="phone-screen">
      <b className="phone-brand" translate="no">tappy.</b>
      <div className="phone-preview-visual">
        {usesPortrait ? <img src="/assets/juan-dela-cruz.png" alt="Juan Dela Cruz" width="1254" height="1254" /> : <PreviewIcon size={destination.type === 'website' ? 38 : 34} weight="regular" aria-hidden="true" />}
      </div>
      {destination.type === 'reviews' && <div className="phone-rating" aria-label="Rated 4.8 out of 5"><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><span>4.8</span></div>}
      <strong>{destination.title}</strong>
      <p>{destination.meta}</p>
      <button type="button">{destination.action}<ArrowUpRight size={16} aria-hidden="true" /></button>
    </div>
  </div>
}

function DestinationSwitcher() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef([])
  const selectTab = (index) => {
    const next = (index + destinations.length) % destinations.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }
  const handleTabKeyDown = (event, index) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); selectTab(index + 1) }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); selectTab(index - 1) }
    if (event.key === 'Home') { event.preventDefault(); selectTab(0) }
    if (event.key === 'End') { event.preventDefault(); selectTab(destinations.length - 1) }
  }
  return <section className="section destination fade" data-fade id="products">
    <div className="shell destination-grid">
      <div className="destination-copy">
        <h2>One card.<br />Any destination.</h2>
        <p>Change where your Tappy opens anytime. The physical card stays the same.</p>
        <div className="destination-list" role="tablist" aria-label="Choose destination">
          {destinations.map((item, i) => <button type="button" style={{ '--destination-color': item.color }} key={item.name} id={`destination-tab-${i}`} ref={(node) => { tabRefs.current[i] = node }} role="tab" aria-selected={active === i} aria-controls="destination-panel" tabIndex={active === i ? 0 : -1} onKeyDown={(event) => handleTabKeyDown(event, i)} onClick={() => setActive(i)} className={active === i ? 'active' : ''}>
            <span className="destination-icon"><item.icon size={20} weight="duotone" aria-hidden="true" /></span><span>{item.name}</span>
          </button>)}
        </div>
      </div>
      <div className="destination-stage">
        <figure className="destination-card">
          <img src="/assets/tappy-hero.jpg" alt="The white Tappy card" width="900" height="506" loading="lazy" />
        </figure>
        <div className="destination-phone-shell">
          <output className="destination-phone-output" id="destination-panel" role="tabpanel" aria-labelledby={`destination-tab-${active}`} key={destinations[active].name}>
            <MobileDestinationPreview destination={destinations[active]} />
          </output>
        </div>
      </div>
    </div>
  </section>
}

const showcaseSlides = [
  { image: '/assets/tappy-hero.jpg', label: 'Professionals', title: 'Make connections count.', result: 'Share contact, socials and work.' },
  { image: '/assets/tappy-cafe.png', label: 'Cafes and shops', title: 'Turn visits into action.', result: 'Open menus, maps and reviews.' },
  { image: '/assets/tappy-clinic.png', label: 'Clinics and studios', title: 'Bookings, one tap away.', result: 'Connect customers to the right page.' },
]

function Products() {
  const [slide, setSlide] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = (event) => setReduceMotion(event.matches)
    setReduceMotion(mediaQuery.matches)
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updateMotionPreference)
    else mediaQuery.addListener(updateMotionPreference)
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updateMotionPreference)
      else mediaQuery.removeListener(updateMotionPreference)
    }
  }, [])

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    if (reduceMotion || !pageVisible) return undefined
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % showcaseSlides.length), 4200)
    return () => window.clearInterval(timer)
  }, [reduceMotion, pageVisible])
  return <section className="use-cases section fade" data-fade id="business">
    <div className="shell use-cases-head">
      <div className="section-heading compact"><h2>One Tappy.<br />Built for real outcomes.</h2></div>
    </div>
    <div className="showcase shell" role="region" aria-roledescription="carousel" aria-label="Tappy use cases">
      <div className="showcase-images">
        {showcaseSlides.map((item, index) => <img className={index === slide ? 'active' : ''} src={item.image} alt={`${item.label}: white Tappy NFC card in use`} width="1536" height="1024" loading={index === 0 ? 'eager' : 'lazy'} aria-hidden={index !== slide} key={item.image} />)}
      </div>
      <div className="showcase-caption">
        <div className="showcase-caption-content" key={showcaseSlides[slide].title}>
          <h3>{showcaseSlides[slide].title}</h3><p>{showcaseSlides[slide].result}</p>
        </div>
        <div className="showcase-dots" aria-hidden="true">{showcaseSlides.map((item, index) => <span className={index === slide ? 'active' : ''} key={item.label} />)}</div>
      </div>
    </div>
  </section>
}

function UseCaseTicker() {
  const items = ['Shops', 'Cafes', 'Clinics', 'Studios', 'Professionals', 'Creators']
  return <div className="ticker" aria-label="Tappy is made for shops, cafes, clinics, studios, professionals and creators">
    <div className="ticker-track" aria-hidden="true">
      {[...items, ...items].map((item, index) => <span key={`${item}-${index}`}>{item}<i>tappy.</i></span>)}
    </div>
  </div>
}

function Pricing() {
  return <section className="section shell fade" data-fade id="pricing">
    <div className="pricing-panel">
      <img className="pricing-image gsap-media" src="/assets/tappy-hero.jpg" alt="The current white Tappy card beside a smartphone" width="900" height="506" loading="lazy" />
      <div><h2>Buy the card once. Keep changing where it goes.</h2></div>
      <div className="price"><span>Starting at</span><data value="199">₱199</data><small>One-time card purchase</small><a className="button" href="/order"><ShoppingCartSimple size={18} aria-hidden="true" />Order Tappy</a></div>
    </div>
  </section>
}

function OrderFlow() {
  const [step, setStep] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [details, setDetails] = useState({ name: '', email: '', phone: '', address: '', city: '', province: '', postal: '', payment: 'gcash' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [orderResult, setOrderResult] = useState(null)
  const [paymentProof, setPaymentProof] = useState({ reference: '', senderName: '', senderPhone: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [proofSubmitting, setProofSubmitting] = useState(false)
  const [proofError, setProofError] = useState('')
  const [proofSubmitted, setProofSubmitted] = useState(false)
  const shipping = getDeliveryFee(details.province) ?? 0
  const deliveryRegion = getDeliveryRegion(details.province)
  const total = quantity * 199 + shipping
  const update = (event) => {
    const { name, value } = event.target
    setDetails(current => ({ ...current, [name]: value }))
    if (fieldErrors[name]) setFieldErrors(current => ({ ...current, [name]: '' }))
  }
  const validateDetails = () => {
    const errors = {}
    const phoneDigits = details.phone.replace(/[^\d+]/g, '')
    if (details.name.trim().length < 2) errors.name = 'Enter the recipient’s full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) errors.email = 'Enter a valid email address.'
    if (!/^(09\d{9}|\+639\d{9})$/.test(phoneDigits)) errors.phone = 'Use 09XXXXXXXXX or +639XXXXXXXXX.'
    if (details.address.trim().length < 5) errors.address = 'Enter the complete delivery address.'
    if (details.city.trim().length < 2) errors.city = 'Enter the city or municipality.'
    if (!deliveryRegion) errors.province = 'Choose the delivery province.'
    if (!/^\d{4}$/.test(details.postal.trim())) errors.postal = 'Enter a 4-digit Philippine postal code.'
    return errors
  }
  const continueToReview = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const errors = validateDetails()
    setFieldErrors(errors)
    const firstInvalid = Object.keys(errors)[0]
    if (firstInvalid) {
      requestAnimationFrame(() => form.elements[firstInvalid]?.focus())
      return
    }
    setStep(2)
  }
  const placeOrder = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...details, quantity }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The order could not be saved.')
      setOrderResult(result)
      setPaymentProof({ reference: '', senderName: details.name, senderPhone: details.phone })
      setStep(3)
    } catch (error) {
      setSubmitError(error.message || 'The order could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  const submitPaymentProof = async (event) => {
    event.preventDefault()
    setProofError('')
    if (!receiptFile) return setProofError('Add a screenshot of your GCash receipt.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(receiptFile.type)) return setProofError('Use a JPG, PNG, or WebP receipt image.')
    if (receiptFile.size > 3_145_728) return setProofError('Receipt image must be smaller than 3 MB.')
    setProofSubmitting(true)
    try {
      const receiptData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Receipt image could not be read.'))
        reader.readAsDataURL(receiptFile)
      })
      const response = await fetch(`/api/orders/${orderResult.orderNumber}/payment-proof`, {
        method: 'POST',
        headers: { authorization: `Bearer ${orderResult.proofToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...paymentProof, receiptData }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Payment proof could not be submitted.')
      setProofSubmitted(true)
    } catch (error) { setProofError(error.message || 'Payment proof could not be submitted.') }
    finally { setProofSubmitting(false) }
  }

  return <section className="order-section" id="order">
    <div className="shell order-shell">
      <div className="order-heading"><h2>Order your Tappy.</h2><p>One white NFC card, ready to connect to the profile or destination you choose.</p></div>
      <div className="order-workspace">
        <div className="order-main">
          {step === 1 && <form className="order-form" onSubmit={continueToReview} noValidate>
            <div className="quantity-line"><div><h3>White Tappy card</h3><p>Matte finish · NFC enabled</p></div><div className="quantity-control" aria-label="Quantity"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity"><Minus size={16} /></button><output aria-live="polite">{quantity}</output><button type="button" onClick={() => setQuantity(Math.min(10, quantity + 1))} aria-label="Increase quantity"><Plus size={16} /></button></div></div>
            <div className="form-fields">
              <label className="wide">Full name<input name="name" autoComplete="name" value={details.name} onChange={update} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'name-error' : undefined} required />{fieldErrors.name && <span className="field-error" id="name-error">{fieldErrors.name}</span>}</label>
              <label>Email address<input type="email" name="email" autoComplete="email" value={details.email} onChange={update} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} required />{fieldErrors.email && <span className="field-error" id="email-error">{fieldErrors.email}</span>}</label>
              <label>Mobile number<input type="tel" name="phone" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" value={details.phone} onChange={update} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'phone-error' : undefined} required />{fieldErrors.phone && <span className="field-error" id="phone-error">{fieldErrors.phone}</span>}</label>
              <label className="wide">Delivery address<input name="address" autoComplete="street-address" value={details.address} onChange={update} aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'address-error' : undefined} required />{fieldErrors.address && <span className="field-error" id="address-error">{fieldErrors.address}</span>}</label>
              <label>City or municipality<input name="city" autoComplete="address-level2" value={details.city} onChange={update} aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? 'city-error' : undefined} required />{fieldErrors.city && <span className="field-error" id="city-error">{fieldErrors.city}</span>}</label>
              <label>Province<select name="province" autoComplete="address-level1" value={details.province} onChange={update} aria-invalid={Boolean(fieldErrors.province)} aria-describedby={fieldErrors.province ? 'province-error' : undefined} required><option value="">Select province</option>{DELIVERY_PROVINCES.map(({ name }) => <option value={name} key={name}>{name}</option>)}</select>{fieldErrors.province && <span className="field-error" id="province-error">{fieldErrors.province}</span>}{deliveryRegion && <small className="delivery-region-note">{deliveryRegion} delivery · ₱{shipping}</small>}</label>
              <label>Postal code<input name="postal" inputMode="numeric" autoComplete="postal-code" maxLength="4" value={details.postal} onChange={update} aria-invalid={Boolean(fieldErrors.postal)} aria-describedby={fieldErrors.postal ? 'postal-error' : undefined} required />{fieldErrors.postal && <span className="field-error" id="postal-error">{fieldErrors.postal}</span>}</label>
            </div>
            <div className="payment-only"><span>Payment method</span><div className="payment-method"><i aria-hidden="true"><img src="/assets/gcash-mark.svg" alt="" width="24" height="20" /></i><span><b>GCash QR payment</b><small>Payment is required before your order is fulfilled.</small></span></div></div>
            <button className="button order-next" type="submit">Review order</button>
          </form>}
          {step === 2 && <div className="order-review"><button className="order-back" type="button" onClick={() => setStep(1)}><ArrowLeft size={17} /> Edit details</button><h3>Check everything.</h3><dl><div><dt>Deliver to</dt><dd>{details.name}<br />{details.address}, {details.city}, {details.province} {details.postal}<br />{details.phone}</dd></div><div><dt>Delivery</dt><dd>{deliveryRegion} · ₱{shipping}</dd></div><div><dt>Updates</dt><dd>{details.email}</dd></div><div><dt>Payment</dt><dd>GCash QR payment</dd></div></dl><button className="button order-next" type="button" onClick={placeOrder} disabled={submitting}>{submitting ? 'Saving order…' : 'Place order'}</button>{submitError && <p className="order-error" role="alert">{submitError}</p>}<p className="order-note">No wallet credentials are collected. Payment is verified manually before fulfillment.</p></div>}
          {step === 3 && orderResult && <div className="order-payment"><div className="payment-copy"><span className="payment-status">Order reserved</span><h3>Pay with GCash.</h3><p>Scan the QR using GCash and enter the exact amount shown. Then submit your receipt for verification.</p><dl><div><dt>Amount</dt><dd>₱{total}</dd></div><div><dt>Order</dt><dd>{orderResult.orderNumber}</dd></div></dl>{proofSubmitted ? <div className="proof-success" role="status"><CheckCircle size={24} weight="fill" /><div><b>Payment proof submitted</b><p>Please wait for our verification email before we prepare your order. We’ll also email you if the payment needs attention.</p></div></div> : <form className="payment-proof-form" onSubmit={submitPaymentProof}><label>GCash reference number<input name="reference" inputMode="numeric" value={paymentProof.reference} onChange={(event) => setPaymentProof(current => ({ ...current, reference: event.target.value }))} required /></label><div><label>Sender name<input name="senderName" autoComplete="name" value={paymentProof.senderName} onChange={(event) => setPaymentProof(current => ({ ...current, senderName: event.target.value }))} required /></label><label>Sender mobile number<input name="senderPhone" type="tel" inputMode="tel" autoComplete="tel" value={paymentProof.senderPhone} onChange={(event) => setPaymentProof(current => ({ ...current, senderPhone: event.target.value }))} required /></label></div><label className="receipt-field">Receipt screenshot<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} required /><small>{receiptFile ? `${receiptFile.name} · ${(receiptFile.size / 1024 / 1024).toFixed(1)} MB` : 'JPG, PNG or WebP · Maximum 3 MB'}</small></label><button className="button" type="submit" disabled={proofSubmitting}>{proofSubmitting ? 'Uploading receipt…' : 'Submit payment proof'}</button>{proofError && <p className="order-error" role="alert">{proofError}</p>}</form>}</div><figure className="payment-qr"><img src="/assets/qr-payment.png" alt="GCash InstaPay QR for Tappy Card" width="232" height="349" /><figcaption>GCash QR · Tappy Card</figcaption></figure></div>}
        </div>
        <aside className="order-summary" aria-label="Order summary"><img src="/assets/tappy-hero.jpg" alt="White Tappy NFC card" width="900" height="506" /><div><span>White Tappy card × {quantity}</span><b>₱{quantity * 199}</b></div><div><span>Delivery{deliveryRegion ? ` · ${deliveryRegion}` : ''}</span><b>{deliveryRegion ? `₱${shipping}` : 'Select province'}</b></div><div className="summary-total"><span>Total</span><strong>{deliveryRegion ? `₱${total}` : '—'}</strong></div></aside>
      </div>
    </div>
  </section>
}

function Footer() { return <footer className="footer"><div className="shell footer-grid"><div><Logo /><p>One tap. Every connection.</p></div><div><b>Explore</b><a href="/#products">Products</a><a href="/faqs">FAQs</a><a href="/#business">For business</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><div><b>Contact</b><a href="https://mail.google.com/mail/?view=cm&fs=1&to=hello%40tappycard.tech" target="_blank" rel="noreferrer">hello@tappycard.tech</a><a className="footer-social-link" href="https://www.facebook.com/profile.php?id=61593846634611" target="_blank" rel="noreferrer" aria-label="Tappy on Facebook"><FacebookLogo size={18} weight="fill" aria-hidden="true" />Facebook</a><a className="footer-social-link" href="https://www.instagram.com/tappycard.tech/" target="_blank" rel="noreferrer" aria-label="Tappy on Instagram"><InstagramLogo size={18} weight="bold" aria-hidden="true" />Instagram</a></div></div><div className="shell footer-bottom"><span>© 2026 Tappy</span><span>Made in the Philippines  <span role="img" aria-label="Philippine flag">🇵🇭</span></span></div></footer> }

export default function App() {
  const appRef = useRef(null)
  const currentPath = window.location.pathname.replace(/\/+$/, '')
  const orderPage = currentPath === '/order'
  const adminPage = currentPath === '/r'
  const howItWorksPage = currentPath === '/faqs'
  const privacyPage = currentPath === '/privacy'
  const termsPage = currentPath === '/terms'
  const publicPageId = currentPath.match(/^\/p\/([A-Za-z0-9_-]{22})$/)?.[1] || ''
  const customerEditToken = currentPath.match(/^\/edit\/([A-Za-z0-9_-]{43})$/)?.[1] || ''
  const customerEditor = Boolean(customerEditToken)
  const managedPage = Boolean(publicPageId)
  const unknownPage = !['', '/order', '/r', '/faqs', '/privacy', '/terms'].includes(currentPath) && !managedPage && !customerEditor
  useEffect(() => {
    if (currentPath === '') track('homepage_view')
    if (orderPage) track('checkout_start')
    const trackOrderClick = (event) => {
      if (event.target.closest('a[href="/order"]')) track('order_click')
    }
    document.addEventListener('click', trackOrderClick)
    return () => document.removeEventListener('click', trackOrderClick)
  }, [currentPath, orderPage])
  useGSAP(() => {
    if (orderPage || adminPage || managedPage || customerEditor || unknownPage) return undefined
    const media = gsap.matchMedia()
    media.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray('.gsap-media').forEach((element) => {
        gsap.timeline({ scrollTrigger: { trigger: element, start: 'top 92%', end: 'bottom 8%', scrub: 1 } })
          .fromTo(element, { scale: .92, opacity: .72 }, { scale: 1, opacity: 1, ease: 'none', duration: .35 })
          .to(element, { scale: 1, opacity: 1, ease: 'none', duration: .45 })
          .to(element, { scale: .985, opacity: .78, ease: 'none', duration: .20 })
      })
    })
    media.add('(min-width: 641px) and (prefers-reduced-motion: no-preference)', () => {
      if (document.querySelector('.footer-reveal')) gsap.fromTo('.footer',
        { clipPath: 'inset(100% 0 0 0 round 28px 28px 0 0)' },
        {
          clipPath: 'inset(0% 0 0 0 round 28px 28px 0 0)',
          ease: 'none',
          scrollTrigger: { trigger: '.footer-reveal', start: 'top bottom', end: 'top 55%', scrub: 1 },
        },
      )
    })
    return () => media.revert()
  }, { scope: appRef, dependencies: [orderPage, adminPage, howItWorksPage, privacyPage, termsPage, managedPage, customerEditor, unknownPage] })
  useEffect(() => {
    const publicMeta = howItWorksPage ? ['FAQs | Tappy NFC Card Philippines', 'Frequently asked questions about Tappy NFC Cards — how they work, pricing, shipping, and what you can share.', 'https://www.tappycard.tech/faqs'] : privacyPage ? ['Privacy Policy | Tappy', 'Read how Tappy collects, uses, protects and shares personal information.', 'https://www.tappycard.tech/privacy'] : termsPage ? ['Terms of Service | Tappy', 'Read the terms governing Tappy cards, payments, delivery and managed profiles.', 'https://www.tappycard.tech/terms'] : null
    document.title = unknownPage ? 'Page not found | Tappy' : adminPage ? 'Tappy Admin' : customerEditor ? 'Edit your Tappy Page' : managedPage ? 'Tappy Page' : orderPage ? 'Order Tappy | Tappy' : publicMeta?.[0] || 'Tappy NFC Card Philippines | One Tap, Every Connection'
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    robots.content = unknownPage || adminPage || managedPage || customerEditor || orderPage ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large'
    const canonical = document.querySelector('link[rel="canonical"]')
    canonical?.setAttribute('href', managedPage ? window.location.href : orderPage ? 'https://www.tappycard.tech/order' : publicMeta?.[2] || 'https://www.tappycard.tech/')
    const description = orderPage ? 'Order your white Tappy NFC card and submit your GCash payment securely.' : publicMeta?.[1] || 'Share contact details, social profiles, reviews, menus, booking links and websites instantly with a reusable Tappy NFC digital business card. No app required.'
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical?.getAttribute('href') || window.location.href)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7f6f2')
    document.querySelectorAll('[aria-label="Philippine flag"]').forEach((flag) => {
      flag.textContent = ''
      flag.classList.add('fi', 'fi-ph')
    })
    const elements = document.querySelectorAll('[data-fade]')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-visible', entry.isIntersecting))
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [adminPage, customerEditor, howItWorksPage, managedPage, orderPage, privacyPage, termsPage, unknownPage])
  if (howItWorksPage) return <div ref={appRef}><PublicPage type="how" Header={Header} Footer={Footer} /></div>
  if (privacyPage) return <div ref={appRef}><PublicPage type="privacy" Header={Header} Footer={Footer} /></div>
  if (termsPage) return <div ref={appRef}><PublicPage type="terms" Header={Header} Footer={Footer} /></div>
  if (unknownPage) return <NotFound />
  if (managedPage) return <React.Suspense fallback={<RouteLoading/>}><TappyPage publicId={publicPageId}/></React.Suspense>
  if (customerEditor) return <React.Suspense fallback={<RouteLoading/>}><CustomerPageEditor token={customerEditToken}/></React.Suspense>
  if (adminPage) return <div ref={appRef}><React.Suspense fallback={<RouteLoading/>}><AdminDashboard/></React.Suspense></div>
  if (orderPage) return <main className="page order-page" ref={appRef}><a href="#order" className="skip-link">Skip to order form</a><Header staticNav checkout /><OrderFlow /><div className="order-page-footer shell"><Logo /><a href="https://mail.google.com/mail/?view=cm&fs=1&to=hello%40tappycard.tech" target="_blank" rel="noreferrer">Need help? hello@tappycard.tech</a></div></main>
  return <main className="page" ref={appRef}><a href="#top" className="skip-link">Skip to main content</a><Header /><BackToTop /><div className="site-curtain"><Hero /><HowItWorks /><DestinationSwitcher /><Products /><UseCaseTicker /><Pricing /></div><div className="footer-reveal"><div className="footer-stack"><Footer /></div></div></main>
}

