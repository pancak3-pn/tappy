import { useEffect, useState } from 'react'
import { CheckCircle, EnvelopeSimple, Star, WarningCircle } from '@phosphor-icons/react'
import './feedback.css'

const RatingStars = ({ value, onChange, label }) => (
  <div className="feedback-rating" role="radiogroup" aria-label={label}>
    <span className="feedback-rating-label">{label}</span>
    <div className="feedback-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={value >= star ? 'feedback-star active' : 'feedback-star'}
          onClick={() => onChange(star)}
        >
          <Star size={26} weight={value >= star ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  </div>
)

function PublicWall() {
  const [publicFeedback, setPublicFeedback] = useState(null)
  useEffect(() => {
    let active = true
    fetch('/api/feedback/public').then((response) => response.json()).then((result) => {
      if (active) setPublicFeedback(result)
    }).catch(() => {})
    return () => { active = false }
  }, [])
  if (!publicFeedback) return null
  if (!publicFeedback.feedback?.length) {
    return (
      <section className="feedback-wall feedback-wall-empty" aria-label="Customer feedback">
        <h2>What Tappy customers say</h2>
        <div className="feedback-empty-card">
          <Star size={26} weight="fill" aria-hidden="true" />
          <p>No published reviews yet. Be the first to share your experience — feedback appears here once it is reviewed and published.</p>
        </div>
      </section>
    )
  }
  return (
    <section className="feedback-wall" aria-label="Customer feedback">
      <h2>What Tappy customers say</h2>
      {publicFeedback.averages?.overall && (
        <p className="feedback-wall-summary">
          <Star size={18} weight="fill" /> {publicFeedback.averages.overall} average · {publicFeedback.averages.count} published review{publicFeedback.averages.count === 1 ? '' : 's'}
        </p>
      )}
      <div className="feedback-wall-grid">
        {publicFeedback.feedback.map((entry, index) => (
          <article className="feedback-card" key={index}>
            <div className="feedback-card-stars" aria-label={`${entry.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} weight={entry.rating >= star ? 'fill' : 'light'} />)}
            </div>
            {entry.comment && <p className="feedback-card-comment">{entry.comment}</p>}
            <footer><b>{entry.display_name}</b><span>{new Intl.DateTimeFormat('en-PH', { dateStyle:'medium' }).format(new Date(entry.created_at))}</span></footer>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function FeedbackPage() {
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('t') || ''
  const [step, setStep] = useState(urlToken ? 'form' : 'email')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [context, setContext] = useState(null)
  const [ratings, setRatings] = useState({ overall:0, product:0, service:0 })
  const [comment, setComment] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!urlToken) return undefined
    let active = true
    fetch(`/api/feedback/verify?t=${encodeURIComponent(urlToken)}`).then(async (response) => {
      const result = await response.json()
      if (!active) return
      if (!response.ok) { setStep('email'); setError(result.error || 'This feedback link is invalid or expired.'); return }
      setContext(result)
      const names = (result.customerName || '').trim().split(/\s+/).filter(Boolean)
      const suggested = names.length ? `${names[0]} ${names[names.length - 1][0] || ''}.`.trim() : ''
      setDisplayName(suggested)
    }).catch(() => { if (active) setStep('email') })
    return () => { active = false }
  }, [urlToken])

  async function requestLink(event) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/feedback/request', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ email }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.')
      if (result.alreadyRequested) {
        setError('A feedback link has already been sent for this order. Check your email, or wait for that link to expire before requesting another.')
        return
      }
      if (result.alreadySubmitted) {
        setError('Feedback has already been submitted for this order.')
        return
      }
      setStep('sent')
    } catch (requestError) { setError(requestError.message) }
    finally { setSending(false) }
  }

  async function submitFeedback(event) {
    event.preventDefault()
    if (!ratings.overall || !ratings.product || !ratings.service) { setError('Rate the product, the service, and your overall experience.'); return }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/feedback/submit', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ token:urlToken, rating:ratings.overall, productRating:ratings.product, serviceRating:ratings.service, comment, displayName }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your feedback could not be submitted.')
      setStep('done')
    } catch (submitError) { setError(submitError.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="feedback-page">
      <header className="feedback-hero">
        <h1>{step === 'done' ? 'Thank you!' : step === 'form' ? 'How did we do?' : 'Tappy feedback'}</h1>
        <p>{step === 'done' ? 'Your feedback helps us make Tappy better for everyone.' : step === 'form' ? `Feedback for ${context?.orderNumber || 'your order'}. It takes about a minute.` : 'Share your experience with our product and service.'}</p>
      </header>

      {step === 'email' && (
        <section className="feedback-panel">
          <form onSubmit={requestLink}>
            <label>Order email
              <input type="email" name="email" autoComplete="email" spellCheck={false} required value={email} maxLength="160" placeholder="The email used on your Tappy order" onChange={(event) => setEmail(event.target.value)} />
            </label>
            <p className="feedback-hint">Feedback is limited to verified customers. If your order email matches, we will send a private, one-time feedback link.</p>
            {error && <p className="feedback-error" role="alert"><WarningCircle size={16} /> {error}</p>}
            <button className="button" type="submit" disabled={sending || !email.trim()}>{sending ? 'Checking…' : <><EnvelopeSimple size={18} /> Send my feedback link</>}</button>
          </form>
        </section>
      )}

      {step === 'sent' && (
        <section className="feedback-panel">
          <CheckCircle size={34} weight="fill" />
          <h2>Check your inbox</h2>
          <p className="feedback-hint">If {email} matches a completed Tappy order, a private feedback link is on its way. It expires in 7 days and can be used once.</p>
        </section>
      )}

      {step === 'form' && (
        <section className="feedback-panel">
          <form onSubmit={submitFeedback}>
            <RatingStars label="Overall experience" value={ratings.overall} onChange={(value) => setRatings({ ...ratings, overall:value })} />
            <RatingStars label="Product (your Tappy card)" value={ratings.product} onChange={(value) => setRatings({ ...ratings, product:value })} />
            <RatingStars label="Service (ordering, payment, delivery)" value={ratings.service} onChange={(value) => setRatings({ ...ratings, service:value })} />
            <label>Display name (shown publicly)
              <input name="displayName" autoComplete="name" value={displayName} maxLength="60" placeholder="e.g., Juan D. or your business name" onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>Your comments (optional)
              <textarea name="comment" value={comment} maxLength="2000" rows="5" placeholder="What did you like? What can we improve?" onChange={(event) => setComment(event.target.value)} />
            </label>
            <span className="feedback-char-count">{comment.length} / 2000</span>
            {error && <p className="feedback-error" role="alert"><WarningCircle size={16} /> {error}</p>}
            <button className="button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit feedback'}</button>
          </form>
        </section>
      )}

      {step === 'done' && (
        <section className="feedback-panel">
          <CheckCircle size={34} weight="fill" />
          <p className="feedback-hint">Your feedback has been submitted and will appear publicly once reviewed by the Tappy team.</p>
          <a className="button" href="/">Back to tappycard.tech</a>
        </section>
      )}

      <PublicWall />
    </div>
  )
}
