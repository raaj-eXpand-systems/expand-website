import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const policy = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  .headers[0].headers.find(({ key }) => key === 'Content-Security-Policy').value

if (!policy.includes("script-src 'self'") || !policy.includes("script-src-attr 'none'")) {
  throw new Error('expand.systems must allow only same-origin script files, explicit content hashes, and no event attributes')
}

const failures = []
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8')
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/gi)) {
    if (!/\btype=(['"])application\/ld\+json\1/i.test(match[1])) failures.push(`${file}: executable inline script`)
  }
  if (/\son[a-z]+=(['"])/i.test(html)) failures.push(`${file}: inline event handler`)
}

if (failures.length) throw new Error(`CSP-incompatible markup:\n${failures.join('\n')}`)
console.log('expand.systems contains no inline JavaScript or event handlers.')
