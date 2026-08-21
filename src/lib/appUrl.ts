const LOCAL_APP_URL = 'http://localhost:3000'

type AppUrlSource = 'APP_URL' | 'NEXT_PUBLIC_APP_URL' | 'VERCEL_PROJECT_PRODUCTION_URL' | 'VERCEL_URL'

const isProductionEnvironment = () => process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.NODE_ENV === 'production'

const isLocalEnvironment = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

function normalizeConfiguredUrl(value: string, source: AppUrlSource) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = source === 'VERCEL_PROJECT_PRODUCTION_URL' || source === 'VERCEL_URL'
    ? trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`
    : trimmed

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`${source} must be a valid absolute URL.`)
  }

  if (url.username || url.password) {
    throw new Error(`${source} must not include credentials.`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${source} must include only an origin, not a path, query or fragment.`)
  }
  if (isProductionEnvironment() && url.protocol !== 'https:') {
    throw new Error(`${source} must use HTTPS in production.`)
  }

  return url.origin
}

function getConfiguredAppUrl() {
  const appUrl = process.env.APP_URL
  if (appUrl) return normalizeConfiguredUrl(appUrl, 'APP_URL')

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (publicAppUrl) return normalizeConfiguredUrl(publicAppUrl, 'NEXT_PUBLIC_APP_URL')

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProductionUrl) return normalizeConfiguredUrl(vercelProductionUrl, 'VERCEL_PROJECT_PRODUCTION_URL')

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl && !isProductionEnvironment()) return normalizeConfiguredUrl(vercelUrl, 'VERCEL_URL')

  return null
}

export function getAppBaseUrl() {
  const configuredUrl = getConfiguredAppUrl()
  if (configuredUrl) return configuredUrl

  if (isLocalEnvironment()) return LOCAL_APP_URL

  throw new Error('A canonical application URL is required in production. Set APP_URL to the production app origin.')
}

export function getAppUrl(path: string) {
  return new URL(path, getAppBaseUrl()).toString()
}
