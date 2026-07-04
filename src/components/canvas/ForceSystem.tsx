// MatterFlow - LA FUERZA (Star Wars) sobre el entorno real. (c) 2026 Abel Gomez
// Distorsiona EL VIDEO de la camara (sin objetos ficticios):
//   - EMPUJAR: se detecta el MOVIMIENTO de empuje de la mano abierta (un envion
//     rapido o acercarla a la camara) y se emite un PULSO/onda expansiva que
//     empuja el entorno. No basta con abrir la mano: hay que "empujar".
//   - AGARRAR / ASFIXIAR: al CERRAR la mano (puno/garra) engancha la region del
//     video bajo la mano, la arrastra/levanta siguiendola y la estruja (choke)
//     con temblor. Al abrir, se suelta.
// Sin camara, cae a una rejilla procedural (mouse: mover rapido = pulso,
// mantener presionado = agarrar).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { cameraBus, handLandmarksBus } from '../camera/HandTracker'
import { isFingerExtended, dist2D } from '../../utils/handUtils'

const MAXP = 10

interface Pulse {
  x: number
  y: number
  r: number
  life: number
  strength: number
}

interface Grab {
  active: boolean
  ax: number
  ay: number
  hx: number
  hy: number
  amt: number
}

interface Track {
  x: number
  y: number
  scale: number
  init: boolean
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uHasVideo;
  uniform vec2 uRes;
  uniform vec2 uTexRes;
  uniform float uTime;
  uniform int uPulseCount;
  uniform vec4 uPulses[${MAXP}];  // xy=centro, z=radio, w=fuerza
  uniform vec4 uGrabs[2];         // xy=mano, zw=ancla
  uniform float uGrabAmt[2];

  vec2 coverUv(vec2 uv, vec2 res, vec2 texRes) {
    vec2 s = res / texRes;
    float scale = max(s.x, s.y);
    vec2 fit = texRes * scale;
    return (uv * res - (res - fit) * 0.5) / fit;
  }

