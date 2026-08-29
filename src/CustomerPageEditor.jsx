import { useEffect, useRef, useState } from 'react'
import { ArrowSquareOut, CheckCircle, Eye, MapPin, Minus, Plus, XCircle } from '@phosphor-icons/react'
import ProfileImageUpload from './ProfileImageUpload.jsx'

const types = [['website','Website'],['maps','Google Maps'],['facebook','Facebook'],['instagram','Instagram'],['linkedin','LinkedIn'],['reviews','Google Reviews'],['portfolio','Portfolio'],['booking','Booking']]
const typeLabels = Object.fromEntries(types)
const fromPage = (page = {}) => ({ displayName:page.display_name || '', headline:page.headline || '', bio:page.bio || '', photoUrl:page.photo_url || '', email:page.email || '', phone:page.phone || '', location:page.location || '', accent:page.accent || 'forest', backgroundTexture:page.background_texture || 'clean', links:page.links?.length ? page.links : [{ type:'website', label:'Website', url:'' }] })
const linksToRequest = (links) => links.filter((link) => link.url.trim()).map((link) => ({ type:types.some(([type]) => type === link.type) ? link.type : 'website', label:typeLabels[link.type] || 'Website', url:link.url.trim() }))

function previewInitials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'TP'
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
      <form onSubmit={save} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); save(event) } }}>
        <div><label>Display name<input required maxLength="100" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)}/></label><label>Role or headline<input maxLength="120" value={form.headline} onChange={(e) => updateField('headline', e.target.value)}/></label></div>
        <label>Short introduction<textarea maxLength="360" value={form.bio} onChange={(e) => updateField('bio', e.target.value)}/></label>
        <ProfileImageUpload value={form.photoUrl} onUpload={() => {}} onRemove={() => {}} deferred onPendingChange={handlePhotoPending}/>
        <div><label>Public email<input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}/></label><label>Phone<input value={form.phone} onChange={(e) => updateField('phone', e.target.value)}/></label></div>
        <label>Location<input maxLength="140" value={form.location} onChange={(e) => updateField('location', e.target.value)}/></label>
        <div><label>Accent<select value={form.accent} onChange={(e) => updateField('accent', e.target.value)}><option value="forest">Tappy forest</option><option value="ink">Monochrome</option><option value="blue">Cobalt</option></select></label><label>Background<select value={form.backgroundTexture} onChange={(e) => updateField('backgroundTexture', e.target.value)}><option value="clean">Clean white</option><option value="linen">Soft linen</option><option value="silver">Brushed silver</option><option value="forest-grain">Forest grain</option><option value="blueprint">Blueprint grid</option></select></label></div>
        <fieldset><legend>Public links</legend>
          {form.links.slice(0,8).map((link,index) => <div key={index} className="customer-link-row">
            <select aria-label={`Link ${index + 1} type`} value={link.type} onChange={(e) => updateLink(index,'type',e.target.value)}>{types.map(([type,label]) => <option value={type} key={type}>{label}</option>)}</select>
            <input aria-label={`Link ${index + 1} URL`} type="url" placeholder="https://" value={link.url} onChange={(e) => updateLink(index,'url',e.target.value)}/>
            <button type="button" className="customer-link-remove" onClick={() => removeLink(index)} aria-label={`Remove link ${index + 1}`} title="Remove link"><Minus size={15}/></button>
          </div>)}
          <button type="button" className="customer-link-add" onClick={addLink} disabled={form.links.length >= 8}><Plus size={15}/>Add link</button>
        </fieldset>
        <div className="customer-editor-submit"><button type="submit" disabled={state === 'saving' || state === 'saved'}>{state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved' : 'Save changes'}</button>{dirty && <span className="customer-editor-unsaved">Unsaved changes</span>}{feedback.message && <p role="status" data-error={feedback.type === 'error'}>{feedback.type === 'success' ? <CheckCircle size={17}/> : <XCircle size={17}/>}{feedback.message}</p>}</div>
      </form>
      <aside className="customer-editor-preview"><div className="customer-editor-preview-label"><Eye size={15}/>Live preview</div><div className="customer-preview-phone-shell"><div className="customer-preview-phone" data-accent={form.accent} data-background={form.backgroundTexture}><header><span>tappy.</span></header><div className="customer-preview-profile">{previewPhoto ? <img src={previewPhoto} alt=""/> : <i>{previewInitials(form.displayName)}</i>}<h3>{form.displayName || 'Your name'}</h3><p>{form.headline || 'Your role or business'}</p>{form.location && <small><MapPin size={13}/>{form.location}</small>}</div>{form.bio && <p className="customer-preview-bio">{form.bio}</p>}<div className="customer-preview-actions">{form.phone && <button type="button">Call now</button>}{form.email && <a href={`mailto:${form.email}`} aria-label="Email">✉</a>}{form.links.filter((link) => link.url.trim()).map((link,index) => <button type="button" key={`${link.url}-${index}`} title={link.label}>{link.label === 'Website' ? '↗' : link.label.slice(0,2).toUpperCase()}</button>)}</div></div></div></aside>
    </div>
  </main>
}