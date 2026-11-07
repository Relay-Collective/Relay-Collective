import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './hooks'

// The palette as RGB for canvas strokes: midnight, electric, cantaloupe and porcelain (see @theme in index.css)
const MIDNIGHT = '17, 24, 32'
const ELECTRIC = '2, 151, 222'
const CANTALOUPE = '252, 115, 77'
const PORCELAIN = '#f8f9f7'

const LIGHT = 230 // px: the radius of the light that follows the pointer
const GLIDE = 0.1 // how much of the way to the pointer the light travels each frame, so it trails it softly
const IDLE_MS = 1100 // the light rests once the pointer has been still this long, so nothing glows behind what you're reading
const REVEAL_MS = 2400 // the mesh unrolls from the Relay Loop over this long
const HOP_MS = 560 // a relay point crosses one cell, slowing into each node like a handoff
const TRAIL_MS = 440
const FLASH_MS = 900 // a node stays lit this long after a relay passes it
const RIPPLE_MS = 1200
const RIPPLE_SPEED = 0.9 // px per ms
const GLOW_STEPS = 6

interface Node {
  x: number
  y: number
  glow: number
  flash: number // when a relay last passed
}

interface Relay {
  c: number
  r: number
  dc: number
  dr: number
  start: number // when it left the current node
  hops: number
  maxHops: number
  trail: { x: number; y: number; t: number }[]
  leaving?: number
  spawnAt: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)