  vec3 grid(vec2 uv) {
    vec2 g = abs(fract(uv * 14.0) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    return mix(vec3(0.01, 0.02, 0.05), vec3(0.03, 0.06, 0.14), line);
  }

  void main() {
    float asp = uRes.x / uRes.y;
    vec2 suv = vUv;
    vec2 disp = vec2(0.0);
    float rim = 0.0;
    float grip = 0.0;

    // pulsos de empuje
    for (int i = 0; i < ${MAXP}; i++) {
      if (i >= uPulseCount) break;
      vec4 p = uPulses[i];
      vec2 d = suv - p.xy;
      d.x *= asp;
      float dist = length(d);
      vec2 dirn = dist > 1e-4 ? d / dist : vec2(0.0);
      // anillo fino y nitido (onda reconocible) con distorsion sutil
      float ring = exp(-pow((dist - p.z) / 0.022, 2.0));
      float ring2 = exp(-pow((dist - p.z + 0.03) / 0.05, 2.0)); // frente trasero suave
      disp += dirn * (ring * 0.9 + ring2 * 0.3) * p.w * 0.045;
      rim += ring * p.w;
    }

    // agarrar / estrujar (asfixia)
    for (int i = 0; i < 2; i++) {
      float amt = uGrabAmt[i];
      if (amt <= 0.001) continue;
      vec2 h = uGrabs[i].xy;
      vec2 a = uGrabs[i].zw;
      vec2 d = suv - h;
      d.x *= asp;
      float dist = length(d);
      float w = exp(-pow(dist / 0.22, 2.0)) * amt;
      disp += (a - h) * w;              // arrastra la region con la mano
      disp += (h - suv) * w * 0.6;      // estruja/comprime hacia la mano (choke)
      vec2 tang = dist > 1e-4 ? vec2(-d.y, d.x) / dist : vec2(0.0);
      disp += tang * w * 0.02 * sin(uTime * 26.0); // temblor
      grip += w;
    }

    vec2 duv = suv + vec2(disp.x / asp, disp.y);

    vec3 col;
    if (uHasVideo > 0.5) {
      vec2 cuv = coverUv(duv, uRes, uTexRes);
      cuv.x = 1.0 - cuv.x;
      col = texture2D(uTex, cuv).rgb;
    } else {
      col = grid(duv);
    }

    // onda de fuerza: anillo translucido reconocible (blanco-azulado)
    col += vec3(0.6, 0.82, 1.0) * min(rim, 1.5) * 0.85;
    col += vec3(0.55, 0.12, 0.12) * min(grip, 1.0) * 0.45; // tension rojiza (choke)
    col *= 1.0 - min(grip, 1.0) * 0.22;                    // oscurece el agarre

    gl_FragColor = vec4(col, 1.0);
  }
`

// umbrales de deteccion de empuje
const V_PUSH = 1.15 // velocidad (unid. normalizadas / s) para envion lateral
const S_PUSH = 0.45 // crecimiento de escala / s (acercar la mano a la camara)

export default function ForceSystem() {
  const { viewport, size } = useThree()
  const setParticleCount = useMatterStore((s) => s.setParticleCount)
  const setCurrentGesture = useMatterStore((s) => s.setCurrentGesture)

  const pulses = useRef<Pulse[]>([])
  const cooldown = useRef<number[]>([0, 0])
  const grabs = useRef<Grab[]>([
    { active: false, ax: 0, ay: 0, hx: 0, hy: 0, amt: 0 },
    { active: false, ax: 0, ay: 0, hx: 0, hy: 0, amt: 0 },
  ])
  const tracks = useRef<Track[]>([
    { x: 0, y: 0, scale: 0, init: false },
    { x: 0, y: 0, scale: 0, init: false },
  ])
  const texRef = useRef<THREE.VideoTexture | null>(null)

  const uniforms = useMemo(
    () => ({
      uTex: { value: null as THREE.Texture | null },
      uHasVideo: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTexRes: { value: new THREE.Vector2(1280, 720) },
      uTime: { value: 0 },
      uPulseCount: { value: 0 },
      uPulses: { value: Array.from({ length: MAXP }, () => new THREE.Vector4()) },
      uGrabs: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uGrabAmt: { value: [0, 0] },
    }),
    []
  )

  useEffect(() => {
    pulses.current = []
    cooldown.current = [0, 0]
    grabs.current.forEach((g) => {
      g.active = false
      g.amt = 0
    })
    tracks.current.forEach((t) => (t.init = false))
    setParticleCount(0)
    return () => {
      texRef.current?.dispose()
      texRef.current = null
    }
  }, [setParticleCount])

  useFrame((_, delta) => {
    const u = uniforms
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 20)
    u.uTime.value += delta
    u.uRes.value.set(size.width, size.height)

    // textura de la camara
    const video = cameraBus.video
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      if (!texRef.current || texRef.current.image !== video) {
        texRef.current?.dispose()
        const t = new THREE.VideoTexture(video)
        t.colorSpace = THREE.SRGBColorSpace
        texRef.current = t
      }
      u.uTex.value = texRef.current
      u.uTexRes.value.set(video.videoWidth, video.videoHeight)
      u.uHasVideo.value = 1
    } else {
      u.uHasVideo.value = 0
    }

    const hands = handLandmarksBus.hands
    const pointers = getPointers().filter((p) => p.active).slice(0, 2)
    const usingHands = hands.length > 0
    const n = usingHands ? Math.min(hands.length, 2) : Math.min(pointers.length, 2)

    let anyGrab = false
    let anyPush = false

    for (let i = 0; i < 2; i++) {
      const grab = grabs.current[i]
      const tr = tracks.current[i]
      if (cooldown.current[i] > 0) cooldown.current[i] -= dt

      if (i >= n) {
        grab.active = false
        grab.amt = Math.max(0, grab.amt - dt * 4)
        u.uGrabAmt.value[i] = grab.amt
        tr.init = false
        continue
      }

      // posicion (y-down), apertura y escala de la mano
      let cx: number
      let cy: number
      let open: boolean
      let scale: number
      if (usingHands) {
        const hand = hands[i]
        const lm = hand.landmarks
        cx = hand.x
        cy = hand.y
        const ext =
          (isFingerExtended(lm, 8, 6) ? 1 : 0) +
          (isFingerExtended(lm, 12, 10) ? 1 : 0) +
          (isFingerExtended(lm, 16, 14) ? 1 : 0) +
          (isFingerExtended(lm, 20, 18) ? 1 : 0)
        open = ext >= 3
        scale = dist2D(lm[0], lm[9]) // tamano de la palma (mayor = mas cerca)
      } else {
        const ptr = pointers[i]
        cx = ptr.x
        cy = ptr.y
        open = ptr.mode !== 'repel' && ptr.mode !== 'freeze'
        scale = 0
      }

      // velocidad y variacion de escala
      let speed = 0
      let scaleVel = 0
      if (tr.init) {
        speed = Math.hypot(cx - tr.x, cy - tr.y) / dt
        scaleVel = (scale - tr.scale) / dt
      }
      tr.x = cx
      tr.y = cy
      tr.scale = scale
      tr.init = true

      const uy = 1 - cy

      // --- EMPUJAR: gesto/movimiento de empuje con mano abierta ---
      const pushing = open && (speed > V_PUSH || scaleVel > S_PUSH)
      if (pushing && cooldown.current[i] <= 0 && pulses.current.length < MAXP) {
        const strength = Math.min(2.2, 0.8 + Math.max(speed * 0.6, scaleVel * 1.5))
        pulses.current.push({ x: cx, y: uy, r: 0.02, life: 1, strength })
        cooldown.current[i] = 0.28
        anyPush = true
      }

      // --- AGARRAR / ASFIXIAR: mano cerrada ---
      if (!open) {
        anyGrab = true
        if (!grab.active) {
          grab.active = true
          grab.ax = cx
          grab.ay = uy
        }
        grab.hx = cx
        grab.hy = uy
        grab.amt = Math.min(1, grab.amt + dt * 5)
      } else {
        grab.active = false
        grab.amt = Math.max(0, grab.amt - dt * 4)
      }
      u.uGrabs.value[i].set(grab.hx, grab.hy, grab.ax, grab.ay)
      u.uGrabAmt.value[i] = grab.amt
    }

    // avanza pulsos
    const ps = pulses.current
    for (let i = ps.length - 1; i >= 0; i--) {
      ps[i].r += dt * 2.1 // onda rapida que cruza la pantalla
      ps[i].life -= dt * 1.1
      if (ps[i].life <= 0 || ps[i].r > 2.2) ps.splice(i, 1)
    }
    u.uPulseCount.value = ps.length
    for (let i = 0; i < MAXP; i++) {
      const p = ps[i]
      if (p) u.uPulses.value[i].set(p.x, p.y, p.r, Math.max(0, p.life) * p.strength)
      else u.uPulses.value[i].set(0, 0, 0, 0)
    }

    if (anyGrab) setCurrentGesture('Fuerza: agarrar/asfixiar')
    else if (anyPush) setCurrentGesture('Fuerza: empujar')
    else if (n > 0) setCurrentGesture('Fuerza: lista')
    setParticleCount(ps.length + (anyGrab ? 1 : 0))
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}