import { useEffect, useState } from 'react'
import { ArrowSquareOut, EnvelopeSimple, FacebookLogo, Globe, InstagramLogo, LinkedinLogo, MapPin, Phone, Star } from '@phosphor-icons/react'

const linkIcons = {
  website:Globe,
  instagram:InstagramLogo,
  linkedin:LinkedinLogo,
  facebook:FacebookLogo,
  maps:MapPin,
  reviews:Star,
  portfolio:Globe,
  booking:Globe,
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

  function saveContact() {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${page.display_name}`]
    if (page.headline) lines.push(`TITLE:${page.headline}`)
    if (page.phone) lines.push(`TEL:${page.phone}`)
    if (page.email) lines.push(`EMAIL:${page.email}`)
    lines.push('END:VCARD')
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type:'text/vcard;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${page.display_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'tappy-contact'}.vcf`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (state === 'loading') return <main className="managed-page-state"><span className="managed-page-logo">tappy.</span><p>Opening page...</p></main>
  if (state === 'missing') return <main className="managed-page-state"><a className="managed-page-logo" href="/">tappy.</a><h1>Page unavailable.</h1><p>This Tappy Page may be inactive or the link may be incorrect.</p></main>

  const updateUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=hello%40tappycard.tech&su=${encodeURIComponent(`Update request for Tappy Page ${publicId}`)}`
  return <main className="managed-page" data-accent={page.accent}>
    <div className="managed-page-shell">
      <header><a href="/" aria-label="Tappy home">tappy.</a><span>Managed page</span></header>
      <section className="managed-page-profile">
        {page.photo_url ? <img src={page.photo_url} alt={page.display_name} width="144" height="144"/> : <div className="managed-page-initials" aria-hidden="true">{page.display_name.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div>}
        <div><h1>{page.display_name}</h1>{page.headline && <p className="managed-page-headline">{page.headline}</p>}{page.location && <p className="managed-page-location"><MapPin size={15}/>{page.location}</p>}</div>
      </section>
      {page.bio && <p className="managed-page-bio">{page.bio}</p>}
      {(page.phone || page.email) && <div className="managed-page-actions">
        <button type="button" onClick={saveContact}>Save contact</button>
        {page.phone && <a href={`tel:${page.phone}`} aria-label={`Call ${page.display_name}`}><Phone size={19}/></a>}
        {page.email && <a href={`mailto:${page.email}`} aria-label={`Email ${page.display_name}`}><EnvelopeSimple size={19}/></a>}
      </div>}
      {!!page.links?.length && <nav className="managed-page-links" aria-label={`${page.display_name} links`}>
        {page.links.map((link, index) => { const Icon = linkIcons[link.type] || Globe; return <a href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}><Icon size={20}/><span>{link.label}</span><ArrowSquareOut size={17}/></a> })}
      </nav>}
      <footer><a href={updateUrl} target="_blank" rel="noreferrer">Request an update</a><span>Powered by Tappy</span></footer>
    </div>
  </main>
}
