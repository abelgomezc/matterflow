// MatterFlow - MediaPipe Pose en modo VIDEO para esqueleto corporal.
// (c) 2026 Abel Gomez
import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Landmark } from '../types/hand.types'

export interface PoseLandmark extends Landmark {
  visibility?: number
}

export interface PoseData {
  landmarks: PoseLandmark[]
}

const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

export const usePoseTracking = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [poses, setPoses] = useState<PoseData[]>([])
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const lastVideoTimeRef = useRef(-1)
  const runningRef = useRef(false)
  /** Estado suavizado (lerp) del esqueleto para evitar temblores. */
  const smoothRef = useRef<PoseData[]>([])

/** Factor de suavizado del esqueleto (0-1). 0.5 = mezcla mitad/medio por
 *  frame; quita el jitter de MediaPipe manteniendo buena reactividad. */
const POSE_SMOOTHING = 0.5

const lerpPose = (prev: PoseData[] | undefined, next: PoseData[]): PoseData[] => {
  if (!prev || prev.length !== next.length) return next
  return next.map((pose, pi) => {
    const before = prev[pi]?.landmarks ?? []
    return {
      landmarks: pose.landmarks.map((point, i) => {
        const b = before[i]
        if (!b) return point
        return {
          x: b.x + (point.x - b.x) * POSE_SMOOTHING,
          y: b.y + (point.y - b.y) * POSE_SMOOTHING,
          z: b.z + (point.z - b.z) * POSE_SMOOTHING,
          visibility: point.visibility,
        }
      }),
    }
  })
}

  const initMediaPipe = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      )
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 4,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      })
      landmarkerRef.current = landmarker
      setError(null)
      return landmarker
    } catch (e) {
      console.error('[MatterFlow] Error iniciando PoseLandmarker:', e)
      setError('No se pudo cargar pose tracking.')
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const startDetection = useCallback(async () => {
    if (runningRef.current) return
    const landmarker = await initMediaPipe()
    if (!landmarker) return

    runningRef.current = true

    const detect = () => {
      if (!runningRef.current) return
      const video = videoRef.current
      const activeLandmarker = landmarkerRef.current
      if (!video || !activeLandmarker) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime
        try {
          const results = activeLandmarker.detectForVideo(video, performance.now())
          if (results.landmarks.length > 0) {
            const raw = results.landmarks.map((landmarks) => ({
              landmarks: landmarks.map((point) => ({
                x: 1 - point.x,
                y: point.y,
                z: point.z,
                visibility: point.visibility,
              })),
            }))
            smoothRef.current = lerpPose(smoothRef.current, raw)
            setPoses(smoothRef.current)
          } else {
            smoothRef.current = []
            setPoses((prev) => (prev.length === 0 ? prev : []))
          }
        } catch (e) {
          console.error('[MatterFlow] pose detectForVideo:', e)
        }
      }
      animFrameRef.current = requestAnimationFrame(detect)
    }
    detect()
  }, [initMediaPipe, videoRef])

  const stopDetection = useCallback(() => {
    runningRef.current = false
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    smoothRef.current = []
    setPoses([])
  }, [])

  return { poses, error, startDetection, stopDetection }
}
