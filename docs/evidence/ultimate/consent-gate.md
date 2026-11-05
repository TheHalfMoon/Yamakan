# A person's own media after consent is revoked

Founder's decision, 2026-11-05: gate it. Builder Claude Opus. Before this, a person's imported photo linked by a reference pack could still be placed and exported after their consent was revoked, and only takes with continuity references were gated.

## Behaviour

At the store's one commit point, so every route is covered: a batch edit, `clip.replaceMedia`, undo, redo, restore, relink, assembly, and the same bytes imported again. A medium that any reference pack version in the workspace links to a character's consent cannot be newly presented once every consent linked to it for that character is revoked.

The refusal is `VALIDATION`, and it reads: "This person's consent was revoked, so this media cannot be placed on the timeline again. Clips already there stay, and the file is kept. To use it again, record a new consent and save the reference pack with it."

- **Stays:** clips already presented, moving or trimming them, earlier exports, exporting a project that still shows the clip, the file itself and saved projects. Nothing is deleted.
- **Does not free it:** removing the entry from a later pack version, or another project in the workspace.
- **Way back:** a newer consent for that character, saved in a pack with that media.
- **Only revocation gates this.** An expired consent, or one awaiting revalidation after a restore, does not. Revocation is the person's act; the decision was about revocation.

No schema change. A medium newly presented costs one scan of pack versions naming it.

## Results

- `tests/story-packs.test.ts`, three tests, through commands: a usable consent allows placement; after revocation a clip stays and moves; `clip.add`, undo, `clip.replaceMedia`, a re-import of the same bytes, restore and another project are refused; an emptied later pack does not free it; a new consent does; and the refusal holds after the workspace is reopened. All three failed with the gate removed. Other media is unaffected.
- `npm run qualify:consent-gate`, real Edge against the real service: the real Undo button is refused, with the message on screen, the head unmoved and the file kept. CI does not run it.

## Not gated, and why

- **A re-encode.** The gate matches exact bytes.
- **Copying a clip already on the timeline.** A copy presents nothing new, by the commit point's rule, so splits and moves keep working. A copy of a clip that stays on the timeline is therefore allowed.
- **Export of clips already on the timeline.** They stay and export, as the contract has said and the decision does not change: "Clips already there stay".
- **A photo no pack links to a consent.** Nothing says it is a person.
- **A take that only pins a pack.** A pin does not show the take depicts that person.
- **A backup restored to a new workspace** runs no timeline commit; its later placements are gated, as the consent ledger comes with it. By reading.
- **A restore across this change is refused for that revision,** and for a recovery restore too, as with continuity takes. An owner of such a project keeps the current head. By reading.

**The interface has no way to record a consent and a new pack from this message.** The way back works through the commands, and there is no explicit removal or cleanup action in the browser; neither was added here.

Rollback: revert this change. No stored data is affected, and placements the gate refused become possible again.
