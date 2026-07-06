// MatterFlow - creador de universos con gestos de mano. (c) 2026 Abel Gomez
import { useEffect, useMemo, useRef, useState } from 'react'
import { Stars, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { handLandmarksBus } from '../camera/HandTracker'
import { useMatterStore } from '../../store/matterStore'
import { dist2D } from '../../utils/handUtils'
import type { HandData } from '../../hooks/useHandTracking'
import type { Landmark } from '../../types/hand.types'
import type { UniverseTool } from '../../types/matter.types'

const HOLD_TO_CLEAR_MS = 1200
const GRAVITY = 0.34

type BodyKind =
  | 'sun'
  | 'planet'
  | 'star'
  | 'meteor'
  | 'moon'
  | 'blackHole'
  | 'debris'

interface SpaceBody {
  id: number
  kind: BodyKind
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  color: string
  spin: number
  mass: number
  damage: number
  hasRing: boolean
}

interface Impact {
  id: number
  position: THREE.Vector3
  color: string
  size: number
}

const fingerExtended = (landmarks: Landmark[], tip: number, pip: number) =>
  dist2D(landmarks[0], landmarks[tip]) >
  dist2D(landmarks[0], landmarks[pip]) * 1.12

const poseOf = (hand: HandData) => {
  const landmarks = hand.landmarks
  const index = fingerExtended(landmarks, 8, 6)
  const middle = fingerExtended(landmarks, 12, 10)
  const ring = fingerExtended(landmarks, 16, 14)
  const pinky = fingerExtended(landmarks, 20, 18)
  // Umbral un poco generoso: no obliga a unir perfectamente los dedos.
  const pinching = dist2D(landmarks[4], landmarks[8]) < 0.06
  return {
    pointing: index && !middle && !ring && !pinky,
    victory: index && middle && !ring && !pinky,
    open: index && middle && ring && pinky,
    fist: !index && !middle && !ring && !pinky && !pinching,
    pinching,
  }
}

function SpaceBodyView({
  body,
  register,
}: {
  body: SpaceBody
  register: (id: number, group: THREE.Group | null) => void
}) {
  const [planetTexture, sunTexture] = useTexture([
    '/textures/alien-planet-surface.png',
    '/textures/solar-photosphere.png',
  ])
  useEffect(() => {
    for (const texture of [planetTexture, sunTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.anisotropy = 8
      texture.needsUpdate = true
    }
  }, [planetTexture, sunTexture])

  return (
    <group ref={(group) => register(body.id, group)}>
      {body.kind === 'sun' && (
        <>
          <mesh>
            <sphereGeometry args={[1, 64, 48]} />
            <meshStandardMaterial
              map={sunTexture}
              emissiveMap={sunTexture}
              emissive={body.color}
              emissiveIntensity={2.5}
              roughness={0.48}
            />
          </mesh>
          <mesh scale={1.22}>
            <sphereGeometry args={[1, 40, 30]} />
            <meshBasicMaterial
              color={body.color}
              transparent
              opacity={0.2}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight color={body.color} intensity={4.5} distance={16} />
        </>
      )}

      {body.kind === 'planet' && (
        <>
          <mesh>
            <sphereGeometry args={[1, 64, 48]} />
            <meshStandardMaterial
              map={planetTexture}
              bumpMap={planetTexture}
              bumpScale={0.045}
              color={body.color}
              emissive="#7F1D1D"
              emissiveIntensity={body.damage * 0.8}
              metalness={0.02}
              roughness={0.82}
            />
          </mesh>
          <mesh scale={1.035}>
            <sphereGeometry args={[1, 48, 36]} />
            <meshPhysicalMaterial
              color="#7DD3FC"
              transparent
              opacity={0.1}
              transmission={0.2}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          {body.hasRing && (
            <mesh rotation={[Math.PI / 2.6, 0, 0]}>
              <ringGeometry args={[1.28, 1.72, 96]} />
              <meshBasicMaterial
                color="#D6C7A1"
                transparent
                opacity={0.62}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
        </>
      )}

      {body.kind === 'moon' && (
        <mesh>
          <sphereGeometry args={[1, 40, 30]} />
          <meshStandardMaterial
            color={body.color}
            bumpMap={planetTexture}
            bumpScale={0.09}
            roughness={1}
          />
        </mesh>
      )}

      {body.kind === 'star' && (
        <>
          <mesh>
            <sphereGeometry args={[1, 40, 30]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh scale={1.55}>
            <sphereGeometry args={[1, 24, 18]} />
            <meshBasicMaterial
              color={body.color}
              transparent
              opacity={0.13}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
          <pointLight color={body.color} intensity={2} distance={7} />
        </>
      )}

      {(body.kind === 'meteor' || body.kind === 'debris') && (
        <>
          <mesh rotation={[0.4, 0.6, 0]}>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial
              color={body.color}
              roughness={0.95}
              flatShading
              emissive="#7C2D12"
              emissiveIntensity={0.18}
            />
          </mesh>
          {body.kind === 'meteor' && (
            <mesh position={[-1.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.55, 2.4, 10]} />
              <meshBasicMaterial
                color="#FB923C"
                transparent
                opacity={0.3}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          )}
        </>
      )}

      {body.kind === 'blackHole' && (
        <>
          <mesh>
            <sphereGeometry args={[1, 48, 36]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh rotation={[Math.PI / 2.35, 0, 0]}>
            <ringGeometry args={[1.25, 2.7, 128]} />
            <meshBasicMaterial
              color="#FDBA74"
              transparent
              opacity={0.82}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2.35, 0, 0]} scale={1.08}>
            <ringGeometry args={[1.5, 2.15, 128]} />
            <meshBasicMaterial
              color="#FFFFFF"
              transparent
              opacity={0.38}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  )
}

function ImpactBurst({
  impact,
  onDone,
}: {
  impact: Impact
  onDone: (id: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.PointsMaterial>(null)
  const elapsed = useRef(0)
  const positions = useMemo(() => {
    const result = new Float32Array(240 * 3)
    for (let i = 0; i < 240; i += 1) {
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      )
        .normalize()
        .multiplyScalar(0.3 + Math.random() * impact.size)
      result[i * 3] = direction.x
      result[i * 3 + 1] = direction.y
      result[i * 3 + 2] = direction.z
    }
    return result
  }, [impact.size])

  useFrame((_, delta) => {
    elapsed.current += delta
    const progress = elapsed.current / 1.25
    if (group.current) group.current.scale.setScalar(0.2 + progress * 2.4)
    if (material.current) material.current.opacity = Math.max(0, 1 - progress)
    if (elapsed.current >= 1.25) onDone(impact.id)
  })

  return (
    <group ref={group} position={impact.position}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={material}
          color={impact.color}
          size={0.09}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight color={impact.color} intensity={5} distance={8} />
    </group>
  )
}

export default function UniverseCreationSystem() {
  const { viewport } = useThree()
  const [bodies, setBodies] = useState<SpaceBody[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
  const bodiesRef = useRef<SpaceBody[]>([])
  const bodyGroups = useRef(new Map<number, THREE.Group>())
  const nextId = useRef(1)
  const nextImpactId = useRef(1)
  const pinchLatched = useRef(false)
  const draggedBody = useRef<number | null>(null)
  const lastDragPosition = useRef(new THREE.Vector3())
  const clearStartedAt = useRef<number | null>(null)
  const clearLatched = useRef(false)
  const lastStatus = useRef({ text: '', at: 0 })

  const setCurrentGesture = useMatterStore((state) => state.setCurrentGesture)
  const setParticleCount = useMatterStore((state) => state.setParticleCount)
  const universeTool = useMatterStore((state) => state.universeTool)
  const universeResetToken = useMatterStore(
    (state) => state.universeResetToken
  )
  const universePresetToken = useMatterStore(
    (state) => state.universePresetToken
  )

  const toWorld = (x: number, y: number) =>
    new THREE.Vector3(
      (x - 0.5) * viewport.width,
      (0.5 - y) * viewport.height,
      0
    )

  const status = (text: string, now = performance.now()) => {
    if (lastStatus.current.text !== text || now - lastStatus.current.at > 250) {
      lastStatus.current = { text, at: now }
      setCurrentGesture(text)
    }
  }

  const syncBodies = () => {
    setBodies([...bodiesRef.current])
    setParticleCount(bodiesRef.current.length * 300)
  }

  const nearestBody = (position: THREE.Vector3, extraRange = 0.65) => {
    let nearest: SpaceBody | null = null
    let nearestDistance = Infinity
    for (const body of bodiesRef.current) {
      const distance = body.position.distanceTo(position)
      if (distance < body.radius + extraRange && distance < nearestDistance) {
        nearest = body
        nearestDistance = distance
      }
    }
    return nearest
  }

  const addBody = (
    kind: BodyKind,
    position: THREE.Vector3,
    radius: number,
    initialVelocity?: THREE.Vector3,
    sync = true
  ): SpaceBody => {
    // Mantiene fluida la escena incluso después de una sesión larga.
    if (bodiesRef.current.length >= 48) {
      const removed = bodiesRef.current.shift()
      if (removed) bodyGroups.current.delete(removed.id)
    }
    const palette: Record<BodyKind, string[]> = {
      sun: ['#FDB813', '#FF7A1A', '#FFE8A3', '#A5D8FF', '#FFB4A2'],
      planet: ['#FFFFFF', '#FFD6A5', '#BDE0FE', '#D8F3DC', '#FFADAD'],
      star: ['#F8FAFC', '#A5F3FC', '#DDD6FE', '#FDE68A'],
      meteor: ['#78716C', '#A8A29E', '#92400E'],
      moon: ['#D6D3D1', '#A8A29E', '#E7E5E4'],
      blackHole: ['#000000'],
      debris: ['#57534E', '#78716C', '#A16207'],
    }
    const colors = palette[kind]
    const color = colors[nextId.current % colors.length]
    const velocity = initialVelocity?.clone() ?? new THREE.Vector3()

    if (!initialVelocity && kind === 'planet') {
      const suns = bodiesRef.current.filter(
        (body) => body.kind === 'sun' || body.kind === 'star'
      )
      const sun = suns.sort(
        (a, b) => a.position.distanceTo(position) - b.position.distanceTo(position)
      )[0]
      if (sun) {
        const radial = position.clone().sub(sun.position)
        const distance = Math.max(radial.length(), 0.8)
        velocity
          .set(-radial.y, radial.x, 0)
          .normalize()
          .multiplyScalar(Math.sqrt((GRAVITY * sun.mass) / distance))
          .add(sun.velocity)
      } else {
        velocity.set((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, 0)
      }
    } else if (!initialVelocity && kind === 'moon') {
      const planets = bodiesRef.current.filter((body) => body.kind === 'planet')
      const planet = planets.sort(
        (a, b) => a.position.distanceTo(position) - b.position.distanceTo(position)
      )[0]
      if (planet) {
        const radial = position.clone().sub(planet.position)
        const distance = Math.max(radial.length(), planet.radius + radius + 0.15)
        velocity
          .set(-radial.y, radial.x, 0)
          .normalize()
          .multiplyScalar(Math.sqrt((GRAVITY * planet.mass) / distance))
          .add(planet.velocity)
      }
    } else if (!initialVelocity && (kind === 'meteor' || kind === 'debris')) {
      velocity.set(
        1.1 + Math.random() * 0.9,
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 0.65
      )
    } else if (!initialVelocity) {
      velocity.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, 0)
    }

    const density: Record<BodyKind, number> = {
      sun: 10,
      star: 7,
      planet: 2.4,
      moon: 1.5,
      meteor: 0.45,
      debris: 0.18,
      blackHole: 38,
    }
    const body: SpaceBody = {
      id: nextId.current,
      kind,
      position: position.clone(),
      velocity,
      radius,
      color,
      spin: (Math.random() - 0.5) * 1.2,
      mass: density[kind] * Math.max(radius ** 3, 0.025),
      damage: 0,
      hasRing: kind === 'planet' && Math.random() < 0.38,
    }
    bodiesRef.current.push(body)
    nextId.current += 1
    if (sync) syncBodies()
    return body
  }

  const clearUniverse = (now: number) => {
    bodiesRef.current = []
    setImpacts([])
    draggedBody.current = null
    bodyGroups.current.clear()
    syncBodies()
    status('Universo: espacio limpio', now)
  }

  const createSolarSystemPreset = () => {
    bodiesRef.current = []
    bodyGroups.current.clear()
    const center = new THREE.Vector3(0, 0, 0)
    const sun = addBody('sun', center, 0.72, new THREE.Vector3(), false)
    const maxOrbit = Math.min(viewport.width * 0.42, viewport.height * 0.46)
    const planetCount = 5

    for (let i = 0; i < planetCount; i += 1) {
      const distance = 1.25 + (i / (planetCount - 1)) * (maxOrbit - 1.25)
      const angle = i * 2.17
      const inclination = (i - 2) * 0.075
      const position = new THREE.Vector3(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance * Math.cos(inclination),
        Math.sin(angle) * distance * Math.sin(inclination)
      )
      const speed = Math.sqrt((GRAVITY * sun.mass) / distance)
      const velocity = new THREE.Vector3(
        -Math.sin(angle) * speed,
        Math.cos(angle) * speed * Math.cos(inclination),
        Math.cos(angle) * speed * Math.sin(inclination)
      )
      const planet = addBody(
        'planet',
        position,
        0.25 + i * 0.055,
        velocity,
        false
      )

      const moonCount = i % 3
      for (let moonIndex = 0; moonIndex < moonCount; moonIndex += 1) {
        const moonDistance = planet.radius + 0.28 + moonIndex * 0.18
        const moonAngle = angle + moonIndex * Math.PI
        const moonPosition = planet.position
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(moonAngle) * moonDistance,
              Math.sin(moonAngle) * moonDistance * Math.cos(inclination),
              Math.sin(moonAngle) * moonDistance * Math.sin(inclination)
            )
          )
        const moonSpeed = Math.sqrt(
          (GRAVITY * planet.mass) / moonDistance
        )
        const moonVelocity = planet.velocity
          .clone()
          .add(
            new THREE.Vector3(
              -Math.sin(moonAngle) * moonSpeed,
              Math.cos(moonAngle) * moonSpeed * Math.cos(inclination),
              Math.cos(moonAngle) * moonSpeed * Math.sin(inclination)
            )
          )
        addBody('moon', moonPosition, 0.09, moonVelocity, false)
      }
    }
    syncBodies()
    status('Universo: sistema solar dinamico creado')
  }

  const spawnImpact = (
    position: THREE.Vector3,
    color: string,
    size: number
  ) => {
    const impact: Impact = {
      id: nextImpactId.current,
      position: position.clone(),
      color,
      size,
    }
    nextImpactId.current += 1
    setImpacts((current) => [...current, impact])
  }

  const resolveCollisions = (now: number) => {
    const current = bodiesRef.current
    const removed = new Set<number>()
    const fragments: {
      position: THREE.Vector3
      velocity: THREE.Vector3
      radius: number
    }[] = []
    let changed = false

    const shatter = (body: SpaceBody, impulse: THREE.Vector3) => {
      removed.add(body.id)
      const count = Math.min(9, Math.max(4, Math.round(body.radius * 9)))
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.35
        fragments.push({
          position: body.position.clone(),
          velocity: body.velocity
            .clone()
            .add(impulse)
            .add(
              new THREE.Vector3(
                Math.cos(angle) * (0.45 + Math.random()),
                Math.sin(angle) * (0.45 + Math.random()),
                0
              )
            ),
          radius: Math.max(0.045, body.radius / (count * 0.72)),
        })
      }
    }

    for (let i = 0; i < current.length; i += 1) {
      const a = current[i]
      if (removed.has(a.id)) continue
      for (let j = i + 1; j < current.length; j += 1) {
        const b = current[j]
        if (removed.has(b.id)) continue
        const collisionDistance = (a.radius + b.radius) * 0.72
        if (a.position.distanceToSquared(b.position) > collisionDistance ** 2) {
          continue
        }

        const relativeVelocity = a.velocity.clone().sub(b.velocity)
        const impactSpeed = relativeVelocity.length()
        const impactPosition = a.position.clone().lerp(b.position, 0.5)
        const blackHole =
          a.kind === 'blackHole' ? a : b.kind === 'blackHole' ? b : null

        if (blackHole) {
          const victim = blackHole === a ? b : a
          removed.add(victim.id)
          blackHole.mass += victim.mass
          blackHole.radius = Math.min(
            2.4,
            Math.cbrt(blackHole.radius ** 3 + victim.radius ** 3 * 0.3)
          )
          spawnImpact(impactPosition, '#C084FC', victim.radius * 1.5)
          status('Evento: el agujero negro absorbio un cuerpo', now)
          changed = true
          continue
        }

        const luminousA = a.kind === 'sun' || a.kind === 'star'
        const luminousB = b.kind === 'sun' || b.kind === 'star'
        if (luminousA !== luminousB) {
          const star = luminousA ? a : b
          const victim = luminousA ? b : a
          removed.add(victim.id)
          star.mass += victim.mass * 0.25
          star.radius = Math.min(
            2.2,
            Math.cbrt(star.radius ** 3 + victim.radius ** 3 * 0.18)
          )
          spawnImpact(impactPosition, '#FDBA74', victim.radius * 1.8)
          status('Evento: una estrella consumio materia', now)
          changed = true
          continue
        }

        const projectileA = a.kind === 'meteor' || a.kind === 'debris'
        const projectileB = b.kind === 'meteor' || b.kind === 'debris'
        if (projectileA !== projectileB) {
          const projectile = projectileA ? a : b
          const target = projectileA ? b : a
          removed.add(projectile.id)
          const energy =
            (projectile.mass * Math.max(impactSpeed ** 2, 0.2)) /
            Math.max(target.mass, 0.05)
          target.damage += energy * 2.8
          target.radius *= Math.max(0.72, 1 - energy * 0.12)
          spawnImpact(
            impactPosition,
            '#FF7A18',
            Math.max(0.35, projectile.radius * 3 + impactSpeed * 0.25)
          )
          if (
            target.damage >= 1 ||
            (impactSpeed > 1.8 && projectile.radius > target.radius * 0.45)
          ) {
            shatter(target, relativeVelocity.multiplyScalar(0.16))
            status('Evento: impacto catastrofico, cuerpo fragmentado', now)
          } else {
            target.velocity.add(
              projectile.velocity
                .clone()
                .multiplyScalar(projectile.mass / Math.max(target.mass, 0.05))
            )
            status('Evento: impacto, crater y cambio de orbita', now)
          }
          changed = true
          continue
        }

        const totalMass = a.mass + b.mass
        const survivor = a.mass >= b.mass ? a : b
        const consumed = survivor === a ? b : a
        survivor.velocity
          .multiplyScalar(survivor.mass)
          .add(consumed.velocity.clone().multiplyScalar(consumed.mass))
          .divideScalar(totalMass)
        survivor.mass = totalMass
        survivor.radius = Math.min(
          2.5,
          Math.cbrt(survivor.radius ** 3 + consumed.radius ** 3)
        )
        survivor.damage = Math.min(1, survivor.damage + impactSpeed * 0.2)
        removed.add(consumed.id)
        spawnImpact(
          impactPosition,
          impactSpeed > 1 ? '#FFFFFF' : '#60A5FA',
          survivor.radius
        )
        status(
          impactSpeed > 1
            ? 'Evento: colision violenta y fusion'
            : 'Evento: dos cuerpos se fusionaron',
          now
        )
        changed = true
      }
    }

    if (changed) {
      bodiesRef.current = current.filter((body) => !removed.has(body.id))
      for (const fragment of fragments) {
        addBody(
          'debris',
          fragment.position,
          fragment.radius,
          fragment.velocity,
          false
        )
      }
      syncBodies()
    }
  }

  useEffect(() => {
    setParticleCount(0)
    return () => setParticleCount(0)
  }, [setParticleCount])

  useEffect(() => {
    if (universeResetToken > 0) clearUniverse(performance.now())
    // El token representa una orden, no estado persistente del sistema.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universeResetToken])

  useEffect(() => {
    if (universePresetToken > 0) createSolarSystemPreset()
    // El token representa una orden, no estado persistente del sistema.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universePresetToken])

  useFrame((_, delta) => {
    const now = performance.now()
    const hands = handLandmarksBus.hands
    const hand = hands[0]
    const poses = hands.map(poseOf)
    const twoFists = poses.length === 2 && poses.every((pose) => pose.fist)

    if (twoFists) {
      clearStartedAt.current ??= now
      if (
        !clearLatched.current &&
        now - clearStartedAt.current >= HOLD_TO_CLEAR_MS
      ) {
        clearLatched.current = true
        clearUniverse(now)
      } else {
        status('Universo: manten dos punos para limpiar', now)
      }
    } else {
      clearStartedAt.current = null
      clearLatched.current = false
    }

    if (hand && !twoFists) {
      const pose = poses[0]
      const handPosition = toWorld(hand.x, hand.y)
      const indexPosition = toWorld(
        hand.landmarks[8].x,
        hand.landmarks[8].y
      )
      const touched = nearestBody(handPosition)

      if (pose.pinching) {
        if (!pinchLatched.current) {
          const selected = nearestBody(indexPosition, 1.05)
          if (selected) {
            draggedBody.current = selected.id
            lastDragPosition.current.copy(indexPosition)
          } else {
            const size: Record<UniverseTool, number> = {
              planet: 0.58,
              sun: 0.72,
              star: 0.3,
              meteor: 0.25,
              moon: 0.16,
              blackHole: 0.42,
            }
            addBody(universeTool, indexPosition, size[universeTool])
            const names: Record<UniverseTool, string> = {
              planet: 'planeta',
              sun: 'sol',
              star: 'estrella',
              meteor: 'meteorito',
              moon: 'luna',
              blackHole: 'agujero negro',
            }
            status(`Universo: ${names[universeTool]} creado`, now)
          }
        }
        const dragged = bodiesRef.current.find(
          (body) => body.id === draggedBody.current
        )
        if (dragged) {
          const movement = indexPosition.clone().sub(lastDragPosition.current)
          dragged.position.copy(indexPosition)
          dragged.velocity.copy(movement.multiplyScalar(1 / Math.max(delta, 0.01)))
          dragged.velocity.clampLength(0, 3.5)
          lastDragPosition.current.copy(indexPosition)
          status('Universo: moviendo astro', now)
        }
      } else if (pinchLatched.current) {
        draggedBody.current = null
      }
      pinchLatched.current = pose.pinching

      if (pose.open && touched) {
        const previousRadius = touched.radius
        touched.radius = Math.min(2.5, touched.radius + delta * 0.42)
        touched.mass *= (touched.radius / previousRadius) ** 3
        status('Universo: agrandando astro', now)
      } else if (!pose.pinching) {
        status('Universo: haz pinza para colocar el astro elegido', now)
      }
    } else if (!hand) {
      pinchLatched.current = false
      draggedBody.current = null
    }

    const simulationDelta = Math.min(delta, 0.033)
    const simulatedBodies = bodiesRef.current
    const accelerations = new Map<number, THREE.Vector3>()
    for (const body of simulatedBodies) {
      accelerations.set(body.id, new THREE.Vector3())
    }
    for (let i = 0; i < simulatedBodies.length; i += 1) {
      const a = simulatedBodies[i]
      for (let j = i + 1; j < simulatedBodies.length; j += 1) {
        const b = simulatedBodies[j]
        const direction = b.position.clone().sub(a.position)
        const distanceSquared = Math.max(direction.lengthSq(), 0.12)
        direction.normalize()
        if (a.id !== draggedBody.current) {
          accelerations
            .get(a.id)
            ?.addScaledVector(direction, (GRAVITY * b.mass) / distanceSquared)
        }
        if (b.id !== draggedBody.current) {
          accelerations
            .get(b.id)
            ?.addScaledVector(direction, (-GRAVITY * a.mass) / distanceSquared)
        }
      }
    }

    for (const body of simulatedBodies) {
      if (body.id !== draggedBody.current) {
        body.velocity.addScaledVector(
          accelerations.get(body.id) ?? new THREE.Vector3(),
          simulationDelta
        )
        const maxSpeed =
          body.kind === 'meteor' || body.kind === 'debris'
            ? 4
            : body.kind === 'blackHole'
              ? 0.9
              : 2.6
        body.velocity.clampLength(0, maxSpeed)
        body.position.addScaledVector(body.velocity, simulationDelta)
      }
    }

    resolveCollisions(now)

    const halfWidth = viewport.width / 2
    const halfHeight = viewport.height / 2
    for (const body of bodiesRef.current) {
      const limitX = Math.max(halfWidth - body.radius, 0.5)
      const limitY = Math.max(halfHeight - body.radius, 0.5)
      if (Math.abs(body.position.x) > limitX) {
        body.position.x = THREE.MathUtils.clamp(body.position.x, -limitX, limitX)
        body.velocity.x *= -0.88
      }
      if (Math.abs(body.position.y) > limitY) {
        body.position.y = THREE.MathUtils.clamp(body.position.y, -limitY, limitY)
        body.velocity.y *= -0.88
      }
      if (Math.abs(body.position.z) > 3.2) {
        body.position.z = THREE.MathUtils.clamp(body.position.z, -3.2, 3.2)
        body.velocity.z *= -0.88
      }

      const group = bodyGroups.current.get(body.id)
      if (group) {
        group.position.copy(body.position)
        group.scale.setScalar(body.radius)
        group.rotation.y += body.spin * delta
        if (body.kind === 'meteor' || body.kind === 'debris') {
          group.rotation.z = Math.atan2(body.velocity.y, body.velocity.x)
        }
      }
    }
  })

  return (
    <>
      <Stars
        radius={45}
        depth={30}
        count={900}
        factor={2}
        saturation={0.35}
        fade
        speed={0.25}
      />

      {bodies.map((body) => (
        <SpaceBodyView
          key={body.id}
          body={body}
          register={(id, group) => {
            if (group) bodyGroups.current.set(id, group)
            else bodyGroups.current.delete(id)
          }}
        />
      ))}

      {impacts.map((impact) => (
        <ImpactBurst
          key={impact.id}
          impact={impact}
          onDone={(id) =>
            setImpacts((current) =>
              current.filter((candidate) => candidate.id !== id)
            )
          }
        />
      ))}
    </>
  )
}
