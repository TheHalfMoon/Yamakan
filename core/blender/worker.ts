// The Blender worker's process owner: yamakan-procd, allowed to start only the pinned
// blender.exe, inside the engine-worker profile (AppContainer, no network, no GPU, a memory
// budget and a wall budget). One owner per executable, closed with the service.
import { ProcessOwner } from "../process/owner.ts";

const owners = new Map<string, ProcessOwner>();

export function blenderWorkers(executable: string): ProcessOwner {
  let owner = owners.get(executable);
  if (!owner) {
    owner = new ProcessOwner([executable]);
    owners.set(executable, owner);
  }
  return owner;
}

// Ends every running Blender worker; called on service shutdown.
export function closeBlenderWorkers() {
  for (const owner of owners.values()) owner.close();
  owners.clear();
}
