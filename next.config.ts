import type { NextConfig } from 'next'
import * as fs from 'node:fs'
import * as path from 'node:path'

const versionPath = path.join(process.cwd(), 'version.json')
let buildVersion = 'dev'
if (fs.existsSync(versionPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(versionPath, 'utf-8')) as { version?: string }
    if (data.version) buildVersion = data.version
  } catch (_) {}
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildVersion,
  },
}

export default nextConfig

