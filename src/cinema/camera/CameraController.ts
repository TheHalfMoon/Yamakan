// Adapted from storytold/artcraft CameraController.ts @ 28a39a0d
// (frontend/libs/components/pagescene/src/lib/engine/editor/CameraController.ts).
// Ladder B: event bus and @storyteller/* replaced by callbacks; EditorStates
// collapsed to a local union. Fallback when free-cam is unavailable:
// three/addons/controls/OrbitControls.js (see createOrbitControlsFallback).
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  freeCamFrameTick,
  lookAtFromCamera,
  type FreeCamControlState,
} from "./cameraMath.ts";

export type RenderDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
};

export type CameraFrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type CameraAspectRatio = "16:9" | "3:2" | "2:3" | "9:16" | "1:1";

export const DEFAULT_CAMERA_ASPECT_RATIO: CameraAspectRatio = "1:1";

export type CinemaCameraEntry = {
  id: string;
  focalLength: number;
};

export type CameraPose = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
};

export type EditorViewState = "edit" | "camera-view";

export type CameraControllerDeps = {
  getThreeScene: () => THREE.Scene;
  getHotItems: () => THREE.Object3D[] | null;
  removeTransformControls: () => void;
  setSelected: (obj: THREE.Object3D | null) => void;
  setEditorState: (state: EditorViewState) => void;
  hideObjectPanel: () => void;
  getCameras: () => CinemaCameraEntry[];
  getSelectedCameraId: () => string;
  /** Camera change callback (replaces donor EngineEventBus CameraUpdatedEvent). */
  onCameraUpdated: (cameraId: string, pose: CameraPose) => void;
};

/**
 * Owns viewport / render camera state and free-cam integration.
 * Construction is empty of DOM; callers wire deps and cameras after the
 * renderer exists.
 */
export class CameraController {
  readonly camera_name: string = "::CAM::";

  camera: THREE.PerspectiveCamera | null = null;
  render_camera: THREE.PerspectiveCamera | null = null;
  render_camera_aspect_ratio: CameraAspectRatio = DEFAULT_CAMERA_ASPECT_RATIO;

  cam_obj: THREE.Object3D | undefined;
  camera_person_mode: boolean = false;

  lockControls: PointerLockControls | undefined;

  freeCamState: FreeCamControlState | null = null;
  locked = false;

  private frameRect: CameraFrameRect | null = null;
  private frameCanvasAspect: number | null = null;

  last_cam_pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  last_cam_rot: THREE.Euler = new THREE.Euler(0, 0, 0);
  camera_last_pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  render_width: number;
  render_height: number;

  private deps: CameraControllerDeps;

  constructor(deps: CameraControllerDeps) {
    this.deps = deps;
    const dims = this.getRenderDimensions();
    this.render_width = dims.width;
    this.render_height = dims.height;
  }

  refreshCamObj(scene: THREE.Scene): void {
    this.cam_obj = scene.getObjectByName(this.camera_name);
    this.cam_obj?.layers.set(1);
    this.cam_obj?.children.forEach((child) => {
      child.layers.set(1);
    });
  }

  switchCameraView() {
    if (this.camera_person_mode) this.exitCameraView();
    else this.enterCameraView();
  }

  enterCameraView() {
    if (this.camera_person_mode || !this.cam_obj || !this.camera) return;

    this.last_cam_pos.copy(this.camera.position);
    this.last_cam_rot.copy(this.camera.rotation);

    this.camera_person_mode = true;
    if (this.freeCamState) this.freeCamState.velocity.set(0, 0, 0);

    this.camera.position.copy(this.cam_obj.position);
    this.camera.rotation.copy(this.cam_obj.rotation);

    if (this.lockControls) {
      this.deps.getThreeScene().add(this.lockControls.getObject());
    }
    this.cam_obj.scale.set(0, 0, 0);

    this.deps.removeTransformControls();
    this.deps.setSelected(this.cam_obj);
    this.deps.setEditorState("camera-view");
  }

