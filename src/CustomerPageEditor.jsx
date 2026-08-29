import { useEffect, useState } from 'react'
import { ArrowSquareOut, CheckCircle } from '@phosphor-icons/react'
import ProfileImageUpload from './ProfileImageUpload.jsx'

const types = [['website','Website'],['maps','Google Maps'],['facebook','Facebook'],['instagram','Instagram'],['linkedin','LinkedIn'],['reviews','Google Reviews'],['portfolio','Portfolio'],['booking','Booking']]
const fromPage = (page = {}) => ({ displayName:page.display_name || '', headline:page.headline || '', bio:page.bio || '', photoUrl:page.photo_url || '', email:page.email || '', phone:page.phone || '', location:page.location || '', accent:page.accent || 'forest', backgroundTexture:page.background_texture || 'clean', links:page.links?.length ? page.links : [{ type:'website', label:'Website', url:'' }] })

export default function CustomerPageEditor({ token }) {
  const [form, setForm] = useState(fromPage())
  const [publicId, setPublicId] = useState('')
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/pages/edit/${token}`).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'This editing link is unavailable.')
      setForm(fromPage(result.page)); setPublicId(result.page.public_id); setState('ready')
    }).catch((error) => { setMessage(error.message); setState('error') })
  }, [token])

  function updateLink(index, key, value) {
    setForm((current) => ({ ...current, links:current.links.map((link, i) => i === index ? { ...link, [key]:value, ...(key === 'type' ? { label:types.find(([type]) => type === value)?.[1] || 'Website' } : {}) } : link) }))
  }
  async function save(event) {
    event.preventDefault(); setState('saving'); setMessage('')
    try {
      const response = await fetch(`/api/pages/edit/${token}`, { method:'PATCH', headers:{ 'content-type':'application/json' }, body:JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your page could not be saved.')
      setForm(fromPage(result.page)); setState('saved'); setMessage('Your public page is updated.')
      window.setTimeout(() => setState('ready'), 2600)
    } catch (error) { setState('ready'); setMessage(error.message) }
  }
  async function uploadPhoto(imageData) {
    const response = await fetch(`/api/pages/edit/${token}/photo`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ imageData }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Your photo could not be uploaded.')
    setForm((current) => ({ ...current, photoUrl:result.photoUrl }))
    setMessage('Your profile photo is updated.')
  }
  async function removePhoto() {
    const response = await fetch(`/api/pages/edit/${token}/photo`, { method:'DELETE' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Your photo could not be removed.')
    setForm((current) => ({ ...current, photoUrl:'' }))
    setMessage('Your profile photo is removed.')
  }

  if (state === 'loading') return <main className="customer-editor-state"><b>tappy.</b><p>Opening your page editor...</p></main>
  if (state === 'error') return <main className="customer-editor-state"><b>tappy.</b><h1>Link unavailable.</h1><p>{message}</p><a href="mailto:hello@tappycard.tech">Contact Tappy</a></main>
  return <main className="customer-editor"><header><a href="/">tappy.</a>{publicId && <a href={`/p/${publicId}`} target="_blank" rel="noreferrer">View page <ArrowSquareOut size={17}/></a>}</header><div className="customer-editor-layout"><section><span>Private page editor</span><h1>Make it yours.</h1><p>Changes publish as soon as you save. Your private editing link should not be shared.</p></section><form onSubmit={save}>
    <div><label>Display name<input required maxLength="100" value={form.displayName} onChange={(e) => setForm({ ...form, displayName:e.target.value })}/></label><label>Role or headline<input maxLength="120" value={form.headline} onChange={(e) => setForm({ ...form, headline:e.target.value })}/></label></div>
    <label>Short introduction<textarea maxLength="360" value={form.bio} onChange={(e) => setForm({ ...form, bio:e.target.value })}/></label>
    <ProfileImageUpload value={form.photoUrl} onUpload={uploadPhoto} onRemove={removePhoto}/>
    <div><label>Public email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email:e.target.value })}/></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone:e.target.value })}/></label></div>
    <label>Location<input maxLength="140" value={form.location} onChange={(e) => setForm({ ...form, location:e.target.value })}/></label>
    <div><label>Accent<select value={form.accent} onChange={(e) => setForm({ ...form, accent:e.target.value })}><option value="forest">Tappy forest</option><option value="ink">Monochrome</option><option value="blue">Cobalt</option></select></label><label>Background<select value={form.backgroundTexture} onChange={(e) => setForm({ ...form, backgroundTexture:e.target.value })}><option value="clean">Clean white</option><option value="linen">Soft linen</option><option value="silver">Brushed silver</option><option value="forest-grain">Forest grain</option><option value="blueprint">Blueprint grid</option></select></label></div>
    <fieldset><legend>Public links</legend>{form.links.slice(0,8).map((link,index) => <div key={index}><select aria-label={`Link ${index + 1} type`} value={link.type} onChange={(e) => updateLink(index,'type',e.target.value)}>{types.map(([type,label]) => <option value={type} key={type}>{label}</option>)}</select><input aria-label={`Link ${index + 1} URL`} type="url" placeholder="https://" value={link.url} onChange={(e) => updateLink(index,'url',e.target.value)}/></div>)}</fieldset>
    <div className="customer-editor-submit"><button type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving...' : 'Save changes'}</button>{message && <p role="status" data-error={!message.startsWith('Your')}><CheckCircle size={17}/>{message}</p>}</div>
  </form></div></main>
}
