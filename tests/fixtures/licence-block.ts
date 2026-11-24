// A whole licence block that allows everything: a made one, of no model.
import type { LicenceBlock } from "../../core/engines/licence.ts";

export const licenceTerm = (over: object = {}) => ({
  name: "Apache-2.0",
  spdx: "Apache-2.0",
  commercialUse: "allowed" as const,
  ...over,
});
export const wholeLicence = (): LicenceBlock => ({
  code: licenceTerm(),
  weights: licenceTerm(),
  baseModel: { kind: "none" },
  bundled: [{ name: "an encoder", role: "text encoder", term: licenceTerm() }],
  bundledReviewed: true,
  revenueCap: { kind: "none" },
  territorialExclusions: { kind: "none" },
  hostedServiceRight: "allowed",
  outputUse: { kind: "unrestricted" },
  watermark: { kind: "none" },
  gated: "no",
  attribution: { kind: "none" },
  sourceUrl: "https://example.com/model/LICENSE",
  verifiedAt: "2026-11-24",
  evidence: "DOC",
});