  exitCameraView() {
    if (!this.camera_person_mode || !this.cam_obj) return;
    this.camera_person_mode = false;
    if (this.freeCamState) this.freeCamState.velocity.set(0, 0, 0);

    if (this.camera) {
      this.camera.position.copy(this.last_cam_pos);
      this.camera.rotation.copy(this.last_cam_rot);
      this.camera.updateProjectionMatrix();
    }
    this.applyFrameProjection();
    if (this.lockControls) {
      this.deps.getThreeScene().remove(this.lockControls.getObject());
    }
    this.cam_obj.scale.set(1, 1, 1);

    this.deps.hideObjectPanel();
    this.deps.setEditorState("edit");
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  setCameraFrameRect(rect: CameraFrameRect | null): void {
    this.frameRect = rect;
    this.applyFrameProjection();
  }

  applyFrameProjection(): void {
    const cam = this.camera;
    if (!cam) return;
    const rect = this.camera_person_mode ? this.frameRect : null;

    if (rect) {
      const renderAspect = this.getRenderDimensions().aspectRatio;
      const view = cam.view;
      const unchanged =
        cam.aspect === renderAspect &&
        view?.enabled === true &&
        view.fullWidth === rect.width &&
        view.fullHeight === rect.height &&
        view.offsetX === -rect.x &&
        view.offsetY === -rect.y &&
        view.width === rect.canvasWidth &&
        view.height === rect.canvasHeight;
      if (unchanged) return;

      this.frameCanvasAspect = rect.canvasWidth / rect.canvasHeight;
      cam.aspect = renderAspect;
      cam.setViewOffset(
        rect.width,
        rect.height,
        -rect.x,
        -rect.y,
        rect.canvasWidth,
        rect.canvasHeight,
      );
      cam.updateProjectionMatrix();
    } else if (cam.view?.enabled) {
      cam.clearViewOffset();
      if (this.frameCanvasAspect !== null) {
        cam.aspect = this.frameCanvasAspect;
        this.frameCanvasAspect = null;
      }
      cam.updateProjectionMatrix();
    }
  }

  setFreeCamState(state: FreeCamControlState | null) {
    this.freeCamState = state;
  }

  getCameraPersonMode(): boolean {
    return this.camera_person_mode;
  }

  focalLengthToFov(focalLength: number, sensorHeight: number = 24): number {
    return 2 * Math.atan(sensorHeight / (2 * focalLength)) * (180 / Math.PI);
  }

  getRenderDimensions(): RenderDimensions {
    switch (this.render_camera_aspect_ratio) {
      case "16:9":
        return { width: 1280, height: 720, aspectRatio: 16 / 9 };
      case "3:2":
        return { width: 1200, height: 800, aspectRatio: 3 / 2 };
      case "2:3":
        return { width: 800, height: 1200, aspectRatio: 2 / 3 };
      case "9:16":
        return { width: 720, height: 1280, aspectRatio: 9 / 16 };
      case "1:1":
      default:
        return { width: 1080, height: 1080, aspectRatio: 1 };
    }
  }

  changeRenderCameraAspectRatio(newAspectRatio: CameraAspectRatio) {
    this.render_camera_aspect_ratio = newAspectRatio;
    const { width, height, aspectRatio } = this.getRenderDimensions();
    this.render_width = width;
    this.render_height = height;
    if (this.render_camera) {
      this.render_camera.aspect = aspectRatio;
      this.render_camera.updateProjectionMatrix();
    }
  }

  tickPerFrame(deltaSeconds: number) {
    const selectedCameraId = this.deps.getSelectedCameraId();

    if (selectedCameraId && this.camera) {
      const cameras = this.deps.getCameras();
      const camData = cameras.find((c) => c.id === selectedCameraId);
      if (camData) {
        const focal = Number.isFinite(camData.focalLength)
          ? Math.min(10_000, Math.max(1, camData.focalLength))
          : 35;
        const fov = this.focalLengthToFov(focal);
        if (this.camera.fov !== fov) {
          this.camera.fov = fov;
          this.camera.updateProjectionMatrix();
        }
      }
    }

    this.applyFrameProjection();

    if (this.freeCamState && this.camera && !this.locked) {
      const moved = freeCamFrameTick(
        this.camera,
        this.freeCamState,
        5 * deltaSeconds,
      );
      if (moved && selectedCameraId) {
        const lookAt = lookAtFromCamera(this.camera);
        const pos = this.camera.position;
        const rot = this.camera.rotation;
        this.deps.onCameraUpdated(selectedCameraId, {
          position: { x: pos.x, y: pos.y, z: pos.z },
          rotation: { x: rot.x, y: rot.y, z: rot.z },
          lookAt: { x: lookAt.x, y: lookAt.y, z: lookAt.z },
        });
      }
    }

    if (this.camera_person_mode) {
      if (this.cam_obj && this.camera) {
        this.cam_obj.position.copy(this.camera.position);
        this.cam_obj.rotation.copy(this.camera.rotation);
        this.cam_obj.visible = false;
      }
    } else if (this.cam_obj) {
      this.cam_obj.visible = true;
    }

    if (this.render_camera && this.cam_obj) {
      this.render_camera.position.copy(this.cam_obj.position);
      this.render_camera.rotation.copy(this.cam_obj.rotation);
      this.cam_obj.scale.copy(new THREE.Vector3(1, 1, 1));
    }
  }
}

/** M10 fallback when free-cam wiring is unavailable. */
export function createOrbitControlsFallback(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  return new OrbitControls(camera, domElement);
}
