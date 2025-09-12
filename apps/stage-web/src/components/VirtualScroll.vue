<template>
  <div 
    ref="containerRef"
    class="virtual-scroll-container"
    :style="containerStyle"
    @scroll="handleScroll"
  >
    <!-- Spacer for maintaining scroll height -->
    <div class="virtual-scroll-spacer" :style="spacerStyle" />
    
    <!-- Visible items -->
    <div 
      class="virtual-scroll-content"
      :style="contentStyle"
    >
      <div
        v-for="item in visibleItems"
        :key="getItemKey(item)"
        class="virtual-scroll-item"
        :style="getItemStyle(item)"
      >
        <slot :item="item.data" :index="item.index" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDeviceOptimization } from '@/composables/useDeviceOptimization'
import { useThrottleFn } from '@vueuse/core'

interface Props {
  items: any[]
  itemHeight?: number | ((index: number) => number)
  buffer?: number
  keyField?: string
  horizontal?: boolean
  estimatedItemHeight?: number
  measureItems?: boolean
  scrollToBottom?: boolean
  reverseOrder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 60,
  buffer: 3,
  keyField: 'id',
  horizontal: false,
  estimatedItemHeight: 60,
  measureItems: false,
  scrollToBottom: false,
  reverseOrder: false,
})

const emit = defineEmits<{
  scroll: [event: Event]
  scrollEnd: []
  scrollStart: []
}>()

// Refs
const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)
const containerHeight = ref(0)
const itemHeights = ref<Map<number, number>>(new Map())

// Device optimization
const device = useDeviceOptimization()

// Calculate item heights
const getItemHeight = (index: number): number => {
  if (props.measureItems && itemHeights.value.has(index)) {
    return itemHeights.value.get(index)!
  }
  
  if (typeof props.itemHeight === 'function') {
    return props.itemHeight(index)
  }
  
  return props.itemHeight || props.estimatedItemHeight
}

// Calculate total height
const totalHeight = computed(() => {
  let height = 0
  for (let i = 0; i < props.items.length; i++) {
    height += getItemHeight(i)
  }
  return height
})

// Calculate visible range
const visibleRange = computed(() => {
  const start = findStartIndex()
  const end = findEndIndex(start)
  
  // Add buffer
  const bufferSize = device.isMobile.value ? props.buffer : props.buffer * 2
  const bufferedStart = Math.max(0, start - bufferSize)
  const bufferedEnd = Math.min(props.items.length - 1, end + bufferSize)
  
  return {
    start: bufferedStart,
    end: bufferedEnd,
  }
})

// Get visible items with positioning
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  const items = []
  
  let top = 0
  for (let i = 0; i < start; i++) {
    top += getItemHeight(i)
  }
  
  for (let i = start; i <= end; i++) {
    const item = props.items[i]
    if (item) {
      items.push({
        index: i,
        data: item,
        top,
        height: getItemHeight(i),
      })
      top += getItemHeight(i)
    }
  }
  
  return props.reverseOrder ? items.reverse() : items
})

// Container styles
const containerStyle = computed(() => ({
  height: '100%',
  overflow: 'auto',
  position: 'relative',
  WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
  contain: 'strict', // Performance optimization
}))

// Spacer styles
const spacerStyle = computed(() => ({
  height: `${totalHeight.value}px`,
  width: '1px',
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
}))

// Content styles
const contentStyle = computed(() => ({
  position: 'relative',
  width: '100%',
}))

// Get item style
const getItemStyle = (item: any) => ({
  position: 'absolute',
  top: `${item.top}px`,
  left: 0,
  right: 0,
  height: `${item.height}px`,
  contain: 'layout',
})

// Get item key
const getItemKey = (item: any) => {
  if (props.keyField && item.data[props.keyField]) {
    return item.data[props.keyField]
  }
  return `item-${item.index}`
}

