import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const pages = new Map([
  ['index.html', 'https://www.expand.systems/'],
  ['services.html', 'https://www.expand.systems/services.html'],
  ['products.html', 'https://www.expand.systems/products.html'],
  ['about.html', 'https://www.expand.systems/about.html'],
  ['contact.html', 'https://www.expand.systems/contact.html'],
  ['privacy.html', 'https://www.expand.systems/privacy.html'],
])
const failures = []

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasMeta = (html, attribute, value) => new RegExp(`<meta\\s+${attribute}=["']${escapeRegex(value)}["']\\s+content=["'][^"']+["']\\s*/?>`, 'i').test(html)

for (const [file, canonical] of pages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8')
  if (!html.includes(`<link rel="canonical" href="${canonical}" />`)) failures.push(`${file}: canonical URL`)
  for (const name of ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!hasMeta(html, 'name', name)) failures.push(`${file}: meta name=${name}`)
  }
  for (const property of ['og:type', 'og:url', 'og:title', 'og:description', 'og:image']) {
    if (!hasMeta(html, 'property', property)) failures.push(`${file}: meta property=${property}`)
  }
  if (/<img\b(?![^>]*\balt=(['"])[^'"]*\1)[^>]*>/i.test(html)) failures.push(`${file}: image without alt text`)
  if (/<button\b(?![^>]*\btype=(['"])[^'"]+\1)[^>]*>/i.test(html)) failures.push(`${file}: button without explicit type`)
  for (const match of html.matchAll(/<(?:a|link|script|img)\b[^>]*\b(?:href|src)=(['"])([^'"]+)\1[^>]*>/gi)) {
    const target = match[2]
    if (/^(?:https?:|mailto:|tel:|#)/i.test(target)) continue
    const localPath = target.split(/[?#]/)[0]
    if (localPath && !fs.existsSync(path.join(root, localPath))) failures.push(`${file}: missing local target ${target}`)
  }
  for (const match of html.matchAll(/<a\b([^>]*)\btarget=(['"])_blank\2([^>]*)>/gi)) {
    if (!/\brel=(['"])[^'"]*\bnoopener\b[^'"]*\bnoreferrer\b[^'"]*\1/i.test(`${match[1]} ${match[3]}`)) {
      failures.push(`${file}: external new-tab link without noopener noreferrer`)
    }
  }
}

const publicSource = [...pages.keys(), 'style.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
if (/\b(?:public\s+)?beta\b|coming\s+soon/i.test(publicSource)) failures.push('Public source contains beta or coming-soon positioning')
if (/Princeton(?:\s+Junction)?/i.test(publicSource)) failures.push('Public source contains a prohibited municipality')
if (/\bDelaware\b/i.test(publicSource)) failures.push('Public source contains an obsolete Delaware reference')
if (/Amazon\s+Glacier|\bcold[-\s]storage\b/i.test(publicSource)) failures.push('Public source contains an inactive deep-storage claim')
if (/instant(?:ly)?\s+(?:permanent\s+)?delet|delete(?:d|s)?\s+instant(?:ly)?/i.test(publicSource)) failures.push('Public source contains an unsupported instant-deletion claim')
if (/https:\/\/www\.getnarratrace\.com/i.test(publicSource)) failures.push('Narratrace link is not canonical')

for (const file of pages.keys()) {
  const html = fs.readFileSync(path.join(root, file), 'utf8')
  if (!html.includes('© 2026 Expand Systems LLC. All rights reserved.')) failures.push(`${file}: exact legal entity copyright`)
}

const products = fs.readFileSync(path.join(root, 'products.html'), 'utf8')
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'style.css'), 'utf8')
const sunsetAssets = [640, 1200, 1920].flatMap(width => ['jpg', 'webp'].map(extension => `images/mount-rundle-vermilion-lakes-sunset-${width}.${extension}`))
for (const asset of sunsetAssets) {
  if (!fs.existsSync(path.join(root, asset))) failures.push(`responsive Narratrace image asset ${asset}`)
}
if (fs.existsSync(path.join(root, 'images/narratrace-family-memory.png'))) failures.push('obsolete Narratrace wedding image asset')
for (const [file, html] of [['index.html', home], ['products.html', products]]) {
  if (!html.includes('href="https://getnarratrace.com/"')) failures.push(`${file}: canonical Narratrace call to action`)
  if (!html.includes('Available worldwide')) failures.push(`${file}: global production availability status`)
  if (!html.includes('mount-rundle-vermilion-lakes-sunset-640.webp')) failures.push(`${file}: responsive Mount Rundle sunset image`)
  if (!html.includes('Sunset at Vermilion Lakes')) failures.push(`${file}: approved Vermilion Lakes sunset context`)
  if (/family wedding|Chicago|Margaret|Harold|1967|sunrise|first light/i.test(html)) failures.push(`${file}: obsolete Narratrace example context`)
}
for (const route of ['privacy', 'terms', 'cookies']) {
  if (!products.includes(`href="https://getnarratrace.com/${route}"`)) failures.push(`products.html: canonical Narratrace ${route} link`)
}
if (!products.includes('Google Photos Picker lets you import only the photos and videos you deliberately select.')) {
  failures.push('products.html: accurate Google Photos Picker scope')
}
if (!products.includes('Narratrace does not currently connect to YouTube or Amazon Photos.')) {
  failures.push('products.html: current consumer-media integration scope')
}
if (!products.includes('Send memories now or later through recipient review and revocable, expiring access links.')) {
  failures.push('products.html: verified recipient delivery safeguards')
}
for (const context of ['Mount Rundle', 'Vermilion Lakes', 'Banff', 'Sunset', 'Family trip', 'Letter to our family', 'June 29, 2030 at 9:30 PM']) {
  if (!products.includes(context)) failures.push(`products.html: Narratrace example context ${context}`)
}
for (const selector of ['.narratrace-preview-visual picture img', '.product-photo-frame img']) {
  const ruleStart = styles.indexOf(`${selector} {`)
  const ruleEnd = ruleStart === -1 ? -1 : styles.indexOf('}', ruleStart)
  const rule = ruleEnd === -1 ? '' : styles.slice(ruleStart, ruleEnd)
  if (!/height:\s*auto/.test(rule) || /object-fit:\s*cover/.test(rule)) {
    failures.push(`style.css: full responsive Narratrace image for ${selector}`)
  }
}

const jsonLdMatch = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
if (!jsonLdMatch) {
  failures.push('index.html: Organization and WebSite JSON-LD')
} else {
  try {
    const data = JSON.parse(jsonLdMatch[1])
    const graph = data['@graph'] ?? []
    const organization = graph.find(item => item['@type'] === 'Organization')
    const website = graph.find(item => item['@type'] === 'WebSite')
    if (organization?.name !== 'Expand Systems LLC') failures.push('JSON-LD: verified legal organization name')
    if (organization?.alternateName !== 'eXpand Systems') failures.push('JSON-LD: public brand name')
    if (organization?.url !== 'https://www.expand.systems/') failures.push('JSON-LD: organization canonical URL')
    if (organization?.location?.name !== 'NJ, USA') failures.push('JSON-LD: approved customer-visible location')
    if (website?.publisher?.['@id'] !== organization?.['@id']) failures.push('JSON-LD: WebSite publisher relationship')
  } catch {
    failures.push('index.html: invalid JSON-LD')
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')
for (const canonical of pages.values()) {
  const entry = new RegExp(`<url><loc>${escapeRegex(canonical)}</loc><lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod></url>`)
  if (!entry.test(sitemap)) failures.push(`sitemap.xml: fresh entry for ${canonical}`)
}

const policy = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const csp = policy.headers[0].headers.find(({ key }) => key === 'Content-Security-Policy').value
if (jsonLdMatch) {
  const hash = crypto.createHash('sha256').update(jsonLdMatch[1]).digest('base64')
  if (!csp.includes(`'sha256-${hash}'`)) failures.push('vercel.json: CSP hash for Organization/WebSite JSON-LD')
}

const expectedRedirects = new Map([
  ['/services-5', '/services.html'],
  ['/about-1', '/about.html'],
  ['/about-1-1', '/about.html'],
])
for (const [source, destination] of expectedRedirects) {
  const redirect = policy.redirects?.find(item => item.source === source)
  if (redirect?.destination !== destination || redirect?.permanent !== true) {
    failures.push(`vercel.json: permanent legacy redirect ${source} -> ${destination}`)
  }
}

if (failures.length) throw new Error(`SEO verification failed:\n${failures.join('\n')}`)
console.log(`Verified production positioning, metadata, structured data, accessibility basics, location, and sitemap for ${pages.size} pages.`)
