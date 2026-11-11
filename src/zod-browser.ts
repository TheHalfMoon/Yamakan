// The page's security policy allows no code compiled at run time, so zod validates without
// compiling: it is told so before anything is validated, and never makes the one-time probe
// for compiling that the policy would report as refused (though zod catches it). Imported first
// by main.tsx.
import { config } from "zod";

config({ jitless: true });
