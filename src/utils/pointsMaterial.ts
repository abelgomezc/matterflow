// MatterFlow - ShaderMaterial para Points suaves con tamano y color por
// particula + textura (sprite). Permite llamas/humo/aire realistas donde cada
// particula varia de tamano segun su vida/velocidad. (c) 2026 Abel Gomez
import * as THREE from 'three'
import { glowSprite } from './textures'

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.01) discard;
    gl_FragColor = vec4(vColor, 1.0) * t;
  }
`

/** Material aditivo de puntos suaves (glow) con atributos aColor y aSize. */
export const makeSoftPointsMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: { uTex: { value: glowSprite() } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })