import { useEffect, useState } from 'react'
import { Briefcase, CalendarBlank, EnvelopeSimple, Globe, LinkedinLogo, MapPin } from '@phosphor-icons/react'
import { SiFacebook, SiGoogle, SiGooglemaps, SiInstagram } from 'react-icons/si'
import { track } from './analytics'

const linkIcons = {
  website:Globe,
  instagram:SiInstagram,
  linkedin:LinkedinLogo,
  facebook:SiFacebook,
  maps:SiGooglemaps,
  reviews:SiGoogle,
  portfolio:Briefcase,
  booking:CalendarBlank,
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
    }
    Object.entries(values).forEach(([selector, content]) => document.querySelector(selector)?.setAttribute('content', content))
  }, [page, publicId])

  if (state === 'loading') return <main className="managed-page-state"><span className="managed-page-logo">tappy.</span><p>Opening page...</p></main>
  if (state === 'missing') return <main className="managed-page-state"><a className="managed-page-logo" href="/">tappy.</a><h1>Page unavailable.</h1><p>This Tappy Page may be inactive or the link may be incorrect.</p></main>

  const updateUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=hello%40tappycard.tech&su=${encodeURIComponent(`Update request for Tappy Page ${publicId}`)}`
  return <main className="managed-page" data-accent={page.accent} data-background={page.background_texture || 'clean'}>
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
