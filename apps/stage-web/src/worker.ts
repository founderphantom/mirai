/**
 * Cloudflare Worker for Mirai Stage Web (Vue SPA)
 * Handles static asset serving, SPA routing, custom headers, redirects, and API proxying
 */

import { AudioStreamService, type VoiceSessionData } from './audio-stream'

interface Env {
  ASSETS: Fetcher
  PUBLIC_ASSETS: R2Bucket
  API_GATEWAY: Fetcher
  VOICE_AGENT: Fetcher
  AI: Ai // Workers AI binding for VAD and STT
  SESSION_CACHE: KVNamespace // KV cache for session management
  VITE_ENVIRONMENT?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Handle direct Flux STT WebSocket connection
    // This returns the Workers AI WebSocket response directly to the client
    // Client connects to this endpoint for real-time speech-to-text
    if (pathname === '/flux-stt') {
      try {
        // 1. Get and validate session key
        const sessionKey = url.searchParams.get('sessionKey')

        if (!sessionKey) {
          console.error('[FLUX_STT] Missing session key')
          return new Response('Missing session key', { status: 400 })
        }

        // 2. Validate session from KV cache
        const sessionData = await env.SESSION_CACHE.get<VoiceSessionData>(
          `session:${sessionKey}`,
          { type: 'json' },
        )

        if (!sessionData) {
          console.error('[FLUX_STT] Invalid or expired session:', sessionKey)
          return new Response('Invalid or expired session', { status: 401 })
        }

        // 3. Check expiration
        if (Date.now() > sessionData.expiresAt) {
          console.error('[FLUX_STT] Session expired:', sessionKey)
          await env.SESSION_CACHE.delete(`session:${sessionKey}`)
          return new Response('Session expired', { status: 401 })
        }

        // 4. Check if WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade')
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 })
        }

        console.log('[FLUX_STT] Initializing direct Flux WebSocket connection:', {
          sessionKey,
          userId: sessionData.userId,
          characterId: sessionData.characterId,
        })

        // 5. Create WebSocket pair for proxying client <-> Flux
        const pair = new WebSocketPair()
        const [client, server] = Object.values(pair)

        // Accept the server side
        server.accept()

        // 6. Create Flux WebSocket connection
        const fluxResponse = await env.AI.run(
          '@cf/deepgram/flux',
          {
            encoding: 'linear16', // 16-bit PCM
            sample_rate: '16000', // 16kHz
          },
          {
            websocket: true,
          },
        )

        // 7. Extract and accept the Flux WebSocket
        const fluxWs = fluxResponse.webSocket
        if (!fluxWs) {
          console.error('[FLUX_STT] No WebSocket in Flux response')
          return new Response('Failed to get Flux WebSocket', { status: 500 })
        }

        fluxWs.accept()
        console.log('[FLUX_STT] Flux WebSocket accepted')

        // 8. Proxy messages: Client → Flux (audio data)
        server.addEventListener('message', (event) => {
          try {
            if (event.data instanceof ArrayBuffer) {
              // Forward audio data to Flux
              fluxWs.send(event.data)
            }
          } catch (error) {
            console.error('[FLUX_STT] Error forwarding to Flux:', error)
          }
        })

        // 9. Proxy messages: Flux → Client (transcription events)
        fluxWs.addEventListener('message', (event) => {
          try {
            // Forward Flux events to client
            server.send(event.data)
          } catch (error) {
            console.error('[FLUX_STT] Error forwarding from Flux:', error)
          }
        })

        // 10. Handle connection errors
        server.addEventListener('close', (event) => {
          console.log('[FLUX_STT] Client WebSocket closed:', { code: event.code, reason: event.reason })
          try {
            fluxWs.close(1000, 'Client disconnected')
          } catch (error) {
            console.error('[FLUX_STT] Error closing Flux WebSocket:', error)
          }
        })

        fluxWs.addEventListener('close', (event) => {
          console.log('[FLUX_STT] Flux WebSocket closed:', { code: event.code, reason: event.reason })
          try {
            server.close(1000, 'Flux disconnected')
          } catch (error) {
            console.error('[FLUX_STT] Error closing client WebSocket:', error)
          }
        })

        server.addEventListener('error', (error) => {
          console.error('[FLUX_STT] Client WebSocket error:', error)
        })

        fluxWs.addEventListener('error', (error) => {
          console.error('[FLUX_STT] Flux WebSocket error:', error)
        })

        console.log('[FLUX_STT] WebSocket proxy established, returning to client')

        // 11. Return WebSocket upgrade response with client side of pair
        return new Response(null, {
          status: 101,
          webSocket: client,
        })
      } catch (error) {
        console.error('[FLUX_STT] Failed to create Flux WebSocket:', error)
        return new Response('Failed to establish Flux WebSocket connection', { status: 500 })
      }
    }

    // Handle audio streaming with Workers AI (VAD + STT)
    // This processes audio at the edge for minimal latency and real-time subtitles
    if (pathname === '/audio-stream') {
      try {
        // 1. Get and validate session key
        const sessionKey = url.searchParams.get('sessionKey')

        if (!sessionKey) {
          console.error('[AUDIO_STREAM] Missing session key')
          return new Response('Missing session key', { status: 400 })
        }

        // 2. Validate session from KV cache
        const sessionData = await env.SESSION_CACHE.get<VoiceSessionData>(
          `session:${sessionKey}`,
          { type: 'json' },
        )

        if (!sessionData) {
          console.error('[AUDIO_STREAM] Invalid or expired session:', sessionKey)
          return new Response('Invalid or expired session', { status: 401 })
        }

        // 3. Check expiration
        if (Date.now() > sessionData.expiresAt) {
          console.error('[AUDIO_STREAM] Session expired:', sessionKey)
          await env.SESSION_CACHE.delete(`session:${sessionKey}`)
          return new Response('Session expired', { status: 401 })
        }

        // 4. Check if WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade')
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected WebSocket upgrade', { status: 426 })
        }

        console.log('[AUDIO_STREAM] WebSocket connection initiated:', {
          sessionKey,
          userId: sessionData.userId,
          characterId: sessionData.characterId,
        })

        // 5. Create WebSocket pair
        const pair = new WebSocketPair()
        const [client, server] = Object.values(pair)

        // 6. Accept WebSocket connection
        server.accept()

        // 7. Set up audio streaming service for VAD
        const audioService = new AudioStreamService(
          { AI: env.AI, SESSION_CACHE: env.SESSION_CACHE, VOICE_AGENT: env.VOICE_AGENT },
          {
            sessionKey,
            userId: sessionData.userId,
            characterId: sessionData.characterId,
          },
        )

        // 8. Set callback for handling transcriptions from client
        // Client connects directly to /flux-stt and forwards final transcriptions here
        audioService.setTranscriptionCallback(async (text) => {
          console.log('[AUDIO_STREAM] Received transcription from client, sending to voice agent:', text)

          // Send to voice agent
          const success = await audioService.sendToVoiceAgent(text)

          if (!success) {
            server.send(
              JSON.stringify({
                type: 'error',
                message: 'Failed to send transcription to voice agent',
                timestamp: Date.now(),
              }),
            )
          }
        })

        console.log('[AUDIO_STREAM] Audio stream initialized for VAD')

        // 9. Handle WebSocket messages
        server.addEventListener('message', async (event) => {
          try {
            // Handle binary audio data
            if (event.data instanceof ArrayBuffer) {
              const audioData = new Uint8Array(event.data)

              // Process audio chunk (streams to Flux + runs VAD for UI feedback)
              const result = await audioService.processAudioChunk(audioData)

              // Send VAD status for UI feedback (speech detection indicator)
              if (result.vadResult) {
                server.send(
                  JSON.stringify({
                    type: 'vad',
                    is_complete: result.vadResult.is_complete,
                    probability: result.vadResult.probability,
                    timestamp: Date.now(),
                  }),
                )
              }

              // Note: Transcriptions now come from client's direct Flux connection
              // Client handles Flux events and forwards final transcriptions here via text message
            }
            // Handle text messages (control messages, ping, transcriptions, etc.)
            else if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data)

                // Handle ping
                if (message.type === 'ping') {
                  server.send(
                    JSON.stringify({
                      type: 'pong',
                      timestamp: Date.now(),
                    }),
                  )
                }
                // Handle transcription from client (forwarded from Flux)
                else if (message.type === 'transcription') {
                  console.log('[AUDIO_STREAM] Received transcription from client:', message.text)
                  await audioService.handleTranscriptionFromClient(message.text)
                }
                // Handle debug/status requests
                else if (message.type === 'status') {
                  server.send(
                    JSON.stringify({
                      type: 'status',
                      state: audioService.getState(),
                      timestamp: Date.now(),
                    }),
                  )
                }
              } catch (error) {
                console.error('[AUDIO_STREAM] Invalid text message:', error)
              }
            }
          } catch (error) {
            console.error('[AUDIO_STREAM] Message processing error:', error)
            server.send(
              JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
              }),
            )
          }
        })

        // 10. Handle WebSocket close
        server.addEventListener('close', () => {
          console.log('[AUDIO_STREAM] WebSocket closed:', {
            sessionKey,
            userId: sessionData.userId,
          })
          // Clean up Flux WebSocket connection
          audioService.cleanup()
        })

        // 11. Handle WebSocket errors
        server.addEventListener('error', (error) => {
          console.error('[AUDIO_STREAM] WebSocket error:', {
            sessionKey,
            error,
          })
          // Clean up on error
          audioService.cleanup()
        })

        // 12. Return WebSocket upgrade response
        return new Response(null, {
          status: 101,
          webSocket: client,
        })
      } catch (error) {
        console.error('[AUDIO_STREAM] WebSocket setup error:', error)
        return new Response('Failed to establish WebSocket connection', { status: 500 })
      }
    }

    // Proxy API requests to API Gateway using service binding
    // Uses internal Cloudflare routing (~0.5-2ms latency vs 5-10ms for HTTPS)
    if (pathname.startsWith('/api/')) {
      console.log('[stage-web] Proxying API request to API Gateway:', pathname)
      return env.API_GATEWAY.fetch(request)
    }

    // Proxy WebSocket requests to Voice Agent using service binding
    // Uses internal Cloudflare routing (~0.5-2ms latency vs 5-10ms for WebSocket)
    // This provides the lowest possible latency for real-time voice streaming
    if (pathname === '/ws') {
      console.log('[stage-web] Proxying WebSocket to Voice Agent')
      return env.VOICE_AGENT.fetch(request)
    }

    // Specific large assets stored in R2 (fonts, WASM binaries)
    const specificR2Assets = [
      '/assets/cjkFonts_allseto_v1.11-ByBdljxl.ttf',
      '/assets/XiaolaiSC-Regular-SNWuh554.ttf',
      '/assets/duckdb-coi-CSr8FQO4.wasm',
      '/assets/duckdb-eh-BJOC5S4x.wasm',
      '/assets/duckdb-mvp-8HYqhb4i.wasm',
      '/assets/ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm',
    ]

    // Check if this should be served from R2
    // - Specific assets (fonts, WASM) - hardcoded list
    // - All Live2D models - pattern matching
    // - All VRM models - pattern matching
    const shouldServeFromR2 =
      specificR2Assets.includes(pathname) ||
      pathname.startsWith('/assets/live2d/models/') ||
      pathname.startsWith('/assets/vrm/models/')

    if (shouldServeFromR2) {
      const r2Key = pathname.slice(1) // Remove leading slash
      const object = await env.PUBLIC_ASSETS.get(r2Key)

      if (object === null) {
        console.log(`[stage-web] Asset not found in R2: ${r2Key}`)
        return new Response('Asset not found', { status: 404 })
      }

      console.log(`[stage-web] Serving from R2: ${r2Key} (${object.size} bytes)`)

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
