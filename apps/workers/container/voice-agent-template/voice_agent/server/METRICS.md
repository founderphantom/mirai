# Voice Agent Streaming Response Metrics

**Implementation Date:** 2025-10-15
**Purpose:** Better observability for production debugging

---

## Overview

The metrics tracker provides comprehensive monitoring of streaming voice interactions, tracking key performance indicators that are essential for debugging and optimizing the user experience in production.

## Key Metrics

### 1. Time to First Audio Chunk (TTFA)

**Definition:** Time from the start of an interaction until the first audio chunk is sent to the client.

**Importance:**
- Directly impacts perceived responsiveness
- Helps identify latency bottlenecks in the STT → LLM → TTS pipeline
- Target: < 1000ms for good UX

**What it measures:**
```
TTFA = First Audio Chunk Timestamp - Interaction Start Timestamp
```

**Tracked at:**
- `message_handler.ts:366-371` - First audio chunk recorded
- `metrics_tracker.ts:149-157` - TTFA calculation

### 2. Average Chunk Latency

**Definition:** Average time between consecutive audio chunks in a single interaction.

**Importance:**
- Indicates streaming efficiency
- Helps identify TTS generation bottlenecks
- Target: < 200ms for smooth playback

**What it measures:**
```
Chunk Latency = Current Chunk Timestamp - Previous Chunk Timestamp
Average = Sum of all chunk latencies / Number of chunks
```

**Tracked at:**
- `message_handler.ts:365-372` - Per-chunk latency recorded
- `metrics_tracker.ts:229-234` - Average calculation

### 3. STT Accuracy

**Definition:** Percentage of successful speech-to-text conversions.

**Importance:**
- Indicates microphone/audio quality issues
- Helps identify VAD calibration problems
- Target: > 95% success rate

**What it measures:**
```
STT Accuracy = (Successful STT Attempts / Total STT Attempts) × 100
```

**Tracked at:**
- `message_handler.ts:386-389` - STT success
- `message_handler.ts:397-399` - STT errors
- `metrics_tracker.ts:118-139` - Accuracy calculation

---

## Architecture

### Components

```
┌──────────────────────────────────────────────────────────┐
│ metrics_tracker.ts                                       │
│  • MetricsTracker (singleton)                            │
│  • InteractionMetrics (per interaction)                  │
│  • SessionMetrics (per session)                          │
└──────────────────────────────────────────────────────────┘
                        ↑
                        │ imports & uses
                        │
┌──────────────────────────────────────────────────────────┐
│ message_handler.ts                                       │
│  • Tracks interaction lifecycle                          │
│  • Records timing events                                 │
│  • Records STT success/failures                          │
└──────────────────────────────────────────────────────────┘
                        ↑
                        │ used by
                        │
┌──────────────────────────────────────────────────────────┐
│ index.multi-tenant.ts                                    │
│  • Initializes metrics tracker                           │
│  • Exposes metrics endpoints                             │
│  • Manages session lifecycle                             │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Session Start
   ├── WebSocket connects (index.multi-tenant.ts:174-241)
   ├── messageHandler.initSession(sessionKey) called (line 207)
   └── metricsTracker.initSession(sessionKey) (metrics_tracker.ts:58-67)

2. Interaction Start
   ├── User sends audio/text
   ├── createNewInteraction() called (message_handler.ts:90-105)
   └── metricsTracker.startInteraction() (metrics_tracker.ts:69-79)

3. Processing Pipeline
   ├── STT Start: recordSTTStart() (line 266)
   ├── LLM Start: recordLLMStart() (line 271)
   ├── First Audio Chunk: recordAudioChunk(0, ...) (line 365)
   │   └── TTFA calculated automatically
   ├── Subsequent Chunks: recordAudioChunk(n, ...) (line 365)
   │   └── Chunk latency calculated automatically
   ├── STT Complete: recordSTTComplete() (line 387)
   └── LLM Complete: recordLLMComplete() (line 388)

4. Interaction End
   ├── Response fully streamed
   ├── metricsTracker.endInteraction() (line 284)
   └── Session aggregates updated (metrics_tracker.ts:224-268)

5. Session End
   ├── WebSocket closes (index.multi-tenant.ts:227-240)
   └── metricsTracker.endSession() (line 231)
```

