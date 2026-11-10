import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CINEMA_ENABLED, cinemaCapability } from "../../core/scene3d-flags.ts";
import {
  CINEMA_LENS_PRESETS_MM,
  assertCinemaCameraOptics,
  cinemaVerticalFovDegrees,
  type CinemaCameraOptics,
} from "./cinemaCameraOptics.ts";
import {
  cinemaCanEdit,
  cinemaCanReopen,
  cinemaCanSave,
  cinemaChangedState,
  loadProjectScene,
  saveProjectScene,
  storedSceneHash,
  type CinemaProjectClient,
  type CinemaSaveState,
  CINEMA_SAMPLE_SCENE as SAMPLE_SCENE,
  freshCinemaScene as freshScene,
} from "./cinemaProject.ts";
import {
  CINEMA_NUDGE,
  CINEMA_PAGE_MAX_ITEMS,
  addCinemaBox,
  cinemaItemReadout,
  moveCinemaItem,
  removeCinemaItem,
  scaleCinemaItem,
  turnCinemaItem,
  type CinemaAxis,
} from "./cinemaObjects.ts";
import type { MessageKey } from "../i18n.ts";

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
  assertCinemaCameraOptics(s.camera);
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
  t?: (key: MessageKey, vars?: Record<string, string | number>) => string;
  // The open project: its Cinema scene is opened, and saved when the person chooses.
  project?: { id: string; revision: number } | null;
  client?: CinemaProjectClient;
  onSaved?: (projectId: string, from: number, to: number) => void;
  registerUnsaved?: (isUnsaved: () => boolean) => () => void;
};

/**
 * Supported Cinema preview: local Three.js scene, asset ids only (no remote URLs).
 * AI-conditioned camera is not wired.
 */
