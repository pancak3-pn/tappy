import { Briefcase, CalendarBlank, EnvelopeSimple, Globe, LinkedinLogo, MapPin } from '@phosphor-icons/react'
import { FcGoogle } from 'react-icons/fc'
import { SiFacebook, SiGooglemaps, SiInstagram } from 'react-icons/si'

const linkIcons = {
  website: Globe,
  instagram: SiInstagram,
  linkedin: LinkedinLogo,
  facebook: SiFacebook,
  maps: SiGooglemaps,
  reviews: FcGoogle,
  portfolio: Briefcase,
  booking: CalendarBlank,
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'TP'
}

function accentTextColor(color) {
  const value = /^#[0-9a-f]{6}$/i.test(color || '') ? color.slice(1) : '244a3a'
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255).map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .45 ? '#151515' : '#ffffff'
}

export default function ManagedProfileCard({ page, preview = false, footer = true }) {
  const displayName = page.display_name ?? page.displayName ?? ''
  const headline = page.headline || ''
  const bio = page.bio || ''
  const photoUrl = page.photo_url ?? page.photoUrl ?? ''
  const email = page.email || ''
  const phone = page.phone || ''
  const location = page.location || ''
  const accent = page.accent || 'forest'
  const accentColor = page.accent_color ?? page.accentColor ?? ({ forest:'#244a3a', ink:'#151515', blue:'#2757a5' }[accent] || '#244a3a')
  const background = page.background_texture ?? page.backgroundTexture ?? 'clean'
  const template = page.template || 'classic'
  const links = (page.links || []).filter((link) => link.url?.trim())

  const action = (href, label, children, className = '', props = {}) => {
    const { key, target, rel, ...sharedProps } = props
    return preview
      ? <span key={key} className={className} aria-label={label} {...sharedProps}>{children}</span>
      : <a key={key} className={className} href={href} aria-label={label} target={target} rel={rel} {...sharedProps}>{children}</a>
  }

  return <div className="managed-page-shell" style={{ '--page-accent':accentColor, '--page-accent-text':accentTextColor(accentColor) }} data-accent={accent} data-background={background} data-template={template} data-preview={preview ? 'true' : undefined}>
    <header><span className="managed-page-brand">tappy.</span></header>
    <section className="managed-page-profile">
      {photoUrl ? <img src={photoUrl} alt={preview ? '' : displayName} width="112" height="112"/> : <div className="managed-page-initials" aria-hidden="true">{initials(displayName)}</div>}
      <div><h1>{displayName || 'Your name'}</h1>{headline && <p className="managed-page-headline">{headline}</p>}{location && <p className="managed-page-location"><MapPin size={15} aria-hidden="true"/>{location}</p>}</div>
    </section>
    {bio && <p className="managed-page-bio">{bio}</p>}
    {(phone || email || links.length > 0) && <div className="managed-page-actions">
      {phone && action(`tel:${phone}`, `Call ${displayName}`, 'Call now', 'managed-page-call')}
      {(email || links.length > 0) && <div className="managed-page-icon-row" aria-label="Contact and public links">
        {email && action(`mailto:${email}`, `Email ${displayName}`, <EnvelopeSimple size={20}/>, '', { title:'Email', 'data-link-type':'email' })}
        {links.map((link, index) => { const Icon = linkIcons[link.type] || Globe; return action(link.url, link.label, <Icon size={20}/>, '', { key:`${link.url}-${index}`, title:link.label, 'data-link-type':link.type, target:'_blank', rel:'noreferrer' }) })}
      </div>}
    </div>}
    {footer && <footer><span>Powered by Tappy</span>{!preview && <a className="managed-page-order-cta" href="/order">Order Here</a>}</footer>}
  </div>
}
