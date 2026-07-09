// MatterFlow - Digital Shadow: face tracking + pop particles / VJ visual.
// Inspirado en flujos tipo TouchDesigner, aislado al modo digitalShadow.
// (c) 2026 Abel Gomez
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { faceLandmarksBus, personMaskBus } from '../camera/HandTracker'
import { useMatterStore } from '../../store/matterStore'

const PARTICLE_COUNT = 12000
const FACE_CONTOUR = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
]
const FEATURE_POINTS = [
  33, 133, 159, 145, 263, 362, 386, 374, 1, 4, 5, 13, 14, 17, 61, 291, 199,
  200, 234, 454,
]
const HEAD_EXTRA_POINTS = [
  10, 109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172, 136, 150, 149,
  176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389,
  251, 284, 332, 297, 338,
]

interface ShadowParticle {
  landmarkIndex: number
  maskSample: number
  centerMix: number
  offset: THREE.Vector3
  drift: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  pop: number
  popSpeed: number
}

const toWorld = (
  x: number,
  y: number,
  viewport: { width: number; height: number },
  z = 0
) =>
  new THREE.Vector3(
    (x - 0.5) * viewport.width,
    (0.5 - y) * viewport.height,
    z
  )

const colorA = new THREE.Color('#D7FF00')
const colorB = new THREE.Color('#78FF00')
const colorC = new THREE.Color('#FFFFFF')

const samplePersonMask = (
  sample: number,
  mask: { width: number; height: number; data: Float32Array },
  focus?: { x: number; y: number; width: number; height: number }
) => {
  const maxAttempts = 36
  const focusMinX = focus ? Math.max(0, focus.x - focus.width * 1.35) : 0
  const focusMaxX = focus ? Math.min(1, focus.x + focus.width * 0.35) : 1
  const focusMinY = focus ? Math.max(0, focus.y - focus.height * 1.5) : 0
  const focusMaxY = focus ? Math.min(1, focus.y + focus.height * 1.9) : 1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const seed = (sample * 9301 + attempt * 49297) % 233280
    const seed2 = (sample * 23399 + attempt * 11939) % 233280
    const rx = seed / 233280
    const ry = seed2 / 233280
    const x = focusMinX + rx * (focusMaxX - focusMinX)
    const y = focusMinY + ry * (focusMaxY - focusMinY)
    const ix = Math.min(mask.width - 1, Math.max(0, Math.floor(x * mask.width)))
    const iy = Math.min(mask.height - 1, Math.max(0, Math.floor(y * mask.height)))
    const confidence = mask.data[iy * mask.width + ix] ?? 0
    if (confidence > 0.58) return { x, y, confidence }
  }

  return null
}

