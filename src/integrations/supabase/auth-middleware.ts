// Server-side authentication for every protected server function.
// Keep this middleware in src/start.ts as the global function middleware.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest, setResponseHeader, setResponseStatus } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

function unauthorized(): never {
  setResponseStatus(401, 'Unauthorized')
  setResponseHeader('WWW-Authenticate', 'Bearer')
  throw new Error('Unauthorized')
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    )
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization')
    }
    headers.set('apikey', supabaseKey)
    return fetch(input, { ...init, headers })
  }
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['SUPABASE_URL']
    const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY']

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
      ]
      const message = `Missing Supabase environment variable(s): ${missing.join(', ')}.`
      console.error(`[Supabase] ${message}`)
      throw new Error(message)
    }

    const request = getRequest()
    if (!request?.headers) unauthorized()

    const authHeader = request.headers.get('authorization')
    const match = authHeader ? /^Bearer\s+([^\s]+)$/i.exec(authHeader.trim()) : null
    const token = match?.[1]
    if (!token || token.split('.').length !== 3) unauthorized()

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    // getClaims verifies the JWT signature and claims with Supabase Auth/JWKS.
    const { data, error } = await supabase.auth.getClaims(token)
    if (error || !data?.claims?.sub) unauthorized()

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    })
  },
)
