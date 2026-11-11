// The page's security policy allows no eval, so zod validates without compiling code: it is
// told so before anything is validated, and never tries `new Function` (a refusal the policy
// would otherwise report, though zod catches it). Imported first by main.tsx.
import { config } from "zod";

config({ jitless: true });
