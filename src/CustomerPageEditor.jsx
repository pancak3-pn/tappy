import { useEffect, useRef, useState } from 'react'
import { ArrowSquareOut, Briefcase, CalendarBlank, CheckCircle, Eye, Globe, LinkedinLogo, Minus, Plus, XCircle } from '@phosphor-icons/react'
import { SiFacebook, SiGooglemaps } from 'react-icons/si'
import { FcGoogle } from 'react-icons/fc'
import ProfileImageUpload from './ProfileImageUpload.jsx'
import ManagedProfileCard from './ManagedProfileCard.jsx'

const types = [['website','Website'],['maps','Google Maps'],['facebook','Facebook'],['instagram','Instagram'],['linkedin','LinkedIn'],['reviews','Google Reviews'],['portfolio','Portfolio'],['booking','Booking']]
const typeLabels = Object.fromEntries(types)
const fromPage = (page = {}) => ({ displayName:page.display_name || '', headline:page.headline || '', bio:page.bio || '', photoUrl:page.photo_url || '', email:page.email || '', phone:page.phone || '', location:page.location || '', accent:page.accent || 'forest', backgroundTexture:page.background_texture || 'clean', template:page.template || 'classic', links:page.links?.length ? page.links : [{ type:'website', label:'Website', url:'' }] })
const linksToRequest = (links) => links.filter((link) => link.url.trim()).map((link) => ({ type:types.some(([type]) => type === link.type) ? link.type : 'website', label:typeLabels[link.type] || 'Website', url:link.url.trim() }))

