import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CINEMA_ENABLED, cinemaCapability } from "../../core/scene3d-flags.ts";

/** Browser-local scene shape (mirrors core Scene3D; validated server-side on save). */
export type CinemaSceneLocal = {
  format: "yamakan.scene3d";
  formatVersion: 1;
  id: string;
  units: "metres";
  eulerOrder: "XYZ";
  camera: {
    focalLengthMm: number;
    sensorWidthMm: number;
    near: number;
    far: number;
  };
  items: Array<{
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    assetId: string | null;
    color?: string;
    visible?: boolean;
  }>;
};

const SAMPLE_SCENE: CinemaSceneLocal = {
  format: "yamakan.scene3d",
  formatVersion: 1,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  units: "metres",
  eulerOrder: "XYZ",
  camera: {
    focalLengthMm: 35,
    sensorWidthMm: 36,
    near: 0.1,
    far: 1000,
  },
  items: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "cube",
      position: { x: 0, y: 0.5, z: -2 },
      rotation: { x: 0, y: 0.4, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      assetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      color: "#6b8cae",
    },
  ],
};

function assertLocalScene(raw: unknown): CinemaSceneLocal {
  const s = raw as CinemaSceneLocal;
  if (
    !s ||
    s.format !== "yamakan.scene3d" ||
    s.formatVersion !== 1 ||
    s.units !== "metres" ||
    !Array.isArray(s.items)
  ) {
    throw new Error("Invalid local Cinema scene");
  }
  for (const item of s.items) {
    if (item.assetId != null && typeof item.assetId !== "string") {
      throw new Error("Cinema items may only carry asset ids, not URLs");
    }
    if (
      typeof item.assetId === "string" &&
      (/^https?:/i.test(item.assetId) || item.assetId.includes("://"))
    ) {
      throw new Error("Remote media URLs are refused in Cinema items");
    }
  }
  return s;
}

export type YamakanCinemaHandle = {
  getScene: () => CinemaSceneLocal;
  setScene: (raw: unknown) => CinemaSceneLocal;
  getItemCount: () => number;
  getCameraPose: () => { x: number; y: number; z: number };
  orbitBy: (dx: number, dy: number) => void;
  aiCameraAvailable: () => boolean;
};

declare global {
  interface Window {
    __yamakanCinema?: YamakanCinemaHandle;
  }
}

type Props = {
  initialScene?: CinemaSceneLocal;
  // False while another workspace is open: the loop draws nothing.
  active?: boolean;
};

/**
 * Supported Cinema preview: local Three.js scene, asset ids only (no remote URLs).
 * AI-conditioned camera is not wired.
 */
export function CinemaViewport({
  initialScene = SAMPLE_SCENE,
  active = true,
}: Props) {
  // Hidden (another workspace is open): the scene is kept, nothing is drawn.
  const activeRef = useRef(active);
  activeRef.current = active;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const sceneRef = useRef<CinemaSceneLocal>(initialScene);

  useEffect(() => {
    const cap = cinemaCapability();
    if (!CINEMA_ENABLED) {
      setStatus(`disabled: ${cap.reason ?? "unavailable"}`);
      return;
    }
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const width = Math.max(320, host.clientWidth || 640);
    const height = 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("data-testid", "cinema-canvas");

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x1a1d21);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(2.5, 2, 4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(3, 5, 2);
    threeScene.add(light);
    threeScene.add(new THREE.AmbientLight(0xffffff, 0.35));
    threeScene.add(new THREE.GridHelper(10, 10, 0x444444, 0x333333));

    const meshes = new Map<string, THREE.Mesh>();

    const syncMeshes = (doc: CinemaSceneLocal) => {
      for (const [id, mesh] of meshes) {
        if (!doc.items.some((i) => i.id === id)) {
          threeScene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          meshes.delete(id);
        }
      }
      for (const item of doc.items) {
        let mesh = meshes.get(item.id);
        if (!mesh) {
          const color = new THREE.Color(item.color ?? "#888888");
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color }),
          );
          mesh.name = item.name || item.id;
          mesh.userData.assetId = item.assetId;
          threeScene.add(mesh);
          meshes.set(item.id, mesh);
        }
        mesh.position.set(item.position.x, item.position.y, item.position.z);
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
        mesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
        mesh.visible = item.visible !== false;
      }
    };

    syncMeshes(sceneRef.current);

    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      if (activeRef.current) {
        controls.update();
        renderer.render(threeScene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.__yamakanCinema = {
      getScene: () => sceneRef.current,
      setScene: (raw) => {
        const next = assertLocalScene(raw);
        sceneRef.current = next;
        syncMeshes(next);
        return next;
      },
      getItemCount: () => sceneRef.current.items.length,
      getCameraPose: () => ({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      }),
      orbitBy: (dx, dy) => {
        const offset = new THREE.Vector3().subVectors(
          camera.position,
          controls.target,
        );
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += (-dx * Math.PI) / 180;
        spherical.phi = Math.max(
          0.01,
          Math.min(Math.PI - 0.01, spherical.phi + (-dy * Math.PI) / 180),
        );
        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);
        controls.update();
      },
      aiCameraAvailable: () => false,
    };

    setStatus("mounted");
    setError(null);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      delete window.__yamakanCinema;
      controls.dispose();
      renderer.dispose();
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (!CINEMA_ENABLED) {
    return (
      <section
        data-testid="cinema-viewport"
        data-cinema-enabled="false"
        data-cinema-status={status}
        aria-label="Cinema viewport"
      >
        <p data-testid="cinema-disabled-reason">{cinemaCapability().reason}</p>
      </section>
    );
  }

  return (
    <section
      data-testid="cinema-viewport"
      data-cinema-enabled="true"
      data-cinema-status={status}
      data-ai-camera="disabled"
      aria-label="Cinema viewport"
    >
      <div
        ref={hostRef}
        data-testid="cinema-surface"
        style={{ width: "100%", minHeight: 360 }}
      />
      {error ? (
        <p role="alert" data-testid="cinema-error">
          {error}
        </p>
      ) : null}
      <p data-testid="cinema-units">units: metres · euler: XYZ</p>
      <p data-testid="cinema-unsupported">
        unsupported: {(cinemaCapability().unsupported ?? []).join(", ")}
      </p>
    </section>
  );
}
