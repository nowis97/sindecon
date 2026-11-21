import { onRequest as handleExchange } from './functions/api/oauth/exchange'
import { onRequest as handleRefresh } from './functions/api/oauth/refresh'
import { onRequest as handleLogout } from './functions/api/oauth/logout'
import { jsonResponse, type CfPagesContext, type OAuthEnv } from './functions/api/oauth/_shared'

export interface WorkerEnv extends OAuthEnv {
  ASSETS?: {
    fetch(request: Request | string): Promise<Response>
  }
}

type RouteHandler = (context: CfPagesContext) => Promise<Response>

const OAUTH_ROUTES = new Map<string, RouteHandler>([
  ['/api/oauth/exchange', handleExchange],
  ['/api/oauth/refresh', handleRefresh],
  ['/api/oauth/logout', handleLogout],
])

export default {
  /** Enruta endpoints OAuth en Cloudflare Workers y delega el resto a Static Assets. */
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)
    const handler = OAUTH_ROUTES.get(pathname)
    if (handler) {
      return await handler({ request, env })
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'not_found' }, 404)
    }

    if (env.ASSETS) {
      return await env.ASSETS.fetch(request)
    }

    return new Response('Not Found', { status: 404 })
  },
}
