export const PROFILE_TEMPLATES = Object.freeze(['classic', 'split', 'compact'])
export const PROFILE_ACCENTS = Object.freeze(['forest', 'ink', 'blue'])
export const PROFILE_BACKGROUNDS = Object.freeze(['clean', 'linen', 'silver', 'forest-grain', 'blueprint', 'minimal-gradient', 'geometric-flow', 'soft-waves', 'tech-circuit', 'dark-texture'])
export const PROFILE_ACCENT_COLORS = Object.freeze({ forest:'#244a3a', ink:'#151515', blue:'#2757a5' })

export function normalizeAccentColor(value, preset = 'forest') {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : PROFILE_ACCENT_COLORS[preset] || PROFILE_ACCENT_COLORS.forest
}

export function managedProfilePayload(page = {}) {
  return {
    public_id:page.public_id,
    display_name:page.display_name,
    headline:page.headline,
    bio:page.bio,
    photo_url:page.photo_url,
    email:page.email,
    phone:page.phone,
    location:page.location,
    accent:PROFILE_ACCENTS.includes(page.accent) ? page.accent : 'forest',
    accent_color:normalizeAccentColor(page.accent_color, page.accent),
    background_texture:PROFILE_BACKGROUNDS.includes(page.background_texture) ? page.background_texture : 'clean',
    template:PROFILE_TEMPLATES.includes(page.template) ? page.template : 'classic',
    links:Array.isArray(page.links) ? page.links : [],
    updated_at:page.updated_at,
  }
}
