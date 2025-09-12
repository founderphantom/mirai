/**
 * Performance monitoring utilities for mobile optimization
 * Tracks Core Web Vitals and custom performance metrics
 */

import type { Metric } from 'web-vitals'

interface PerformanceData {
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
  tti?: number // Time to Interactive
  customMetrics: Map<string, number>
}

class PerformanceMonitor {
  private data: PerformanceData = {
    customMetrics: new Map(),
  }
  
  private observers: Map<string, PerformanceObserver> = new Map()
  private startTime = performance.now()
  private isProduction = import.meta.env.PROD
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebVitals()
      this.initCustomObservers()
    }
  }
  
  /**
   * Initialize Web Vitals monitoring
   */
  private async initWebVitals() {
    if (!('PerformanceObserver' in window)) return
    
    try {
      const { onCLS, onFCP, onFID, onLCP, onTTFB } = await import('web-vitals')
      
      onFCP(this.handleMetric.bind(this, 'fcp'))
      onLCP(this.handleMetric.bind(this, 'lcp'))
      onFID(this.handleMetric.bind(this, 'fid'))
      onCLS(this.handleMetric.bind(this, 'cls'))
      onTTFB(this.handleMetric.bind(this, 'ttfb'))
      
      // Calculate TTI
      if ('PerformanceObserver' in window) {
        this.measureTTI()
      }
    } catch (error) {
      console.warn('Failed to initialize Web Vitals:', error)
    }
  }
  
  /**
   * Initialize custom performance observers
   */
  private initCustomObservers() {
    // Long Task Observer for detecting blocking tasks
    if ('PerformanceLongTaskTiming' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!this.isProduction) {
            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`)
          }
          this.track('long-task', entry.duration)
        }
      })
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.set('longtask', longTaskObserver)
      } catch (e) {
        // Silent fail for unsupported browsers
      }
    }
    
    // Layout Shift Observer
    if ('LayoutShift' in window) {
      let clsValue = 0
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
            this.data.cls = clsValue
          }
        }
      })
      
      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('layout-shift', layoutShiftObserver)
      } catch (e) {
        // Silent fail for unsupported browsers
      }
    }
  }
  
  /**
   * Measure Time to Interactive
   */
  private measureTTI() {
    // Use a simplified TTI measurement
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      
      if (lastEntry) {
        const tti = lastEntry.startTime + lastEntry.duration
        this.data.tti = tti
        
        if (!this.isProduction) {
          console.log(`📊 TTI: ${tti.toFixed(2)}ms`)
        }
      }
    })
    
    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] })
      this.observers.set('tti', observer)
    } catch (e) {
      // Silent fail
    }
  }
  
  /**
   * Handle Web Vitals metrics
   */
  private handleMetric(name: string, metric: Metric) {
    this.data[name as keyof PerformanceData] = metric.value
    
    if (!this.isProduction) {
      const emoji = this.getMetricEmoji(name, metric.value)
      console.log(`${emoji} ${name.toUpperCase()}: ${metric.value.toFixed(2)}${this.getMetricUnit(name)}`)
    }
  }
  
  /**
   * Get emoji for metric quality
   */
  private getMetricEmoji(name: string, value: number): string {
    const thresholds: Record<string, [number, number]> = {
      fcp: [1800, 3000],
      lcp: [2500, 4000],
      fid: [100, 300],
      cls: [0.1, 0.25],
      ttfb: [800, 1800],
      tti: [3800, 7300],
    }
    
    const [good, poor] = thresholds[name] || [0, 0]
    
    if (name === 'cls') {
      if (value <= good) return '✅'
      if (value <= poor) return '⚠️'
      return '❌'
    }
    
    if (value <= good) return '✅'
    if (value <= poor) return '⚠️'
    return '❌'
  }
  
  /**
   * Get unit for metric
   */
  private getMetricUnit(name: string): string {
    return name === 'cls' ? '' : 'ms'
  }
  
  /**
   * Track custom metric
   */
  track(name: string, value: number) {
    this.data.customMetrics.set(name, value)
    
    if (!this.isProduction) {
      console.log(`📊 Custom metric - ${name}: ${value.toFixed(2)}ms`)
    }
  }
  
  /**
   * Mark a timing point
   */
  mark(name: string) {
    performance.mark(name)
  }
  
  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark?: string) {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark)
      } else {
        performance.measure(name, startMark)
      }
      
      const measures = performance.getEntriesByName(name, 'measure')
      const lastMeasure = measures[measures.length - 1]
      
      if (lastMeasure) {
        this.track(name, lastMeasure.duration)
        return lastMeasure.duration
      }
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error)
    }
    
    return 0
  }
  
  /**
   * Measure component render time
   */
  measureComponent(componentName: string, callback: () => void) {
    const startMark = `${componentName}-start`
    const endMark = `${componentName}-end`
    
    this.mark(startMark)
    callback()
    this.mark(endMark)
    
    return this.measure(`${componentName}-render`, startMark, endMark)
  }
  
  /**
   * Get all performance data
   */
  getData(): PerformanceData {
    return {
      ...this.data,
      customMetrics: new Map(this.data.customMetrics),
    }
  }
  
  /**
   * Send metrics to analytics endpoint
   */
  async sendMetrics(endpoint: string) {
    const data = this.getData()
    const metrics = {
      fcp: data.fcp,
      lcp: data.lcp,
      fid: data.fid,
      cls: data.cls,
      ttfb: data.ttfb,
      tti: data.tti,
      custom: Object.fromEntries(data.customMetrics),
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      connectionType: (navigator as any).connection?.effectiveType,
    }
    
    try {
      // Use sendBeacon for reliability
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon(endpoint, JSON.stringify(metrics))
      } else {
        // Fallback to fetch
        await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(metrics),
          headers: {
            'Content-Type': 'application/json',
          },
          keepalive: true,
        })
      }
    } catch (error) {
      console.warn('Failed to send metrics:', error)
    }
  }
  
  /**
   * Log performance summary
   */
  logSummary() {
    const data = this.getData()
    const elapsed = performance.now() - this.startTime
    
    console.group('📊 Performance Summary')
    console.log(`Total time elapsed: ${(elapsed / 1000).toFixed(2)}s`)
    
    if (data.fcp) console.log(`FCP: ${data.fcp.toFixed(2)}ms`)
    if (data.lcp) console.log(`LCP: ${data.lcp.toFixed(2)}ms`)
    if (data.fid) console.log(`FID: ${data.fid.toFixed(2)}ms`)
    if (data.cls) console.log(`CLS: ${data.cls.toFixed(4)}`)
    if (data.ttfb) console.log(`TTFB: ${data.ttfb.toFixed(2)}ms`)
    if (data.tti) console.log(`TTI: ${data.tti.toFixed(2)}ms`)
    
    if (data.customMetrics.size > 0) {
      console.group('Custom Metrics')
      data.customMetrics.forEach((value, key) => {
        console.log(`${key}: ${value.toFixed(2)}ms`)
      })
      console.groupEnd()
    }
    
    console.groupEnd()
  }
  
  /**
   * Cleanup observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }
}

// Singleton instance
let instance: PerformanceMonitor | null = null

/**
 * Get or create performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!instance) {
    instance = new PerformanceMonitor()
  }
  return instance
}

/**
 * Helper to measure async operations
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const monitor = getPerformanceMonitor()
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  
  monitor.mark(startMark)
  
  try {
    const result = await operation()
    monitor.mark(endMark)
    monitor.measure(name, startMark, endMark)
    return result
  } catch (error) {
    monitor.mark(endMark)
    monitor.measure(name, startMark, endMark)
    throw error
  }
}

/**
 * Helper to measure sync operations
 */
export function measureSync<T>(
  name: string,
  operation: () => T
): T {
  const monitor = getPerformanceMonitor()
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  
  monitor.mark(startMark)
  
  try {
    const result = operation()
    monitor.mark(endMark)
    monitor.measure(name, startMark, endMark)
    return result
  } catch (error) {
    monitor.mark(endMark)
    monitor.measure(name, startMark, endMark)
    throw error
  }
}

/**
 * Vue directive for measuring component render time
 */
export const vMeasure = {
  mounted(el: HTMLElement, binding: { value: string }) {
    const monitor = getPerformanceMonitor()
    const name = binding.value || el.tagName.toLowerCase()
    monitor.track(`component-${name}-mounted`, performance.now())
  },
  updated(el: HTMLElement, binding: { value: string }) {
    const monitor = getPerformanceMonitor()
    const name = binding.value || el.tagName.toLowerCase()
    monitor.track(`component-${name}-updated`, performance.now())
  },
}