---

## API Endpoints

### 1. Aggregate Metrics

**Endpoint:** `GET /metrics`

**Description:** Returns combined pool and streaming metrics for all sessions.

**Response:**
```json
{
  "pool": {
    "totalCharacters": 5,
    "totalSessions": 23,
    "utilizationPercent": 23
  },
  "streaming": {
    "totalSessions": 23,
    "totalInteractions": 156,
    "avgTTFA": "842ms",
    "avgChunkLatency": "145ms",
    "avgInteractionDuration": "3250ms",
    "sttAccuracy": "97.3%"
  },
  "timestamp": "2025-10-15T10:30:00.000Z"
}
```

**Use Cases:**
- Production dashboard monitoring
- Performance trend analysis
- Capacity planning

### 2. Session-Specific Metrics

**Endpoint:** `GET /metrics/session/:sessionKey`

**Description:** Returns detailed metrics for a specific session.

**Example:** `GET /metrics/session/sess-abc-123`

**Response:**
```json
{
  "sessionKey": "sess-abc-123",
  "startTime": "2025-10-15T10:25:00.000Z",
  "endTime": "2025-10-15T10:30:00.000Z",
  "totalInteractions": 8,
  "successfulInteractions": 8,
  "failedInteractions": 0,
  "avgTTFA": "785ms",
  "avgChunkLatency": "132ms",
  "avgInteractionDuration": "2980ms",
  "sttAccuracy": "100.0%",
  "recentInteractions": [
    {
      "interactionId": "int-001",
      "ttfa": "820ms",
      "totalDuration": "3100ms",
      "audioChunks": 12,
      "sttSuccess": true,
      "sttText": "Hello, how can I help you today?"
    }
  ]
}
```

**Use Cases:**
- User-specific troubleshooting
- Session replay analysis
- Bug investigation

---

## Monitoring Best Practices

### 1. Production Dashboard

Monitor these key metrics in your dashboard:

```
Critical Metrics (Alert if threshold exceeded):
├── TTFA > 2000ms → High latency warning
├── Chunk Latency > 500ms → Streaming degradation
├── STT Accuracy < 90% → Audio quality issues
└── Failed Interactions > 10% → System health issues

Informational Metrics:
├── Total Sessions → Capacity planning
├── Total Interactions → Usage tracking
└── Average Interaction Duration → UX analysis
```

### 2. Alert Configuration

Recommended alert thresholds:

| Metric | Warning | Critical |
|--------|---------|----------|
| TTFA | > 1500ms | > 2500ms |
| Chunk Latency | > 300ms | > 600ms |
| STT Accuracy | < 95% | < 90% |
| Failed Interactions | > 5% | > 15% |

### 3. Log Analysis

The metrics tracker logs important events:

```bash
# Filter for TTFA measurements
grep "TTFA for" logs.txt

# Filter for metrics summaries
grep "[MetricsTracker]" logs.txt

# Filter for STT errors
grep "STT error" logs.txt
```

---

## Performance Impact

### Memory Usage

- **Per Session:** ~5KB (metadata + recent interactions)
- **Per Interaction:** ~2KB (timing data + audio chunk metrics)
- **Automatic Cleanup:** Every 30 minutes, keeps last 100 sessions

### CPU Impact

- **Negligible:** All operations are O(1) timestamp recordings
- **No blocking:** All metrics recorded synchronously in event handlers
- **No I/O:** All data stored in memory (no database writes)

### Network Impact

- **Zero:** Metrics are pull-based (HTTP endpoints)
- **No streaming overhead:** Metrics recorded locally

---

## Debugging Scenarios

### Scenario 1: High TTFA for specific users

**Symptoms:**
- User reports "slow responses"
- TTFA > 2000ms consistently

