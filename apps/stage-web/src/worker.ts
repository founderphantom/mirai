/**
 * Cloudflare Worker for Mirai Stage Web (Vue SPA)
 * Handles static asset serving, SPA routing, custom headers, redirects, and API proxying
 */

interface Env {
  ASSETS: Fetcher
  PUBLIC_ASSETS: R2Bucket
  API_GATEWAY: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Proxy API requests to API Gateway using service binding
    if (pathname.startsWith('/api/')) {
      return env.API_GATEWAY.fetch(request)
    }

    // List of large assets stored in R2
    const r2AssetPaths = [
      '/assets/cjkFonts_allseto_v1.11-ByBdljxl.ttf',
      '/assets/XiaolaiSC-Regular-SNWuh554.ttf',
      '/assets/duckdb-coi-CSr8FQO4.wasm',
      '/assets/duckdb-eh-BJOC5S4x.wasm',
      '/assets/duckdb-mvp-8HYqhb4i.wasm',
      '/assets/ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm',
      '/assets/live2d/models/hiyori_pro_zh.zip',
      '/assets/live2d/models/hiyori_free_zh.zip',
      '/assets/live2d/models/blackwolf.zip',
      '/assets/live2d/models/blackwolf/preview.png',
      '/assets/vrm/models/AvatarSample-A/AvatarSample_A.vrm',
      '/assets/vrm/models/AvatarSample-B/AvatarSample_B.vrm',
    ]

    // Check if this is a large asset request - serve from R2
    if (r2AssetPaths.includes(pathname)) {
      const r2Key = pathname.slice(1) // Remove leading slash
      const object = await env.PUBLIC_ASSETS.get(r2Key)

      if (object === null) {
        return new Response('Asset not found', { status: 404 })
      }

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('etag', object.httpEtag)
      headers.set('Cache-Control', 'max-age=31536000, immutable')
      headers.set('Access-Control-Allow-Origin', '*')

      return new Response(object.body, { headers })
    }

    // Handle i18n redirects based on Accept-Language header
    if (pathname.startsWith('/docs/')) {
      const acceptLanguage = request.headers.get('Accept-Language') || ''

      if (acceptLanguage.includes('zh-Hans') || acceptLanguage.includes('zh-CN')) {
        // Redirect to Chinese docs
        const newPath = pathname.replace('/docs/', '/docs/zh-Hans/')
        return Response.redirect(new URL(newPath, url.origin).toString(), 301)
      } else {
        // Redirect to English docs
        const newPath = pathname.replace('/docs/', '/docs/en/')
        return Response.redirect(new URL(newPath, url.origin).toString(), 301)
      }
    }

    // Try to fetch the asset from the static assets binding
    let response = await env.ASSETS.fetch(request)

    // SPA fallback: If asset not found, serve index.html for client-side routing
    if (response.status === 404) {
      // Don't serve index.html for API routes or remote assets
      if (pathname.startsWith('/api/') || pathname.startsWith('/remote-assets/')) {
        return response
      }

      // Serve index.html for all other routes (SPA routing)
      const indexRequest = new Request(new URL('/index.html', url.origin), request)
      response = await env.ASSETS.fetch(indexRequest)
    }

    // Clone response so we can modify headers
    response = new Response(response.body, response)

    // Add custom headers for assets (caching)
    if (pathname.startsWith('/assets/')) {
      response.headers.set('Cache-Control', 'max-age=31536000, immutable')
    }

    // Add CORS headers for cross-origin requests
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
  },
}
