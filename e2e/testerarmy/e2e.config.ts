// TesterArmy e2e against the local Yamakan service (run.mjs starts it).
// Deterministic locators and assertions only: no model is configured, so no
// step can call one; telemetry is disabled by run.mjs.
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { freshEdge } from './edge.ts';

export default {
  targets: [
    {
      name: 'yamakan',
      engine: web({
        connect: { cdpEndpoint: (signal) => freshEdge(signal) },
        viewport: { width: 1440, height: 1050 },
      }),
      app: { url: process.env.YAMAKAN_E2E_URL ?? 'http://127.0.0.1:24400' },
    },
  ],
  workers: 1,
  retries: 0,
} satisfies E2EConfig;
