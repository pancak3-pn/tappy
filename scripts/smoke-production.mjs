const baseUrl = (process.env.SMOKE_BASE_URL || 'https://www.tappycard.tech').replace(/\/$/, '')

const checks = [
  ['API health', '/api/health', 200],
  ['Public feedback wall', '/api/feedback/public', 200],
  ['Unknown NFC link', '/api/nfc/does-not-exist', 404],
]

let failed = 0
for (const [name, path, expected] of checks) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers:{ accept:'application/json' } })
    if (response.status !== expected) throw new Error(`expected ${expected}, received ${response.status}`)
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}: ${error.message}`)
  }
}

if (failed) {
  console.error(`${failed} smoke check${failed === 1 ? '' : 's'} failed.`)
  process.exitCode = 1
} else {
  console.log(`All ${checks.length} production smoke checks passed.`)
}
