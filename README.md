# MatterFlow

> Manipulacion de materia en tiempo real con gestos de mano.
> **© 2026 Abel Gomez. Todos los derechos reservados.**

MatterFlow usa la camara para detectar tus manos con **MediaPipe Hands** y te
deja manipular particulas fisicas en 3D con gestos naturales. Sin contrasenas,
sin servidor, sin instalacion de backend: abres el navegador, permites la
camara y manipulas materia con las manos en el aire.

Si no tienes camara (o MediaPipe no carga), el **mouse/touch** controla la
materia automaticamente y hay un **modo demo** que se anima solo.

---

## Requisitos

- **Node 20+** (probado tambien en Node 24)
- **Chrome o Edge** (mejor soporte WebGL + MediaPipe)
- Camara web (opcional: existe fallback de mouse/touch)

## Instalacion y arranque

```bash
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

## Descargar el modelo de MediaPipe

La deteccion de manos necesita `hand_landmarker.task` en `public/models/`.
Descargalo con:

```bash
curl -L -o public/models/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```

O bajalo manualmente desde esa URL y colocalo en `public/models/hand_landmarker.task`.
Sin este archivo, la camara no detecta manos pero el fallback de mouse/touch sigue funcionando.

---

## Guia de gestos

| Gesto | Icono | Accion |
|---|---|---|
| Palma abierta | 🖐️ | **Atraer** materia hacia la mano |
| Puno cerrado | ✊ | **Repeler** materia |
| Solo el indice | ☝️ | **Crear** materia nueva |
| Pinza (pulgar + indice) | 🤏 | **Congelar** la materia cercana |
| Giro de muneca | 🔄 | **Vortex** (remolino) |
| Dos manos | 🙌 | Campo especial entre ambas manos |

Con **mouse/touch**: mover = atraer, mantener presionado/click = repeler.

---

## Los 5 modos

Cambia entre ellos con la barra inferior (glassmorphism, con transicion suave).
Con la camara activa, el video se ve de fondo (espejo selfie) y la materia va encima:

1. **💥 Fuerza** (Star Wars) — **deforma el propio video de la camara**, sin
   objetos ficticios:
   - **Mano abierta = pulso**: emite una **onda expansiva** que empuja/distorsiona
     el entorno reflejado. Solo la mano abierta dispara el pulso.
   - **Cerrar la mano (puno/garra) = agarrar**: engancha la region del video que
     esta bajo tu mano en ese instante y la **arrastra/levanta** siguiendo la
     mano, con estrujado y temblor (estrangular estilo Vader). Al abrir, se suelta.
   - Sin camara, cae a una rejilla procedural para ver el efecto (con el mouse:
     mover = pulsos, mantener presionado = agarrar y arrastrar).
2. **✨ Particulas** — puntos de luz con fisica real (gravedad, friccion, rebote,
   trails y color por energia cinetica: azul → morado → cyan → blanco).
3. **🌀 Plasma** — arcos de energia violeta que siguen las puntas de los dedos;
   entre dos manos se forma un arco principal con chispas.
4. **⚡ Rayos Sith** — relampagos azul-blanco **ramificados** que se disparan
   desde las puntas de los dedos hacia afuera (estilo Sith de Star Wars).
5. **🌪️ Aire** — particulas arrastradas por un campo de flujo (curl-noise) que
   forma remolinos; la mano genera rafagas de viento.

**Controles:** boton **⏸️ Pausar / ▶️ Reanudar** para congelar la animacion en
cualquier momento.

---

## Stack tecnologico

| Tecnologia | Uso |
|---|---|
| React 18 + TypeScript 5 | Framework UI + tipado estricto |
| Vite 5 | Build tool / dev server |
| Three.js + @react-three/fiber | Motor 3D y particulas |
| @react-three/drei · postprocessing | Helpers + Bloom / aberracion cromatica |
| @mediapipe/tasks-vision | Deteccion de manos (Hand Landmarker, modo VIDEO) |
| Zustand | Estado global (modo, config, stats) en memoria |
| Tailwind CSS 3 | Estilos de la UI |
| Framer Motion | Transiciones entre modos de materia |

## Estructura

```
src/
├── components/
│   ├── canvas/   → MatterScene + los 5 sistemas de materia
│   ├── camera/   → HandTracker (MediaPipe) y CameraOverlay (mini vista)
│   └── ui/       → ModeSelector, StatsHUD, GestureGuide, Copyright, overlays
├── hooks/        → useHandTracking, useGestureDetection, useParticlePhysics
├── store/        → matterStore (Zustand) + pointerBus (bus imperativo)
├── types/        → hand.types, matter.types
└── utils/        → handUtils, physicsUtils, colorUtils
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — typecheck + build de produccion
- `npm run preview` — sirve el build de produccion
- `npm run typecheck` — solo verificacion de tipos

---

## Notas

- Todo el estado vive en memoria (Zustand). No se usa `localStorage`.
- La camara se activa con un boton explicito; nunca arranca sola.
- Los landmarks se espejean en horizontal (modo selfie).
- El copyright **© 2026 Abel Gomez** permanece visible en el canvas.

© 2026 Abel Gomez · MatterFlow. Todos los derechos reservados.