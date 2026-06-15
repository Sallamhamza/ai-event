"use client";

// components/ParticleAvatar.tsx
// Three.js hologram bust. Uses a module-level initialised flag to prevent
// React StrictMode from running init() twice and creating two canvases.

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

interface ParticleAvatarProps {
  speaking?: boolean;
  size?: number;
}

const HologramShader = {
  uniforms: {
    color: { value: new THREE.Color(0x00ccff) },
    density: { value: 140.0 },
    thickness: { value: 0.22 },
    opacity: { value: 1.0 },
  },
  vertexShader: `
    varying vec3 vLocalPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vLocalPosition = position;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3  color;
    uniform float density;
    uniform float thickness;
    uniform float opacity;
    varying vec3  vLocalPosition;
    varying vec3  vNormal;
    varying vec3  vViewPosition;
    void main() {
      float fraction   = fract(vLocalPosition.y * density);
      float line       = smoothstep(1.0 - thickness - 0.02, 1.0 - thickness, fraction);
      vec3  viewDir    = normalize(vViewPosition);
      vec3  normal     = normalize(vNormal);
      float rim        = 1.0 - max(dot(viewDir, normal), 0.0);
      float fresnel    = pow(rim, 3.5);
      float finalAlpha = line * (0.08 + fresnel * 0.92) * opacity;
      vec3  finalColor = mix(color, vec3(1.0), fresnel * 0.55);
      gl_FragColor     = vec4(finalColor, finalAlpha);
    }
  `,
};

function buildBustProfile(): THREE.Vector2[] {
  const raw: [number, number][] = [
    [0.001, 1.20], [0.18, 1.18], [0.38, 1.12],
    [0.58, 0.95], [0.68, 0.72], [0.70, 0.50],
    [0.68, 0.28], [0.64, 0.08], [0.54, -0.10],
    [0.38, -0.28], [0.26, -0.44], [0.22, -0.58],
    [0.21, -0.72], [0.26, -0.86], [0.48, -0.98],
    [0.78, -1.08], [1.10, -1.18], [1.35, -1.28],
    [1.48, -1.38], [1.50, -1.50], [1.38, -1.60],
    [0.001, -1.60],
  ];
  const spline = new THREE.CatmullRomCurve3(
    raw.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false, "catmullrom", 0.5
  );
  return spline.getPoints(100).map(p => new THREE.Vector2(p.x, p.y));
}

export default function ParticleAvatar({
  speaking = false,
  size = 400,
}: ParticleAvatarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const bustRef = useRef<THREE.Group | null>(null);
  const speakRef = useRef(speaking);
  const tRef = useRef(0);
  // This flag prevents StrictMode's second init() call from adding a canvas
  const initialisedRef = useRef(false);

  useEffect(() => { speakRef.current = speaking; }, [speaking]);

  const W = size;
  const H = Math.round(size * 1.22);

  const destroy = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = mountRef.current;
    const r = rendererRef.current;
    if (el && r && el.contains(r.domElement)) {
      el.removeChild(r.domElement);
    }
    r?.dispose();
    rendererRef.current = null;
    matRef.current = null;
    bustRef.current = null;
    initialisedRef.current = false;
  }, []);

  const init = useCallback(() => {
    // ── StrictMode guard ──────────────────────────────────────────────────────
    // React StrictMode calls useEffect cleanup + re-run in dev.
    // We track whether a live renderer already exists in the DOM and bail out.
    if (initialisedRef.current) return;
    const el = mountRef.current;
    if (!el) return;
    initialisedRef.current = true;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
    camera.position.set(0, -0.05, 5.8);
    camera.lookAt(0, -0.15, 0);

    // ── Material ──────────────────────────────────────────────────────────────
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(HologramShader.uniforms),
      vertexShader: HologramShader.vertexShader,
      fragmentShader: HologramShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    matRef.current = mat;

    // ── Geometry — single mesh ────────────────────────────────────────────────
    const geo = new THREE.LatheGeometry(buildBustProfile(), 128);
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1.0, 1.0, 0.80));
    geo.computeVertexNormals();

    const bust = new THREE.Group();
    bust.add(new THREE.Mesh(geo, mat));
    scene.add(bust);
    bustRef.current = bust;

    // ── Animation ─────────────────────────────────────────────────────────────
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      tRef.current += 0.016;
      const t = tRef.current;
      const spk = speakRef.current;

      bust.rotation.y = spk ? Math.sin(t * 3.2) * 0.05 : Math.sin(t * 0.5) * 0.015;
      bust.rotation.x = spk ? Math.sin(t * 2.5 + 1.2) * 0.02 : Math.sin(t * 0.35) * 0.008;
      bust.scale.y = spk ? 1 + Math.sin(t * 8.5) * 0.012 : 1 + Math.sin(t * 1.1) * 0.004;

      mat.uniforms.thickness.value = spk ? 0.22 + Math.sin(t * 14) * 0.09 : 0.22;
      mat.uniforms.opacity.value = spk ? 0.9 + Math.sin(t * 11) * 0.10 : 1.0;

      renderer.render(scene, camera);
    }
    animate();
  }, [W, H]);

  useEffect(() => {
    init();
    return destroy;
  }, [init, destroy]);

  return (
    <div
      ref={mountRef}
      style={{
        width: W,
        height: H,
        background: "transparent",
        filter: speaking
          ? "drop-shadow(0 0 32px rgba(0,200,255,0.75)) brightness(1.22)"
          : "drop-shadow(0 0 16px rgba(0,170,255,0.42)) brightness(1.08)",
        transition: "filter 0.5s ease",
      }}
    />
  );
}