import { createSignal, onMount, onCleanup, type JSX } from "solid-js"
import { useKV } from "../context/kv"
import { useTerminalDimensions } from "@opentui/solid"
import type { BoxRenderable } from "@opentui/core"

const FRAME_MS = 16
const DURATION_MS = 400
// fallbacks when no origin was captured (e.g. session opened without visiting home)
const FALLBACK_HEIGHT = 6
const FALLBACK_CENTER_OFFSET = 6

// measured geometry of the home prompt box, captured right before home unmounts
let origin: { y: number; height: number } | undefined

export function captureRouteTransitionOrigin(box: BoxRenderable | undefined) {
  if (!box) return
  origin = { y: box.screenY, height: box.height }
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4)
}

export function RouteTransition(props: { children: JSX.Element }) {
  const kv = useKV()
  const dimensions = useTerminalDimensions()
  const enabled = kv.get("animations_enabled", true)
  const h = dimensions().height
  const startHeight = Math.max(1, Math.min(origin?.height ?? FALLBACK_HEIGHT, h))
  const startCenter = origin
    ? Math.max(startHeight / 2, Math.min(origin.y + startHeight / 2, h - startHeight / 2))
    : Math.min(h / 2 + FALLBACK_CENTER_OFFSET, h - startHeight / 2)
  const [opacity, setOpacity] = createSignal(enabled ? 0 : 1)
  const [maxHeight, setMaxHeight] = createSignal<number | `${number}%`>(enabled ? startHeight : "100%")
  let ref: BoxRenderable | undefined

  if (enabled) {
    let timer: ReturnType<typeof setInterval> | undefined
    onMount(() => {
      if (ref) ref.translateY = Math.round(startCenter - startHeight / 2)
      const startTime = performance.now()
      timer = setInterval(() => {
        const progress = Math.min((performance.now() - startTime) / DURATION_MS, 1)
        const t = easeOutQuart(progress)
        setOpacity(t)
        const mh = Math.round(startHeight + (h - startHeight) * t)
        const center = startCenter + (h / 2 - startCenter) * t
        if (ref) ref.translateY = progress >= 1 ? 0 : Math.max(0, Math.min(h - mh, Math.round(center - mh / 2)))
        setMaxHeight(progress >= 1 ? "100%" : mh)
        if (progress >= 1) clearInterval(timer!)
      }, FRAME_MS)
    })
    onCleanup(() => {
      if (timer) clearInterval(timer)
    })
  }

  return (
    <box ref={ref} opacity={opacity()} maxHeight={maxHeight()} overflow="hidden" flexGrow={1} minHeight={0} flexDirection="column">
      {props.children}
    </box>
  )
}
