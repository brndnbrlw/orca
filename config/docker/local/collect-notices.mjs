import {
  cpSync,
  globSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'

const output = resolve('out/container-notices')
mkdirSync(output, { recursive: true })
cpSync('LICENSE', join(output, 'Orca-LICENSE'))
cpSync('resources/licenses', join(output, 'upstream'), { recursive: true })
cpSync('config/docker/local/containers-common-LICENSE', join(output, 'containers-common-LICENSE'))
const seen = new Set()
const packages = []
for (const manifest of globSync([
  'node_modules/.pnpm/**/node_modules/*/package.json',
  'node_modules/.pnpm/**/node_modules/@*/*/package.json',
  'mobile/node_modules/.pnpm/**/node_modules/*/package.json',
  'mobile/node_modules/.pnpm/**/node_modules/@*/*/package.json'
])) {
  const root = realpathSync(resolve(manifest, '..'))
  if (seen.has(root)) {
    continue
  }
  seen.add(root)
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const directory = join(output, `${pkg.name.replaceAll('/', '__')}@${pkg.version}`)
  const files = readdirSync(root).filter((name) =>
    /^(?:licen[cs]e|notice|copying)(?:[.\-_]|$)/i.test(name)
  )
  if (files.length) {
    mkdirSync(directory, { recursive: true })
    for (const file of files) {
      cpSync(join(root, file), join(directory, file), { recursive: true })
    }
  }
  packages.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? 'See package notices',
    notices: files
  })
}
if (!packages.length) {
  throw new Error('No dependency notices found: expected a local pnpm virtual store')
}
writeFileSync(join(output, 'packages.json'), `${JSON.stringify(packages, null, 2)}\n`)
console.log(`Collected notices for ${packages.length} locked dependencies`)
