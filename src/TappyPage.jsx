import { useEffect, useState } from 'react'
import { Briefcase, CalendarBlank, EnvelopeSimple, Globe, LinkedinLogo, MapPin } from '@phosphor-icons/react'
import { SiFacebook, SiGooglemaps } from 'react-icons/si'
import { FcGoogle } from 'react-icons/fc'
import { track } from './analytics'

// Branded icon wrappers — forward props so size={20} works at call sites
const FacebookIcon  = (props) => <SiFacebook   color="#1877F2" {...props} />
const LinkedinIcon  = (props) => <LinkedinLogo color="#0A66C2" {...props} />
const GoogleMapsIcon= (props) => <SiGooglemaps color="#34A853" {...props} />
const GoogleIcon    = (props) => <FcGoogle {...props} />
function InstagramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad-pub" cx="30%" cy="107%" r="150%">
          <stop offset="0%"  stopColor="#feda75"/>
          <stop offset="25%" stopColor="#fa7e1e"/>
          <stop offset="55%" stopColor="#d62976"/>
          <stop offset="78%" stopColor="#962fbf"/>
          <stop offset="100%" stopColor="#4f5bd5"/>
        </radialGradient>
      </defs>
      <path fill="url(#ig-grad-pub)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

const linkIcons = {
  website:   Globe,
  instagram: InstagramIcon,
  linkedin:  LinkedinIcon,
  facebook:  FacebookIcon,
  maps:      GoogleMapsIcon,
  reviews:   GoogleIcon,
  portfolio: Briefcase,
  booking:   CalendarBlank,
}

export default function TappyPage({ publicId }) {
  const [page, setPage] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    fetch(`/api/pages/${publicId}`).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Page unavailable')
      if (active) { setPage(result.page); setState('ready') }
    }).catch(() => { if (active) setState('missing') })
    return () => { active = false }
  }, [publicId])

  useEffect(() => {
    if (!page) return
    track('profile_view', { pageId:publicId })
    document.title = `${page.display_name} | Tappy`
    const description = page.bio || [page.headline, page.location].filter(Boolean).join(' in ') || `Connect with ${page.display_name} on Tappy.`
    const values = {
      'meta[name="description"]':description,
      'meta[property="og:title"]':`${page.display_name} | Tappy`,
      'meta[property="og:description"]':description,
      'meta[property="og:url"]':window.location.href,
      'meta[name="twitter:title"]':`${page.display_name} | Tappy`,
      'meta[name="twitter:description"]':description,
      'meta[property="og:image"]':page.photo_url || '/assets/tappy-personal-card.png',
    }
    Object.entries(values).forEach(([selector, content]) => document.querySelector(selector)?.setAttribute('content', content))
  }, [page, publicId])

  if (state === 'loading') return <main className="managed-page-state"><span className="managed-page-logo">tappy.</span><p>Opening page...</p></main>
  if (state === 'missing') return <main className="managed-page-state"><a className="managed-page-logo" href="/">tappy.</a><h1>Page unavailable.</h1><p>This Tappy Page may be inactive or the link may be incorrect.</p></main>

  const updateUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=hello%40tappycard.tech&su=${encodeURIComponent(`Update request for Tappy Page ${publicId}`)}`
  return <main className="managed-page" data-accent={page.accent} data-background={page.background_texture || 'clean'} data-template={page.template || 'classic'}>
    <div className="managed-page-shell">
      <header><a href="/" aria-label="Tappy home">tappy.</a></header>
      <section className="managed-page-profile">
        {page.photo_url ? <img src={page.photo_url} alt={page.display_name} width="144" height="144"/> : <div className="managed-page-initials" aria-hidden="true">{page.display_name.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div>}
        <div><h1>{page.display_name}</h1>{page.headline && <p className="managed-page-headline">{page.headline}</p>}{page.location && <p className="managed-page-location"><MapPin size={15}/>{page.location}</p>}</div>
      </section>
      {page.bio && <p className="managed-page-bio">{page.bio}</p>}
      {(page.phone || page.email || page.links?.length) && <div className="managed-page-actions">
        {page.phone && <a className="managed-page-call" href={`tel:${page.phone}`} aria-label={`Call ${page.display_name}`}>Call now</a>}
        {(page.email || page.links?.length) && <div className="managed-page-icon-row" aria-label="Contact and public links">
          {page.email && <a href={`mailto:${page.email}`} aria-label={`Email ${page.display_name}`} title="Email" data-link-type="email"><EnvelopeSimple size={20}/></a>}
          {page.links?.map((link, index) => { const Icon = linkIcons[link.type] || Globe; return <a href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`} aria-label={link.label} title={link.label} data-link-type={link.type}><Icon size={20}/></a> })}
        </div>}
      </div>}
      <footer><a href={updateUrl} target="_blank" rel="noreferrer">Request an update</a><span>Powered by Tappy</span></footer>
    </div>
  </main>
}
