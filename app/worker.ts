import { onRequest as handleExchange } from './functions/api/oauth/exchange'
import { onRequest as handleRefresh } from './functions/api/oauth/refresh'
import { onRequest as handleLogout } from './functions/api/oauth/logout'
import { onRequest as handleGoogleAuth } from './functions/api/auth/google'
import { onRequest as handleAuthSession } from './functions/api/auth/session'
import { onRequest as handleAuthLogout } from './functions/api/auth/logout'
import { onRequest as handleFidoChallenge } from './functions/api/auth/fido/challenge'
import { onRequest as handleFidoEnroll } from './functions/api/auth/fido/enroll'
import { onRequest as handleFidoVerify } from './functions/api/auth/fido/verify'
import { onRequest as handleDecks } from './functions/api/decks'
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
  ['/api/auth/google', handleGoogleAuth],
  ['/api/auth/session', handleAuthSession],
  ['/api/auth/logout', handleAuthLogout],
  ['/api/auth/fido/challenge', handleFidoChallenge],
  ['/api/auth/fido/enroll', handleFidoEnroll],
  ['/api/auth/fido/verify', handleFidoVerify],
])

export default {
  /** Enruta endpoints OAuth en Cloudflare Workers y delega el resto a Static Assets. */
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)
    const handler = OAUTH_ROUTES.get(pathname)
    if (handler) {
      return await handler({ request, env })
    }

    if (pathname === '/api/decks' || pathname.startsWith('/api/decks/')) {
      return await handleDecks({ request, env })
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
