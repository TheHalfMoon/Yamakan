/** Yamakan host shim for @features/gallery GeneratedImageContract. */
export type GeneratedImageContract = {
  id: string;
  imageName: string;
  width: number;
  height: number;
  hash?: string;
  url?: string;
  /** Present on staging candidates linked to a queue item (host/seam). */
  sourceQueueItemId?: string;
};
