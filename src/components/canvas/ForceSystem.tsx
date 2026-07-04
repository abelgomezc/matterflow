// MatterFlow - LA FUERZA (Star Wars) sobre el entorno real. (c) 2026 Abel Gomez
// Se distorsiona EL VIDEO de la camara (sin objetos ficticios):
//   - MANO ABIERTA  -> emite un PULSO (onda expansiva) que empuja el entorno.
//   - CERRAR LA MANO (puno/garra) -> AGARRA la region del video que esta bajo
//     la mano en ese instante y la arrastra/levanta siguiendo la mano, con
//     estrujado y temblor (estrangular). Al abrir, se suelta.
// Sin camara, cae a una rejilla procedural para ver el efecto.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { cameraBus } from '../camera/HandTracker'

const MAXP = 8 // maximo de pulsos simultaneos

interface Pulse {
  x: number // uv 0-1 (y hacia arriba)
  y: number
  r: number
  life: number
  strength: number
}

interface Grab {
  active: boolean
  ax: number // ancla (region agarrada) uv
  ay: number
  hx: number // mano actual uv
  hy: number
  amt: number // 0-1 intensidad del agarre (rampa)
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
  uniform vec2 uRes;      // resolucion viewport (px)
  uniform vec2 uTexRes;   // resolucion video (px)
  uniform float uTime;
  uniform int uPulseCount;
  uniform vec4 uPulses[${MAXP}];  // xy=centro(uv), z=radio, w=vida
  uniform vec4 uGrabs[2];         // xy=mano(uv), zw=ancla(uv)
  uniform float uGrabAmt[2];      // 0-1

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
    vec2 suv = vUv;               // 0..1 pantalla, y arriba
    vec2 disp = vec2(0.0);
    float rim = 0.0;   // brillo del frente de onda
    float grip = 0.0;  // intensidad de agarre (para oscurecer/halo)

    // --- pulsos de empuje (mano abierta) ---
    for (int i = 0; i < ${MAXP}; i++) {
      if (i >= uPulseCount) break;
      vec4 p = uPulses[i];
      vec2 d = suv - p.xy;
      d.x *= asp;
      float dist = length(d);
      vec2 dirn = dist > 1e-4 ? d / dist : vec2(0.0);
      float ring = exp(-pow((dist - p.z) / 0.045, 2.0));
      disp += dirn * ring * p.w * 0.07;
      rim += ring * p.w;
    }

    // --- agarrar/arrastrar/estrangular (mano cerrada) ---
    for (int i = 0; i < 2; i++) {
      float amt = uGrabAmt[i];
      if (amt <= 0.001) continue;
      vec2 h = uGrabs[i].xy;   // mano actual
      vec2 a = uGrabs[i].zw;   // region agarrada (ancla)
      vec2 d = suv - h;
      d.x *= asp;
      float dist = length(d);
      float w = exp(-pow(dist / 0.17, 2.0)) * amt;
      // arrastra la region anclada para que siga a la mano
      disp += (a - h) * w;
      // pellizco: comprime el entorno hacia la mano (agarre)
      disp += (h - suv) * w * 0.35;
      // temblor de estrangulamiento
      vec2 tang = dist > 1e-4 ? vec2(-d.y, d.x) / dist : vec2(0.0);
      disp += tang * w * 0.012 * sin(uTime * 22.0);
      grip += w;
    }

    vec2 duv = suv + vec2(disp.x / asp, disp.y);

    vec3 col;
    if (uHasVideo > 0.5) {
      vec2 cuv = coverUv(duv, uRes, uTexRes);
      cuv.x = 1.0 - cuv.x; // espejo selfie
      col = texture2D(uTex, cuv).rgb;
    } else {
      col = grid(duv);
    }

    col += vec3(0.45, 0.72, 1.0) * rim * 0.5;         // halo de la onda
    col += vec3(0.5, 0.15, 0.15) * min(grip, 1.0) * 0.35; // tension rojiza al agarrar
    col *= 1.0 - min(grip, 1.0) * 0.15;               // leve oscurecido en el agarre

    gl_FragColor = vec4(col, 1.0);
  }
`

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
    setParticleCount(0)
    return () => {
      texRef.current?.dispose()
      texRef.current = null
    }
  }, [setParticleCount])

  useFrame((_, delta) => {
    const u = uniforms
    u.uTime.value += delta
    u.uRes.value.set(size.width, size.height)

    // textura de video de la camara
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

    const pointers = getPointers().filter((p) => p.active).slice(0, 2)
    let anyGrab = false
    let anyPush = false

    for (let i = 0; i < 2; i++) {
      const ptr = pointers[i]
      const grab = grabs.current[i]
      if (cooldown.current[i] > 0) cooldown.current[i] -= delta

      if (!ptr) {
        // libera suavemente
        grab.active = false
        grab.amt = Math.max(0, grab.amt - delta * 4)
        u.uGrabAmt.value[i] = grab.amt
        continue
      }

      const uy = 1 - ptr.y
      const isOpen = ptr.mode === 'attract'
      // cerrar la mano (puno o pinza) = agarrar
      const isGrab = ptr.mode === 'repel' || ptr.mode === 'freeze'

      if (isOpen) {
        // PULSO solo con mano abierta
        anyPush = true
        if (cooldown.current[i] <= 0 && pulses.current.length < MAXP) {
          pulses.current.push({ x: ptr.x, y: uy, r: 0.02, life: 1, strength: 1 })
          cooldown.current[i] = 0.5
        }
      }

      if (isGrab) {
        anyGrab = true
        if (!grab.active) {
          // ancla la region que esta bajo la mano en este instante
          grab.active = true
          grab.ax = ptr.x
          grab.ay = uy
        }
        grab.hx = ptr.x
        grab.hy = uy
        grab.amt = Math.min(1, grab.amt + delta * 5)
      } else {
        grab.active = false
        grab.amt = Math.max(0, grab.amt - delta * 4)
      }

      u.uGrabs.value[i].set(grab.hx, grab.hy, grab.ax, grab.ay)
      u.uGrabAmt.value[i] = grab.amt
    }

    // avanza pulsos
    const ps = pulses.current
    for (let i = ps.length - 1; i >= 0; i--) {
      ps[i].r += delta * 0.9
      ps[i].life -= delta * 1.4
      if (ps[i].life <= 0 || ps[i].r > 1.6) ps.splice(i, 1)
    }
    u.uPulseCount.value = ps.length
    for (let i = 0; i < MAXP; i++) {
      const p = ps[i]
      if (p) u.uPulses.value[i].set(p.x, p.y, p.r, Math.max(0, p.life) * p.strength)
      else u.uPulses.value[i].set(0, 0, 0, 0)
    }

    // HUD
    if (anyGrab) setCurrentGesture('Fuerza: agarrar')
    else if (anyPush) setCurrentGesture('Fuerza: empujar')
    setParticleCount(ps.length)
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  )
}