export function CinemaViewport({
  initialScene = SAMPLE_SCENE,
  active = true,
  t = (key) => key,
  project = null,
  client,
  onSaved,
  registerUnsaved,
}: Props) {
  // Hidden (another workspace is open): the scene is kept, nothing is drawn.
  const activeRef = useRef(active);
  activeRef.current = active;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const sceneRef = useRef<CinemaSceneLocal>(initialScene);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [lensMm, setLensMm] = useState(initialScene.camera.focalLengthMm);
  // The object the inspector edits, and a counter that redraws it after an edit.
  const [selectedId, setSelectedId] = useState<string | null>(
    initialScene.items[0]?.id ?? null,
  );
  const [, setEdits] = useState(0);
  // Kept in state so a scene set from outside, with the same lens but another sensor, shows too.
  const [fovDeg, setFovDeg] = useState(() =>
    cinemaVerticalFovDegrees(initialScene.camera, 16 / 9),
  );
  // Set by the mount below: redraws the meshes for a scene.
  const syncRef = useRef<((scene: CinemaSceneLocal) => void) | null>(null);

  // The project's scene: saved only when the person chooses.
  const projectId = project?.id ?? null;
  const [save, setSave] = useState<CinemaSaveState | null>(null);
  const [persistence, setPersistence] = useState<boolean | null>(null);
  const [turnedOff, setTurnedOff] = useState(false);
  const [reloads, setReloads] = useState(0);
  const documentIdRef = useRef<string | null>(null);
  const savedHashRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  // Read by the Three.js handle, which is made once.
  const saveRef = useRef<CinemaSaveState | null>(null);
  saveRef.current = save;
  // The newest project revision known here (the editor's saves advance it too).
  const revision = useRef(project?.revision ?? 0);
  revision.current = Math.max(revision.current, project?.revision ?? 0);
  useEffect(() => registerUnsaved?.(() => dirtyRef.current), [registerUnsaved]);

  // Camera controls change the preview and browser-local scene only. They are
  // not connected to AI inference or automatic project persistence.
  const applyLocalCamera = (intrinsics: CinemaCameraOptics) => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.fov = cinemaVerticalFovDegrees(intrinsics, camera.aspect);
    camera.near = intrinsics.near;
    camera.far = intrinsics.far;
    camera.updateProjectionMatrix();
    setFovDeg(camera.fov);
  };

  // Shows a scene: checked first, then the meshes, the lens and the camera.
  const showScene = (raw: unknown) => {
    const next = assertLocalScene(raw);
    sceneRef.current = next;
    syncRef.current?.(next);
    setLensMm(next.camera.focalLengthMm);
    applyLocalCamera(next.camera);
    return next;
  };

  // A change to a project's scene is unsaved until the person saves it.
  const changed = () => {
    if (!documentIdRef.current) return;
    dirtyRef.current = true;
    setSave((s) => cinemaChangedState(s, savedHashRef.current));
  };

  // An edit to the scene's objects: drawn at once, and unsaved until the person saves.
  const editScene = (edit: (scene: CinemaSceneLocal) => CinemaSceneLocal) => {
    if (!CINEMA_ENABLED || !cinemaCanEdit(saveRef.current)) return;
    const next = edit(sceneRef.current);
    sceneRef.current = next;
    syncRef.current?.(next);
    setEdits((n) => n + 1);
    changed();
    return next;
  };

  const chooseLens = (focalLengthMm: number) => {
    if (!CINEMA_ENABLED || !cinemaCanEdit(saveRef.current)) return;
    const next = {
      ...sceneRef.current,
      camera: { ...sceneRef.current.camera, focalLengthMm },
    };
    sceneRef.current = next;
    setLensMm(focalLengthMm);
    applyLocalCamera(next.camera);
    changed();
  };

  // Opens the project's scene (or a new one) when the project changes, and on Reopen.
  useEffect(() => {
    documentIdRef.current = null;
    savedHashRef.current = null;
    dirtyRef.current = false;
    if (!CINEMA_ENABLED || !projectId || !client) {
      setPersistence(null);
      setSave(null);
      return;
    }
    let current = true;
    setSave({ state: "loading" });
    void (async () => {
      const capability = (await client.call(
        "yamakan.document.capability",
        {},
      )) as { available: boolean; turnedOff?: boolean };
      if (!current) return;
      setPersistence(capability.available);
      setTurnedOff(Boolean(capability.turnedOff));
      if (!capability.available) {
        setSave(null);
        return;
      }
      const stored = await loadProjectScene(client, projectId);
      // Against the current head, as the Studio canvas is opened.
      const head = (await client.call("yamakan.project.open", {
        projectId,
      })) as { revision: number };
      if (!current) return;
      revision.current = head.revision;
      showScene(stored ? stored.scene : freshScene());
      documentIdRef.current = stored?.documentId ?? sceneRef.current.id;
      savedHashRef.current = stored?.contentHash ?? null;
      setSave(
        stored
          ? { state: "saved", contentHash: stored.contentHash }
          : { state: "new" },
      );
    })().catch((e: unknown) => {
      if (current)
        setSave({
          state: "loadError",
          message: e instanceof Error ? e.message : String(e),
        });
    });
    return () => {
      current = false;
    };
    // showScene reads refs only; the client is the page's one SDK client.
  }, [projectId, reloads]);

  // An editor undo or restore can change the stored scene under a clean view. Show what is
  // stored then, or the view would say Saved over a scene it no longer holds.
  const projectRevision = project?.revision;
  useEffect(() => {
    if (!projectId || !client || !persistence) return;
    let current = true;
    const settled = () =>
      current &&
      !dirtyRef.current &&
      !savingRef.current &&
      documentIdRef.current !== null;
    void (async () => {
      if (!settled()) return;
      const now = await storedSceneHash(client, projectId);
      if (settled() && now !== savedHashRef.current) setReloads((n) => n + 1);
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [projectRevision]);

  const saveScene = async () => {
    const documentId = documentIdRef.current;
    if (
      !projectId ||
      !client ||
      !persistence ||
      !documentId ||
      savingRef.current
    )
      return;
    savingRef.current = true;
    // What is saved: a change made while this runs stays unsaved.
    const scene = sceneRef.current;
    const expectedContentHash = savedHashRef.current;
    let from = revision.current;
    setSave({ state: "saving" });
    try {
      const commit = () =>
        saveProjectScene({
          client,
          projectId,
          expectedRevision: from,
          documentId,
          expectedContentHash,
          scene,
        });
      let result;
      try {
        result = await commit();
      } catch (e) {
        // Only the project moved (another part of it was saved), not this scene: save
        // again against the new head, once.
        if (
          (e as { code?: string }).code !== "REVISION_CONFLICT" ||
          (await storedSceneHash(client, projectId)) !== expectedContentHash
        )
          throw e;
        const head = (await client.call("yamakan.project.open", {
          projectId,
        })) as { revision: number };
        from = head.revision;
        result = await commit();
      }
      onSaved?.(projectId, from, result.revision);
      if (documentIdRef.current !== documentId) return;
      revision.current = result.revision;
      savedHashRef.current = result.contentHash;
      dirtyRef.current = sceneRef.current !== scene;
      setSave(
        dirtyRef.current
          ? { state: "changed", contentHash: result.contentHash }
          : { state: "saved", contentHash: result.contentHash },
      );
    } catch (e) {
      if (documentIdRef.current !== documentId) return;
      const message = e instanceof Error ? e.message : String(e);
      setSave(
        (e as { code?: string }).code === "REVISION_CONFLICT"
          ? { state: "conflict", message }
          : { state: "error", message, contentHash: savedHashRef.current },
      );
    } finally {
      savingRef.current = false;
    }
  };

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
    // Fixed once here. The field of view depends on this shape: a resize handler must
    // set camera.aspect and call applyLocalCamera again.
    const height = 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("data-testid", "cinema-canvas");

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x1a1d21);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    cameraRef.current = camera;
    applyLocalCamera(sceneRef.current.camera);
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
          threeScene.add(mesh);
          meshes.set(item.id, mesh);
        }
        // An opened scene can reuse an item's id with other values.
        (mesh.material as THREE.MeshStandardMaterial).color.set(
          item.color ?? "#888888",
        );
        mesh.name = item.name || item.id;
        mesh.userData.assetId = item.assetId;
        mesh.position.set(item.position.x, item.position.y, item.position.z);
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
        mesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
        mesh.visible = item.visible !== false;
      }
    };

    syncMeshes(sceneRef.current);
    syncRef.current = syncMeshes;

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
        if (!cinemaCanEdit(saveRef.current))
          throw new Error("The project's Cinema scene is still opening.");
        const next = showScene(raw);
        changed();
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
      cameraRef.current = null;
      syncRef.current = null;
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

  const objectsPanel = () => {
    const items = sceneRef.current.items;
    const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
    const editable = cinemaCanEdit(save);
    const full = items.length >= CINEMA_PAGE_MAX_ITEMS;
    const readout = selected ? cinemaItemReadout(selected) : null;
    const move = (axis: CinemaAxis, metres: number) =>
      selected &&
      editScene((s) => moveCinemaItem(s, selected.id, axis, metres));
    const button = (
      key: MessageKey,
      testId: string,
      onClick: () => void,
      disabled = !editable || !selected,
    ) => (
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
      >
        {t(key)}
      </button>
    );
    const m = CINEMA_NUDGE.metres;
    return (
      <div
        className="cinema-objects"
        role="group"
        aria-labelledby="cinema-objects-title"
        data-testid="cinema-objects"
      >
        <strong id="cinema-objects-title">{t("cinema.objects.title")}</strong>
        {selected ? (
          <label>
            {t("cinema.objects.choose")}{" "}
            <select
              data-testid="cinema-objects-select"
              value={selected.id}
              disabled={!editable}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p data-testid="cinema-objects-empty">{t("cinema.objects.none")}</p>
        )}
        <div className="cinema-objects-buttons">
          {button("cinema.objects.left", "cinema-move-left", () =>
            move("x", -m),
          )}
          {button("cinema.objects.right", "cinema-move-right", () =>
            move("x", m),
          )}
          {button("cinema.objects.forward", "cinema-move-forward", () =>
            move("z", -m),
          )}
          {button("cinema.objects.back", "cinema-move-back", () =>
            move("z", m),
          )}
          {button("cinema.objects.up", "cinema-move-up", () => move("y", m))}
          {button("cinema.objects.down", "cinema-move-down", () =>
            move("y", -m),
          )}
          {button("cinema.objects.turnLeft", "cinema-turn-left", () =>
            editScene((s) =>
              turnCinemaItem(s, selected!.id, CINEMA_NUDGE.degrees),
            ),
          )}
          {button("cinema.objects.turnRight", "cinema-turn-right", () =>
            editScene((s) =>
              turnCinemaItem(s, selected!.id, -CINEMA_NUDGE.degrees),
            ),
          )}
          {button("cinema.objects.bigger", "cinema-scale-up", () =>
            editScene((s) =>
              scaleCinemaItem(s, selected!.id, CINEMA_NUDGE.factor),
            ),
          )}
          {button("cinema.objects.smaller", "cinema-scale-down", () =>
            editScene((s) =>
              scaleCinemaItem(s, selected!.id, 1 / CINEMA_NUDGE.factor),
            ),
          )}
        </div>
        <div className="cinema-objects-buttons">
          {button(
            "cinema.objects.add",
            "cinema-objects-add",
            () => {
              const id = crypto.randomUUID();
              const next = editScene((s) =>
                addCinemaBox(
                  s,
                  t("cinema.objects.boxName", { n: s.items.length + 1 }),
                  id,
                ),
              );
              if (next) setSelectedId(id);
            },
            !editable || full,
          )}
          {button("cinema.objects.remove", "cinema-objects-remove", () => {
            const next = editScene((s) => removeCinemaItem(s, selected!.id));
            if (next) setSelectedId(next.items[0]?.id ?? null);
          })}
        </div>
        {readout ? (
          <output aria-live="polite" data-testid="cinema-objects-readout">
            {t("cinema.objects.readout", readout)}
          </output>
        ) : null}
        {full ? (
          <p data-testid="cinema-objects-full">
            {t("cinema.objects.full", { max: CINEMA_PAGE_MAX_ITEMS })}
          </p>
        ) : null}
        <p className="cinema-lens-note">{t("cinema.objects.note")}</p>
      </div>
    );
  };

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
      <div
        className="cinema-lens-panel"
        role="group"
        aria-label={t("cinema.lens.title")}
        data-testid="cinema-lens-panel"
      >
        <strong>{t("cinema.lens.title")}</strong>
        <div className="cinema-lens-presets">
          {CINEMA_LENS_PRESETS_MM.map((mm) => (
            <button
              key={mm}
              type="button"
              aria-pressed={lensMm === mm}
              data-testid={"cinema-lens-" + mm}
              disabled={!cinemaCanEdit(save)}
              onClick={() => chooseLens(mm)}
            >
              {t("cinema.lens.preset", { value: mm })}
            </button>
          ))}
        </div>
        <output aria-live="polite" data-testid="cinema-lens-fov">
          {t("cinema.lens.fov", {
            value: Math.round(fovDeg),
          })}
        </output>
        <p className="cinema-lens-note">{t("cinema.lens.note")}</p>
      </div>
      {objectsPanel()}
      <div className="cinema-project" data-testid="cinema-project">
        {!projectId || !client ? (
          <p data-testid="cinema-project-state">{t("cinema.project.none")}</p>
        ) : persistence === false ? (
          <p data-testid="cinema-project-state">
            {t(
              turnedOff
                ? "cinema.project.turnedOff"
                : "cinema.project.unavailable",
            )}
          </p>
        ) : (
          <>
            <button
              type="button"
              data-testid="cinema-project-save"
              disabled={!cinemaCanSave(save)}
              onClick={() => void saveScene()}
            >
              {t("cinema.project.save")}
            </button>
            <button
              type="button"
              data-testid="cinema-project-reopen"
              disabled={!cinemaCanReopen(save)}
              onClick={() => setReloads((n) => n + 1)}
            >
              {t("cinema.project.reopen")}
            </button>
            <output
              aria-live="polite"
              data-testid="cinema-project-state"
              data-state={save?.state ?? "none"}
            >
              {save?.state === "error" || save?.state === "loadError"
                ? t(`cinema.project.${save.state}`, { message: save.message })
                : save
                  ? t(`cinema.project.${save.state}`)
                  : ""}
            </output>
          </>
        )}
      </div>
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
