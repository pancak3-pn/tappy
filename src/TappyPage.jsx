import { useEffect, useState } from 'react'
import { track } from './analytics'
import ManagedProfileCard from './ManagedProfileCard.jsx'

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

  if (state === 'loading') return <main className="managed-page-state"><span className="managed-page-logo">tappy.</span><p>Opening page…</p></main>
  if (state === 'missing') return <main className="managed-page-state"><a className="managed-page-logo" href="/">tappy.</a><h1>Page unavailable.</h1><p>This Tappy Page may be inactive or the link may be incorrect.</p></main>

  return <main className="managed-page" data-accent={page.accent} data-background={page.background_texture || 'clean'} data-template={page.template || 'classic'}>
    <ManagedProfileCard page={page}/>
  </main>
}