// Instagram's real gradient logo as an inline SVG
function InstagramIcon({ size = '1em' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%"  stopColor="#feda75"/>
          <stop offset="25%" stopColor="#fa7e1e"/>
          <stop offset="55%" stopColor="#d62976"/>
          <stop offset="78%" stopColor="#962fbf"/>
          <stop offset="100%" stopColor="#4f5bd5"/>
        </radialGradient>
      </defs>
      <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

const linkIconMap = {
  website:   <Globe />,
  maps:      <SiGooglemaps color="#34A853" />,
  facebook:  <SiFacebook  color="#1877F2" />,
  instagram: <InstagramIcon />,
  linkedin:  <LinkedinLogo color="#0A66C2" />,
  reviews:   <FcGoogle />,
  portfolio: <Briefcase />,
  booking:   <CalendarBlank />,
}

export default function CustomerPageEditor({ token }) {
  const [form, setForm] = useState(fromPage())
  const [original, setOriginal] = useState(fromPage())
  const [publicId, setPublicId] = useState('')
  const [state, setState] = useState('loading')
  const [feedback, setFeedback] = useState({ type:'', message:'' })
  const [photoPending, setPhotoPending] = useState(null)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const loadedRef = useRef(false)
  const savedRef = useRef(false)
  const markDirty = () => { if (loadedRef.current) { dirtyRef.current = true; setDirty(true) } }
  const clearDirty = () => { dirtyRef.current = false; setDirty(false) }

  useEffect(() => {
    fetch(`/api/pages/edit/${token}`).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'This editing link is unavailable.')
      const loaded = fromPage(result.page)
      setForm(loaded); setOriginal(loaded); setPublicId(result.page.public_id); setState('ready'); loadedRef.current = true
    }).catch((error) => { setFeedback({ type:'error', message:error.message }); setState('error') })
  }, [token])

  // Refresh the "original" baseline after a successful save so dirty resets.
  useEffect(() => {
    if (state === 'saved') {
      setOriginal(form)
      clearDirty()
      savedRef.current = true
    }
  }, [state])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (state !== 'ready' && state !== 'saved') return undefined
    const warn = (event) => {
      if (!dirty || savedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, state])

  function updateField(key, value) {
    markDirty()
    setForm((current) => ({ ...current, [key]:value }))
  }
  function updateLink(index, key, value) {
    markDirty()
    setForm((current) => ({ ...current, links:current.links.map((link, i) => i === index ? { ...link, [key]:value, ...(key === 'type' ? { label:typeLabels[value] || 'Website' } : {}) } : link) }))
  }
  function addLink() {
    markDirty()
    setForm((current) => ({ ...current, links:[...current.links, { type:'website', label:'Website', url:'' }] }))
  }
  function removeLink(index) {
    markDirty()
    setForm((current) => ({ ...current, links:current.links.filter((_, i) => i !== index) }))
  }
  function handlePhotoPending(pending) {
    markDirty()
    setPhotoPending(pending)
  }

  async function save(event) {
    event.preventDefault()
    setState('saving'); setFeedback({ type:'', message:'' })
    try {
      // Upload (or remove) a pending photo first so the PATCH includes the new URL in one commit.
      let photoUrl = form.photoUrl
      if (photoPending && photoPending !== 'remove') {
        const photoResponse = await fetch(`/api/pages/edit/${token}/photo`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ imageData:photoPending.imageData }) })
        const photoResult = await photoResponse.json()
        if (!photoResponse.ok) throw new Error(photoResult.error || 'Your photo could not be uploaded.')
        photoUrl = photoResult.photoUrl
      } else if (photoPending === 'remove') {
        const photoResponse = await fetch(`/api/pages/edit/${token}/photo`, { method:'DELETE' })
        const photoResult = await photoResponse.json()
        if (!photoResponse.ok) throw new Error(photoResult.error || 'Your photo could not be removed.')
        photoUrl = ''
      }
      const response = await fetch(`/api/pages/edit/${token}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ ...form, photoUrl, links:linksToRequest(form.links) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your page could not be saved.')
      const saved = fromPage({ ...result.page, photo_url:photoUrl || result.page.photo_url })
      setForm(saved)
      setPhotoPending(null)
      setFeedback({ type:'success', message:'Your public page is updated.' })
      setState('saved')
      clearDirty()
      window.setTimeout(() => setState('ready'), 2600)
    } catch (error) {
      setState('ready')
      setFeedback({ type:'error', message:error.message })
    }
  }

  if (state === 'loading') return <main className="customer-editor-state"><b>tappy.</b><div className="customer-editor-loading" aria-label="Loading"><span/><span/><span/></div><p>Opening your page editor...</p></main>
  if (state === 'error') return <main className="customer-editor-state"><b>tappy.</b><h1>Link unavailable.</h1><p>{feedback.message}</p><a href="mailto:hello@tappycard.tech">Contact Tappy</a></main>

  const previewPhoto = photoPending === 'remove' ? '' : (photoPending?.imageData || form.photoUrl || '')

  return <main className="customer-editor"><header><a href="/">tappy.</a>{publicId && <a href={`/p/${publicId}`} target="_blank" rel="noreferrer">View page <ArrowSquareOut size={17}/></a>}</header>
    <div className="customer-editor-layout">
      <section><span>Private page editor</span><h1>Make it yours.</h1><p>Edit your details, then save. Nothing changes on your public page until you press Save.</p></section>
      <div className="customer-editor-main">
        <form onSubmit={save} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); save(event) } }}>
          <div><label>Display name<input required maxLength="100" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)}/></label><label>Role or headline<input maxLength="120" value={form.headline} onChange={(e) => updateField('headline', e.target.value)}/></label></div>
          <label>Short introduction<textarea maxLength="360" value={form.bio} onChange={(e) => updateField('bio', e.target.value)}/></label>
          <ProfileImageUpload value={form.photoUrl} onUpload={() => {}} onRemove={() => {}} deferred onPendingChange={handlePhotoPending}/>
          <div><label>Public email<input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}/></label><label>Phone<input value={form.phone} onChange={(e) => updateField('phone', e.target.value)}/></label></div>
          <label>Location<input maxLength="140" value={form.location} onChange={(e) => updateField('location', e.target.value)}/></label>
           <div><label>Button color<select value={form.accent} onChange={(e) => updateField('accent', e.target.value)}><option value="forest">Forest green</option><option value="ink">Black</option><option value="blue">Cobalt blue</option></select></label><label>Background<select value={form.backgroundTexture} onChange={(e) => updateField('backgroundTexture', e.target.value)}><option value="clean">Clean white</option><option value="linen">Soft linen</option><option value="silver">Brushed silver</option><option value="forest-grain">Forest grain</option><option value="blueprint">Blueprint grid</option></select></label></div>
           <fieldset className="customer-template-picker"><legend>Page layout</legend><div className="customer-template-options">{[['classic','Classic','Centered profile'],['split','Split','Photo-led intro'],['compact','Compact','Links first']].map(([value,label,description]) => <label key={value} className={form.template === value ? 'selected' : ''}><input type="radio" name="template" value={value} checked={form.template === value} onChange={(e) => updateField('template', e.target.value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset>
          <fieldset><legend>Public links</legend>
            {form.links.slice(0,8).map((link,index) => <div key={index} className="customer-link-row">
              <div className="customer-link-type-wrapper">
                <span className="customer-link-type-icon">{linkIconMap[link.type] || <FaGlobe/>}</span>
                <select aria-label={`Link ${index + 1} type`} value={link.type} onChange={(e) => updateLink(index,'type',e.target.value)}>{types.map(([type,label]) => <option value={type} key={type}>{label}</option>)}</select>
              </div>
              <input aria-label={`Link ${index + 1} URL`} type="url" placeholder="https://" value={link.url} onChange={(e) => updateLink(index,'url',e.target.value)}/>
              <button type="button" className="customer-link-remove" onClick={() => removeLink(index)} aria-label={`Remove link ${index + 1}`} title="Remove link"><Minus size={15}/></button>
            </div>)}
            <button type="button" className="customer-link-add" onClick={addLink} disabled={form.links.length >= 8}><Plus size={15}/>Add link</button>
          </fieldset>
          <div className="customer-editor-submit"><button type="submit" disabled={state === 'saving' || state === 'saved'}>{state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved' : 'Save changes'}</button>{dirty && <span className="customer-editor-unsaved">Unsaved changes</span>}{feedback.message && <p role="status" data-error={feedback.type === 'error'}>{feedback.type === 'success' ? <CheckCircle size={17}/> : <XCircle size={17}/>}{feedback.message}</p>}</div>
        </form>

         <aside className="customer-editor-preview">
           <div className="customer-editor-preview-label"><Eye size={15}/>Live preview</div>
           <div className="customer-preview-phone-shell">
             <ManagedProfileCard page={{ ...form, photoUrl:previewPhoto }} preview/>
           </div>
         </aside>
      </div>
    </div>
  </main>
}
