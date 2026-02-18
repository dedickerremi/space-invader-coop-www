/**
 * Generates a build version: date/time of build + random checksum.
 * Writes version.json (current) and appends to version-history.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const versionPath = path.join(root, 'version.json')
const historyPath = path.join(root, 'version-history.json')

const now = new Date()
const date = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
const time = now.toTimeString().slice(0, 8).replace(/:/g, '')   // HHmmss
const checksum = crypto.randomBytes(3).toString('hex')          // 6 hex chars
const version = `${date}-${time}-${checksum}`

const versionPayload = { version }
fs.writeFileSync(versionPath, JSON.stringify(versionPayload, null, 2) + '\n', 'utf-8')

const entry = { version, generatedAt: now.toISOString() }
let history = []
if (fs.existsSync(historyPath)) {
  try {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
  } catch (_) {}
}
if (!Array.isArray(history)) history = []
history.unshift(entry)
// Keep last 500 entries
if (history.length > 500) history = history.slice(0, 500)
fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n', 'utf-8')

console.log('[build-version]', version)
