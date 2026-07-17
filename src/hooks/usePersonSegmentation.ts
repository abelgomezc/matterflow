// MatterFlow - MediaPipe ImageSegmenter para Digital Shadow.
// Segmenta la persona/cuerpo visible y publica una máscara simple.
// (c) 2026 Abel Gomez
import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

export interface PersonMask {
  width: number
  height: number
  data: Float32Array
}

/** Factor de suavizado temporal (0-1). Valores mas altos = mas estable pero
 *  mas lento a reaccionar. 0.45 quita el parpadeo de la mascara sin retraso
 *  molesto. */
const MASK_SMOOTHING = 0.45

/** La segmentacion es el modelo mas pesado. Limitarla a ~22 fps (en vez de
 *  correr en cada fotograma de video) libera GPU para face/pose y evita que
 *  los tres modelos se saturen mutuamente causando caidas de FPS. La mascara
 *  suavizada (MASK_SMOOTHING) oculta este paso mas lento. */
const SEGMENT_MIN_INTERVAL_MS = 45

const SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

export const usePersonSegmentation = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [mask, setMask] = useState<PersonMask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const segmenterRef = useRef<ImageSegmenter | null>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const lastVideoTimeRef = useRef(-1)
  const runningRef = useRef(false)
  const smoothRef = useRef<Float32Array | null>(null)
  const smoothSizeRef = useRef({ width: 0, height: 0 })
  const lastRunRef = useRef(0)

  const initMediaPipe = useCallback(async () => {
    if (segmenterRef.current) return segmenterRef.current

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      )
      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: SEGMENTER_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
      segmenterRef.current = segmenter
      setError(null)
      return segmenter
    } catch (e) {
      console.error('[MatterFlow] Error iniciando ImageSegmenter:', e)
      setError('No se pudo cargar segmentacion.')
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      segmenterRef.current?.close()
      segmenterRef.current = null
    }
  }, [])

  const startSegmentation = useCallback(async () => {
    if (runningRef.current) return
    const segmenter = await initMediaPipe()
    if (!segmenter) return

    runningRef.current = true

    const detect = () => {
      if (!runningRef.current) return
      const video = videoRef.current
      const activeSegmenter = segmenterRef.current
      if (!video || !activeSegmenter) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime
        const now = performance.now()
        // Throttle: no reprocesar la mascara en cada frame de video.
        if (now - lastRunRef.current >= SEGMENT_MIN_INTERVAL_MS) {
          lastRunRef.current = now
          try {
            activeSegmenter.segmentForVideo(
              video,
              now,
              (result) => {
                  const confidenceMask = result.confidenceMasks?.[0]
                  if (!confidenceMask) return
                  const raw = confidenceMask.getAsFloat32Array()
                  const w = confidenceMask.width
                  const h = confidenceMask.height
                  const sameSize =
                    smoothSizeRef.current.width === w &&
                    smoothSizeRef.current.height === h

                  // Suavizado exponencial del borde de la mascara: evita el
                  // parpadeo y los "saltos" de la segmentacion entre fotogramas.
                  let out: Float32Array
                  if (sameSize && smoothRef.current) {
                    const prev = smoothRef.current
                    for (let i = 0; i < raw.length; i += 1) {
                      prev[i] += (raw[i] - prev[i]) * MASK_SMOOTHING
                    }
                    out = prev
                  } else {
                    smoothRef.current = raw.slice()
                    smoothSizeRef.current = { width: w, height: h }
                    out = smoothRef.current
                  }

                  setMask({
                    width: w,
                    height: h,
                    data: out,
                  })
                }
              )
            } catch (e) {
              console.error('[MatterFlow] segmentForVideo:', e)
            }
          }
        }

      animFrameRef.current = requestAnimationFrame(detect)
    }
    detect()
  }, [initMediaPipe, videoRef])

  const stopSegmentation = useCallback(() => {
    runningRef.current = false
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    smoothRef.current = null
    smoothSizeRef.current = { width: 0, height: 0 }
    setMask(null)
  }, [])

  return { mask, error, startSegmentation, stopSegmentation }
}