// Find start index based on scroll position
function findStartIndex(): number {
  let accumulated = 0
  for (let i = 0; i < props.items.length; i++) {
    const height = getItemHeight(i)
    if (accumulated + height > scrollTop.value) {
      return i
    }
    accumulated += height
  }
  return 0
}

// Find end index based on start and container height
function findEndIndex(start: number): number {
  let accumulated = 0
  for (let i = start; i < props.items.length; i++) {
    if (accumulated > containerHeight.value) {
      return i
    }
    accumulated += getItemHeight(i)
  }
  return props.items.length - 1
}

// Handle scroll with throttling
const handleScroll = useThrottleFn((event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  emit('scroll', event)
  
  // Detect scroll end
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 10) {
    emit('scrollEnd')
  }
  
  // Detect scroll start
  if (target.scrollTop < 10) {
    emit('scrollStart')
  }
}, device.isMobile.value ? 32 : 16) // More aggressive throttling on mobile

// Measure item heights if needed
function measureItemHeights() {
  if (!props.measureItems || !containerRef.value) return
  
  const items = containerRef.value.querySelectorAll('.virtual-scroll-item')
  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect()
    itemHeights.value.set(index, rect.height)
  })
}

// Public methods
function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
  if (!containerRef.value) return
  
  let targetTop = 0
  for (let i = 0; i < index; i++) {
    targetTop += getItemHeight(i)
  }
  
  containerRef.value.scrollTo({
    top: targetTop,
    behavior: device.features.value.shouldLoadHeavyAnimations ? behavior : 'auto',
  })
}

function scrollToTop(behavior: ScrollBehavior = 'smooth') {
  if (!containerRef.value) return
  
  containerRef.value.scrollTo({
    top: 0,
    behavior: device.features.value.shouldLoadHeavyAnimations ? behavior : 'auto',
  })
}

function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  if (!containerRef.value) return
  
  containerRef.value.scrollTo({
    top: totalHeight.value,
    behavior: device.features.value.shouldLoadHeavyAnimations ? behavior : 'auto',
  })
}

// Update container dimensions
function updateDimensions() {
  if (!containerRef.value) return
  
  containerHeight.value = containerRef.value.clientHeight
  
  if (props.measureItems) {
    measureItemHeights()
  }
}

// Resize observer for container
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateDimensions()
  
  // Set up resize observer
  if (containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    resizeObserver.observe(containerRef.value)
  }
  
  // Scroll to bottom if requested
  if (props.scrollToBottom) {
    nextTick(() => {
      scrollToBottom('auto')
    })
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Watch for items changes
watch(() => props.items.length, (newLength, oldLength) => {
  if (props.measureItems) {
    nextTick(() => {
      measureItemHeights()
    })
  }
  
  // Auto-scroll to bottom for chat-like interfaces
  if (props.scrollToBottom && newLength > oldLength) {
    nextTick(() => {
      scrollToBottom('smooth')
    })
  }
})

// Expose public methods
defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
  updateDimensions,
})
</script>

<style scoped>
.virtual-scroll-container {
  /* Optimize scrolling performance */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  
  /* Prevent layout shifts */
  contain: strict;
  
  /* GPU acceleration */
  will-change: scroll-position;
}

.virtual-scroll-spacer {
  /* Invisible spacer to maintain scroll height */
  visibility: hidden;
  pointer-events: none;
}

.virtual-scroll-content {
  /* Container for visible items */
  position: relative;
  
  /* Prevent layout recalculation */
  contain: layout;
}

.virtual-scroll-item {
  /* Optimize item rendering */
  contain: layout style paint;
  
  /* Prevent text selection issues during scroll */
  user-select: none;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .virtual-scroll-container {
    /* Optimize for touch scrolling */
    scroll-behavior: smooth;
    
    /* Hide scrollbar on mobile for cleaner look */
    scrollbar-width: none;
  }
  
  .virtual-scroll-container::-webkit-scrollbar {
    display: none;
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .virtual-scroll-container {
    scroll-behavior: auto;
  }
}
</style>