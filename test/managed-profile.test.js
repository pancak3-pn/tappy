import test from 'node:test'
import assert from 'node:assert/strict'
import { managedProfilePayload, PROFILE_ACCENTS, PROFILE_BACKGROUNDS, PROFILE_TEMPLATES } from '../shared/managed-profile.js'

test('managed profile payload preserves every design setting', () => {
  for (const template of PROFILE_TEMPLATES) {
    for (const accent of PROFILE_ACCENTS) {
      for (const background_texture of PROFILE_BACKGROUNDS) {
        const page = managedProfilePayload({ public_id:'profile-id', template, accent, background_texture, links:[] })
        assert.equal(page.template, template)
        assert.equal(page.accent, accent)
        assert.equal(page.background_texture, background_texture)
      }
    }
  }
})

test('managed profile payload applies professional defaults to invalid configuration', () => {
  const page = managedProfilePayload({ template:'freeform', accent:'neon', background_texture:'animated', links:null })
  assert.equal(page.template, 'classic')
  assert.equal(page.accent, 'forest')
  assert.equal(page.background_texture, 'clean')
  assert.deepEqual(page.links, [])
  assert.equal(page.accent_color, '#244a3a')
})

test('managed profile payload preserves a valid custom button color', () => {
  assert.equal(managedProfilePayload({ accent_color:'#E85D3F' }).accent_color, '#e85d3f')
})