export default function DigitalShadowSystem() {
  const { viewport } = useThree()
  const setParticleCount = useMatterStore((state) => state.setParticleCount)
  const setCurrentGesture = useMatterStore((state) => state.setCurrentGesture)
  const pointsRef = useRef<THREE.Points>(null)
  const lastStatus = useRef({ text: '', at: 0 })
  const smoothedCenter = useRef(new THREE.Vector3())

  const { positions, colors, particles } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const particles: ShadowParticle[] = []

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 4
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2

      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random())
      particles.push({
        landmarkIndex: i % 478,
        maskSample: Math.random(),
        centerMix: Math.random() * 0.18,
        offset: new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (Math.random() - 0.5) * 0.8
        ),
        drift: new THREE.Vector3(
          (Math.random() - 0.5) * 0.035,
          (Math.random() - 0.5) * 0.035,
          (Math.random() - 0.5) * 0.07
        ),
        velocity: new THREE.Vector3(),
        life: Math.random(),
        pop: Math.random() * Math.PI * 2,
        popSpeed: 0.8 + Math.random() * 1.4,
      })
    }

    return { positions, colors, particles }
  }, [])

  useEffect(() => {
    setParticleCount(PARTICLE_COUNT)
    return () => setParticleCount(0)
  }, [setParticleCount])

  const status = (text: string, now: number) => {
    if (lastStatus.current.text !== text || now - lastStatus.current.at > 600) {
      lastStatus.current = { text, at: now }
      setCurrentGesture(text)
    }
  }

  useFrame(({ clock }, delta) => {
    const now = performance.now()
    const elapsed = clock.elapsedTime
    const face = faceLandmarksBus.faces[0]
    const personMask = personMaskBus.mask
    const hasFace = Boolean(face?.landmarks.length)
    const trackedCenter = hasFace
      ? toWorld(face.x, face.y, viewport, -0.22)
      : new THREE.Vector3(
          Math.sin(elapsed * 0.42) * 0.45,
          Math.sin(elapsed * 0.31) * 0.28,
          -0.22
        )
    const rawDigitalCenter = new THREE.Vector3(
      THREE.MathUtils.clamp(
        Math.min(
          trackedCenter.x - Math.min(viewport.width, viewport.height) * 0.34,
          -viewport.width * 0.22
        ),
        -viewport.width * 0.44,
        -viewport.width * 0.12
      ),
      trackedCenter.y * 0.9,
      -0.18
    )
    if (smoothedCenter.current.lengthSq() === 0) {
      smoothedCenter.current.copy(rawDigitalCenter)
    } else {
      smoothedCenter.current.lerp(rawDigitalCenter, 1 - Math.exp(-delta * 10))
    }
    const digitalCenter = smoothedCenter.current

    const faceScale = hasFace
      ? Math.max(1.2, Math.min(viewport.width, viewport.height) * face.height * 1.22)
      : 1.8 + Math.sin(elapsed * 0.7) * 0.08

    const geometry = pointsRef.current?.geometry
    const positionAttr = geometry?.getAttribute(
      'position'
    ) as THREE.BufferAttribute | undefined
    const colorAttr = geometry?.getAttribute(
      'color'
    ) as THREE.BufferAttribute | undefined

    const landmarks = hasFace ? face.landmarks : null
    const faceWidth = hasFace
      ? Math.max(faceScale * 0.6, Math.min(viewport.width, viewport.height) * face.width * 1.25)
      : faceScale * 0.65
    const faceDepth = faceScale * 0.34
    const dt = Math.min(delta, 0.033)
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const particle = particles[i]
      particle.life += dt * (0.45 + particle.pop * 0.02)
      particle.pop += dt * particle.popSpeed

      let target: THREE.Vector3
      let depthShade = 0.8
      const maskPoint = personMask
        ? samplePersonMask(particle.maskSample, personMask, face)
        : null

      if (maskPoint) {
        const personPoint = toWorld(maskPoint.x, maskPoint.y, viewport, 0)
        const relative = personPoint.sub(trackedCenter).multiplyScalar(1.02)
        const centered = relative.clone().multiplyScalar(1 - particle.centerMix)
        const popWave = Math.max(0, Math.sin(particle.pop)) ** 5
        const outward = centered.clone()
        if (outward.lengthSq() > 0.0001) outward.normalize()
        target = digitalCenter
          .clone()
          .add(centered)
          .addScaledVector(particle.offset, faceWidth * 0.012)
          .addScaledVector(outward, popWave * faceScale * 0.025)
        target.z += particle.offset.z * faceDepth * 0.16
        depthShade = THREE.MathUtils.clamp(maskPoint.confidence, 0.25, 1)
      } else if (landmarks?.length) {
        const lm = landmarks[particle.landmarkIndex % landmarks.length]
        const facePoint = toWorld(lm.x, lm.y, viewport, lm.z * 1.8)
        const baseRelative = facePoint.sub(trackedCenter).multiplyScalar(1.18)
        const relative = baseRelative
          .clone()
          .multiplyScalar(0.08 + (1 - particle.centerMix) * 0.92)
        const contourBoost = FACE_CONTOUR.includes(particle.landmarkIndex % landmarks.length)
          ? 1.65
          : HEAD_EXTRA_POINTS.includes(particle.landmarkIndex % landmarks.length)
            ? 1.35
            : FEATURE_POINTS.includes(particle.landmarkIndex % landmarks.length)
              ? 0.55
              : 0.82
        const outward = relative.clone()
        if (outward.lengthSq() > 0.0001) outward.normalize()
        const popWave = Math.max(0, Math.sin(particle.pop)) ** 5
        target = digitalCenter
          .clone()
          .add(relative)
          .addScaledVector(
            particle.offset,
            faceWidth * 0.018 * contourBoost
          )
          .addScaledVector(outward, popWave * faceScale * 0.045 * contourBoost)
        target.z += lm.z * faceDepth + particle.offset.z * faceDepth * 0.08
        depthShade = THREE.MathUtils.clamp(1 - Math.abs(lm.z) * 3.2, 0.25, 1)
      } else {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 * 9
        const radius = 0.25 + (i % 37) / 37
        target = digitalCenter.clone().add(
          new THREE.Vector3(
            Math.cos(angle) * radius * faceScale * 0.38,
            Math.sin(angle * 0.72) * radius * faceScale * 0.52,
            Math.sin(angle + elapsed) * faceDepth
          )
        )
      }

      const pulse = Math.sin(particle.pop + elapsed * 1.4 + i * 0.07)
      const pop = pulse > 0.94 ? (pulse - 0.94) * 0.55 : 0
      target.addScaledVector(particle.drift, 1 + pop)
      target.x += Math.sin(elapsed * 1.2 + i) * 0.001

      const index = i * 3
      particle.velocity.x += (target.x - positions[index]) * dt * 7.4
      particle.velocity.y += (target.y - positions[index + 1]) * dt * 7.4
      particle.velocity.z += (target.z - positions[index + 2]) * dt * 5.6
      particle.velocity.multiplyScalar(0.84)

      positions[index] += particle.velocity.x
      positions[index + 1] += particle.velocity.y
      positions[index + 2] += particle.velocity.z

      const color = colorA.clone().lerp(colorB, 1 - depthShade * 0.65)
      if (pop > 0.05) color.lerp(colorC, Math.min(1, pop))
      colors[index] = color.r
      colors[index + 1] = color.g
      colors[index + 2] = color.b
    }

    if (positionAttr) positionAttr.needsUpdate = true
    if (colorAttr) colorAttr.needsUpdate = true

    if (pointsRef.current) {
      pointsRef.current.rotation.z = Math.sin(elapsed * 0.19) * 0.018
    }

    status(
      hasFace
        ? 'Digital Shadow: rostro capturado'
        : 'Digital Shadow: buscando rostro / demo',
      now
    )
  })

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.015}
          vertexColors
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
}
