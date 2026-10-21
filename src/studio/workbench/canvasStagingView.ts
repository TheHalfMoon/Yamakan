import type {
  CanvasStagingCandidateContract,
  CanvasStateContractV3,
} from "../canvas-engine/contracts";

export function getCanvasStagingCandidateFingerprint(_s: unknown): string {
  return "none";
}

/** Host staging slot: structural match for donor canvasStagingView consumers. */
export type StagingSlot = {
  id: string;
  kind: string;
  candidate: CanvasStagingCandidateContract;
  sourceQueueItemId?: string;
  imageName?: string;
  width?: number;
  height?: number;
};

export function getCanvasStagingSlots(
  canvas: CanvasStateContractV3,
  _queueItems?: readonly unknown[],
): StagingSlot[] {
  const images = canvas.stagingArea?.pendingImages ?? [];
  return images.map((img, i) => ({
    id: img.id ?? String(i),
    kind: "image",
    candidate: img,
    sourceQueueItemId: (img as { sourceQueueItemId?: string }).sourceQueueItemId,
    imageName: img.imageName,
    width: img.width,
    height: img.height,
  }));
}

export function getCanvasStagingSlotCount(
  canvas: CanvasStateContractV3,
  queueItems?: readonly unknown[],
): number {
  return getCanvasStagingSlots(canvas, queueItems).length;
}