**Investigation Steps:**
```bash
# 1. Get session metrics
curl http://localhost:4000/metrics/session/sess-user-123

# 2. Check recent interactions
# Look at first interaction TTFA (may be higher due to cold start)

# 3. Check if issue is STT or LLM
# If sttEndTime - sttStartTime is high → STT issue
# If llmEndTime - llmStartTime is high → LLM issue
# If ttfa - llmEndTime is high → TTS issue
```

**Possible Causes:**
- Network latency to Inworld API
- Overloaded LLM provider
- Large system prompt (character config)

### Scenario 2: Inconsistent chunk latency

**Symptoms:**
- Audio playback stutters
- High variance in chunk latency

**Investigation Steps:**
```bash
# 1. Get aggregate metrics
curl http://localhost:4000/metrics

# 2. Check if issue is system-wide or user-specific
# If avgChunkLatency is high globally → system issue
# If specific to user → client issue

# 3. Check container utilization
# High utilization → need to scale
```

**Possible Causes:**
- Container CPU throttling
- TTS provider rate limiting
- Network congestion

### Scenario 3: Low STT accuracy

**Symptoms:**
- Character doesn't respond to user speech
- sttAccuracy < 95%

**Investigation Steps:**
```bash
# 1. Get session metrics
curl http://localhost:4000/metrics/session/sess-user-123

# 2. Check STT error messages in logs
grep "STT error.*sess-user-123" logs.txt

# 3. Check if VAD calibration completed
grep "VAD calibration complete.*sess-user-123" logs.txt
```

**Possible Causes:**
- Poor microphone quality
- Background noise
- VAD calibration skipped or failed
- Unsupported audio format

---

## Testing

### Unit Testing

```typescript
import { getMetricsTracker } from './components/metrics_tracker'

describe('MetricsTracker', () => {
  it('should calculate TTFA correctly', () => {
    const tracker = getMetricsTracker()
    tracker.initSession('test-session')
    tracker.startInteraction('test-session', 'test-interaction')

    // Simulate 500ms delay before first audio chunk
    setTimeout(() => {
      tracker.recordAudioChunk('test-interaction', 0, 100, 1600)
      const metrics = tracker.getInteractionMetrics('test-interaction')
      expect(metrics.ttfa).toBeGreaterThan(450)
      expect(metrics.ttfa).toBeLessThan(550)
    }, 500)
  })
})
```

### Integration Testing

```bash
# Start voice agent
npm run dev

# In another terminal, test metrics endpoint
curl http://localhost:4000/metrics

# Expected output includes streaming metrics
```

### Manual Testing

1. Start a voice session
2. Have a conversation (3-5 interactions)
3. Check metrics:
   ```bash
   curl http://localhost:4000/metrics | jq '.streaming'
   ```
4. Verify:
   - `totalInteractions` > 0
   - `avgTTFA` is reasonable (< 2000ms)
   - `sttAccuracy` is high (> 95%)

---

## Future Enhancements

### Potential Additions

1. **Percentile Metrics**
   - P50, P95, P99 for TTFA and chunk latency
   - Helps identify outliers vs median performance

2. **Database Persistence**
   - Store metrics in D1 database
   - Enable historical trend analysis
   - Support advanced queries

3. **Real-time Alerts**
   - WebSocket-based alerts for threshold violations
   - Integration with external monitoring tools (Datadog, Grafana)

4. **User Experience Score**
   - Composite metric combining TTFA, chunk latency, STT accuracy
   - Single number representing overall session quality

5. **Cost Tracking**
   - Track API costs per interaction (STT, LLM, TTS)
   - Enable usage-based billing accuracy

---

## Related Files

- `components/metrics_tracker.ts` - Core metrics implementation
- `components/message_handler.ts` - Metrics integration
- `index.multi-tenant.ts` - Metrics endpoints
- `constants.ts` - VAD and audio configuration constants

---

## Support

For questions or issues with metrics:
1. Check this documentation first
2. Review logs for `[MetricsTracker]` entries
3. Test with `/metrics` endpoint
4. Check Inworld docs for API-specific issues

---

**Last Updated:** 2025-10-15
**Maintained by:** Phantom Systems Inc