// The hero's ground: a living network. A still hairline grid that a soft electric light picks out around the pointer
// (light, never movement, so nothing behind the copy shifts), a ring of light where you tap, and relay points
// (the logo's cantaloupe centre) travelling node to node, lighting each one they hand off at.
// Decorative and hidden from screen readers. It pauses offscreen; reduced motion draws it once, still.
export function HeroMesh() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const section = wrap?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !section || !ctx) return

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    // The cells relay points may use: where the mesh is at full strength, clear of the header and the fade below
    let lane = { c0: 1, c1: 1, r0: 1, r1: 1 }
    let nodes: Node[] = []
    let lines: [Node, Node][] = []
    let relays: Relay[] = []
    let maxD = 0
    const origin = { x: 0, y: 0 }
    const born = performance.now()
    let revealed = reduced
    const ripples: { x: number; y: number; t: number }[] = []
    const pointer = { cx: 0, cy: 0, inside: false, moved: -Infinity }
    const light = { x: 0, y: 0, strength: 0, placed: false }
    // The light is painted on its own layer: soft shapes first, then the grid drawn in electric only where they are
    const layer = document.createElement('canvas')
    const lctx = layer.getContext('2d')
    if (!lctx) return

    const at = (c: number, r: number) => nodes[r * cols + c]

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layer.width = canvas.width
      layer.height = canvas.height
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const gap = w < 640 ? 44 : w < 1280 ? 56 : 64
      cols = Math.ceil(w / gap) + 2
      rows = Math.ceil(h / gap) + 2
      // Rest every line on whole device pixels, so each hairline renders at one even weight
      const snap = (v: number) => (Math.round(v * dpr) + (dpr % 2 === 1 ? 0.5 : 0)) / dpr
      const x0 = (w - (cols - 1) * gap) / 2
      const y0 = (h - (rows - 1) * gap) / 2

      // Unroll from the middle of the Relay Loop, so the network spreads out of the platform
      const figure = section.querySelector('figure')?.getBoundingClientRect()
      const ox = figure ? figure.left + figure.width / 2 - rect.left : w / 2
      const oy = figure ? figure.top + figure.height / 2 - rect.top : h / 2
      origin.x = ox
      origin.y = oy

      nodes = []
      maxD = 0
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = snap(x0 + c * gap)
          const y = snap(y0 + r * gap)
          maxD = Math.max(maxD, Math.hypot(x - ox, y - oy))
          nodes.push({ x, y, glow: 0, flash: -Infinity })
        }
      }

      lines = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const n = at(c, r)
          if (c < cols - 1) lines.push([n, at(c + 1, r)])
          if (r < rows - 1) lines.push([n, at(c, r + 1)])
        }
      }

      // Relays keep to the Relay Loop's side of the hero, clear of the headline: the right half from xl, where the
      // copy sits beside the picture, and the lower half below it, where the picture comes after the copy
      const wide = w >= 1280
      lane = {
        c0: Math.max(1, Math.ceil(((wide ? w * 0.52 : gap) - x0) / gap)),
        c1: Math.min(cols - 2, Math.floor((w - gap - x0) / gap)),
        r0: Math.max(1, Math.ceil(((wide ? 170 : h * 0.5) - y0) / gap)),
        r1: Math.min(rows - 2, Math.floor((h * 0.7 - y0) / gap)),
      }

      const count = w < 640 ? 2 : w < 1280 ? 3 : 5
      const now = performance.now()
      const first = revealed ? 400 : REVEAL_MS * 0.8
      relays = Array.from({ length: count }, (_, i) => ({
        c: 0,
        r: 0,
        dc: 0,
        dr: 0,
        start: 0,
        hops: 0,
        maxHops: 0,
        trail: [],
        spawnAt: now + first + i * 900,
      }))
    }

    // Straight on more often than not; never back the way it came, and never off the edge of the grid
    const turn = (relay: Relay) => {
      const options: [number, number][] = [
        [relay.dc, relay.dr],
        [relay.dr, -relay.dc],
        [-relay.dr, relay.dc],
      ]
      const fits = ([dc, dr]: [number, number]) => {
        const c = relay.c + dc
        const r = relay.r + dr
        return c >= lane.c0 && c <= lane.c1 && r >= lane.r0 && r <= lane.r1
      }
      const straight = fits(options[0]) && Math.random() < 0.55
      const next = straight ? options[0] : options.slice(1).filter(fits)[Math.floor(Math.random() * 2)] ?? options.find(fits)
      if (!next) return false
      relay.dc = next[0]
      relay.dr = next[1]
      return true
    }

    const spawn = (relay: Relay, now: number) => {
      // No room on this screen: stay parked until the next resize rebuilds the lane
      if (lane.c1 < lane.c0 || lane.r1 < lane.r0) {
        relay.spawnAt = Infinity
        return
      }
      relay.c = lane.c0 + Math.floor(Math.random() * (lane.c1 - lane.c0 + 1))
      relay.r = lane.r0 + Math.floor(Math.random() * (lane.r1 - lane.r0 + 1))
      const dirs: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
      ;[relay.dc, relay.dr] = dirs[Math.floor(Math.random() * 4)]
      relay.start = now
      relay.hops = 0
      relay.maxHops = 5 + Math.floor(Math.random() * 8)
      relay.trail = []
      relay.leaving = undefined
      at(relay.c, relay.r).flash = now
      if (!turn(relay)) relay.spawnAt = now + 400
    }

    const step = (now: number, dt: number) => {
      const rect = canvas.getBoundingClientRect()
      const px = pointer.cx - rect.left
      const py = pointer.cy - rect.top
      // The light glides after the pointer, comes up quickly when it moves, and settles away slowly once it stops
      const awake = pointer.inside && now - pointer.moved < IDLE_MS
      if (!light.placed && awake) {
        light.x = px
        light.y = py
        light.placed = true
      }
      const glide = 1 - Math.pow(1 - GLIDE, dt / 16.67)
      light.x += (px - light.x) * glide
      light.y += (py - light.y) * glide
      light.strength += ((awake ? 1 : 0) - light.strength) * clamp01(dt / (awake ? 260 : 900))
      // Once it has fully faded, the next light starts under the pointer instead of sliding over from the old spot
      if (!awake && light.strength < 0.01) light.placed = false
      while (ripples.length && now - ripples[0].t > RIPPLE_MS) ripples.shift()

      for (const n of nodes) n.glow = clamp01(1 - (now - n.flash) / FLASH_MS) ** 2

      for (const relay of relays) {
        if (now < relay.spawnAt) continue
        if (!relay.maxHops) {
          spawn(relay, now)
          continue
        }
        if (relay.leaving !== undefined) {
          if (now - relay.leaving > TRAIL_MS) {
            relay.maxHops = 0
            relay.spawnAt = now + 600 + Math.random() * 1800
          }
          continue
        }
        // Back from a paused tab: pick up from the node it was at, rather than racing to catch up
        if (now - relay.start > HOP_MS * 2) relay.start = now
        if (now - relay.start >= HOP_MS) {
          relay.c += relay.dc
          relay.r += relay.dr
          relay.start += HOP_MS
          relay.hops++
          at(relay.c, relay.r).flash = now
          if (relay.hops >= relay.maxHops || !turn(relay)) relay.leaving = now
        }
      }
    }

    const relayPoint = (relay: Relay, now: number) => {
      const a = at(relay.c, relay.r)
      if (relay.leaving !== undefined) return { x: a.x, y: a.y }
      const b = at(relay.c + relay.dc, relay.r + relay.dr)
      const p = easeInOut(clamp01((now - relay.start) / HOP_MS))
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }
    }

    // A whole row or column as one polyline, so crossings never double up and darken
    const traceGrid = (g: CanvasRenderingContext2D) => {
      for (let r = 0; r < rows; r++) {
        g.moveTo(at(0, r).x, at(0, r).y)
        g.lineTo(at(cols - 1, r).x, at(cols - 1, r).y)
      }
      for (let c = 0; c < cols; c++) {
        g.moveTo(at(c, 0).x, at(c, 0).y)
        g.lineTo(at(c, rows - 1).x, at(c, rows - 1).y)
      }
    }

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const reach = revealed ? Infinity : easeInOut(clamp01((now - born) / REVEAL_MS)) * (maxD + 200)
      if (!revealed && reach >= maxD + 200) revealed = true

      // The grid: one even hairline everywhere
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(${MIDNIGHT}, 0.07)`
      ctx.beginPath()
      traceGrid(ctx)
      ctx.stroke()

      // The light around the pointer and the rings from taps: soft shapes on the layer, then the grid in electric inside them
      const ringing = ripples.length > 0
      // A hidden or collapsed hero (e.g. behind the phone menu) resizes the layer to 0×0, and drawing a
      // 0×0 canvas throws, so skip the light until there's room again
      if ((light.strength > 0.005 || ringing) && layer.width > 0 && layer.height > 0) {
        lctx.clearRect(0, 0, w, h)
        lctx.globalCompositeOperation = 'source-over'
        if (light.strength > 0.005) {
          const spot = lctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, LIGHT)
          spot.addColorStop(0, `rgba(0, 0, 0, ${0.9 * light.strength})`)
          spot.addColorStop(0.45, `rgba(0, 0, 0, ${0.38 * light.strength})`)
          spot.addColorStop(1, 'rgba(0, 0, 0, 0)')
          lctx.fillStyle = spot
          lctx.fillRect(light.x - LIGHT, light.y - LIGHT, LIGHT * 2, LIGHT * 2)
        }
        for (const rp of ripples) {
          const age = (now - rp.t) / RIPPLE_MS
          const r = (now - rp.t) * RIPPLE_SPEED
          const band = 46
          const ring = lctx.createRadialGradient(rp.x, rp.y, Math.max(0, r - band), rp.x, rp.y, r + band)
          const fade = 0.7 * (1 - age) ** 2
          ring.addColorStop(0, 'rgba(0, 0, 0, 0)')
          ring.addColorStop(0.5, `rgba(0, 0, 0, ${fade})`)
          ring.addColorStop(1, 'rgba(0, 0, 0, 0)')
          lctx.fillStyle = ring
          lctx.fillRect(rp.x - r - band, rp.y - r - band, (r + band) * 2, (r + band) * 2)
        }
        lctx.globalCompositeOperation = 'source-in'
        lctx.strokeStyle = `rgb(${ELECTRIC})`
        lctx.fillStyle = `rgb(${ELECTRIC})`
        lctx.lineWidth = 1
        lctx.beginPath()
        traceGrid(lctx)
        lctx.stroke()
        lctx.beginPath()
        for (const n of nodes) {
          lctx.moveTo(n.x + 1.6, n.y)
          lctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2)
        }
        lctx.fill()
        ctx.drawImage(layer, 0, 0, w, h)
      }

      // A relay lights the node it hands off at, in a few steps of strength so each step is one stroke
      const levels: [Node, Node][][] = Array.from({ length: GLOW_STEPS }, () => [])
      for (const [a, b] of lines) {
        const g = Math.min(1, (a.glow + b.glow) / 2)
        if (g >= 0.03) levels[Math.min(GLOW_STEPS - 1, Math.floor(g * GLOW_STEPS))].push([a, b])
      }
      levels.forEach((edges, i) => {
        if (!edges.length) return
        ctx.strokeStyle = `rgba(${ELECTRIC}, ${(0.5 * (i + 1)) / GLOW_STEPS})`
        ctx.beginPath()
        for (const [a, b] of edges) {
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
        }
        ctx.stroke()
      })
      ctx.fillStyle = `rgb(${ELECTRIC})`
      for (const n of nodes) {
        if (n.glow < 0.06) continue
        ctx.globalAlpha = Math.min(1, n.glow * 1.1)
        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.2 + n.glow * 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // While it unrolls, a soft-edged circle from the Relay Loop keeps only what it has reached
      if (!revealed && reach > 0) {
        const edge = ctx.createRadialGradient(origin.x, origin.y, Math.max(0, reach - 200), origin.x, origin.y, reach)
        edge.addColorStop(0, '#000')
        edge.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.globalCompositeOperation = 'destination-in'
        ctx.fillStyle = edge
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      } else if (!revealed) {
        ctx.clearRect(0, 0, w, h)
      }

      // The relay points: a fading cantaloupe trail, and the logo's centre dot, set on a porcelain ring
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2
      for (const relay of relays) {
        if (now < relay.spawnAt || !relay.maxHops) continue
        const head = relayPoint(relay, now)
        if (relay.leaving === undefined) relay.trail.push({ ...head, t: now })
        while (relay.trail.length && now - relay.trail[0].t > TRAIL_MS) relay.trail.shift()
        const trail = relay.trail
        if (trail.length > 1) {
          const tail = trail[0]
          const tip = trail[trail.length - 1]
          const fade = ctx.createLinearGradient(tail.x, tail.y, tip.x, tip.y)
          fade.addColorStop(0, `rgba(${CANTALOUPE}, 0)`)
          fade.addColorStop(1, `rgba(${CANTALOUPE}, ${0.85 * (1 - (now - tip.t) / TRAIL_MS)})`)
          ctx.strokeStyle = fade
          ctx.beginPath()
          ctx.moveTo(tail.x, tail.y)
          for (const pt of trail) ctx.lineTo(pt.x, pt.y)
          ctx.stroke()
        }
        const o = relay.leaving === undefined ? clamp01((now - relay.spawnAt) / 300) : 1 - clamp01((now - relay.leaving) / 320)
        if (o <= 0) continue
        ctx.globalAlpha = o
        ctx.fillStyle = PORCELAIN
        ctx.beginPath()
        ctx.arc(head.x, head.y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgb(${CANTALOUPE})`
        ctx.beginPath()
        ctx.arc(head.x, head.y, 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    build()

    // Reduced motion: the finished mesh, still, redrawn only when its size changes
    if (reduced) {
      relays = []
      draw(performance.now())
      const still = new ResizeObserver(() => {
        build()
        relays = []
        draw(performance.now())
      })
      still.observe(canvas)
      return () => still.disconnect()
    }

    let frame = 0
    let last = performance.now()
    let visible = true
    const loop = (now: number) => {
      const dt = Math.min(now - last, 64)
      last = now
      step(now, dt)
      draw(now)
      frame = requestAnimationFrame(loop)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      if (!visible || document.hidden) return
      last = performance.now()
      frame = requestAnimationFrame(loop)
    }

    const resize = new ResizeObserver(() => {
      build()
      draw(performance.now())
    })
    resize.observe(canvas)
    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    onScreen.observe(canvas)

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const s = section.getBoundingClientRect()
      pointer.cx = e.clientX
      pointer.cy = e.clientY
      pointer.moved = performance.now()
      pointer.inside = e.clientX >= s.left && e.clientX <= s.right && e.clientY >= s.top && e.clientY <= s.bottom
    }
    const onLeave = () => (pointer.inside = false)
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() })
      if (ripples.length > 4) ripples.shift()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    section.addEventListener('pointerdown', onDown)
    document.addEventListener('visibilitychange', run)
    run()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      onScreen.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      section.removeEventListener('pointerdown', onDown)
      document.removeEventListener('visibilitychange', run)
    }
  }, [reduced])

  return (
    <div ref={wrapRef} className="rcl-mesh pointer-events-none absolute inset-x-0 bottom-0 top-[-76px] -z-10" aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
