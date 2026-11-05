# A person's own media after consent is revoked

Founder's decision, 2026-11-05: gate it. Builder Claude Opus. Before this, a person's imported photo linked by a reference pack could still be placed and exported after their consent was revoked, and only takes with continuity references were gated.

## Behaviour

At the store's one commit point: a batch edit, `clip.replaceMedia`, undo, redo, restore, relink, assembly, `project.save`, and the same bytes imported again. `npm run migrate`'s `importHistory` is offline, for a new project with no documents, and does not pass this point.

A medium that any reference pack version in the workspace links to a character's consent cannot be newly presented, or presented for longer than before on a channel that plays, once the newest consent linked to it for that character is revoked. Consents count per character, so a second person's consent does not free the first's photo.

The refusal is `VALIDATION`, and it gives the reason and the way back.

- **Stays:** clips still showing it, moving, splitting or shortening them, earlier exports, exporting a project that still shows them, the file and saved projects. Nothing is deleted.
- **Does not free it:** removing the entry from a later pack version, another project, an older consent that was never revoked, or a clip left on the timeline.
- **Way back:** a newer consent, saved in a pack with that media. Revoking an older grant leaves a newer one standing.
- **After a restore:** the newest consent must be revalidated first, because a backup taken before a revocation does not know of it. **This goes beyond the decision, for the founder to overrule:** after any restore to a new folder, pack-linked media cannot be newly placed until someone revalidates, even if nobody revoked anything, and the browser has no control for that. It adds a human step rather than knowledge: revalidating a backup from before a revocation still undoes it. Clips already there still play and export.
- **Generation boundary:** `yamakan.continuity.check` at the attempt stage, and the attach stage, check a reference entry's media the same way, whatever the entry's role.
- **Only revocation and the restore epoch gate this.** An expired consent does not.

No schema change. Each pack version's links are read once and kept by content hash, so the scan after that is one list query. **The first scan in a service run reads every pack version in the workspace, inside the commit.** A review measured an earlier form of this scan at 85 s for 10,000 full-size pack versions and 200 hashes on a synthetic table; this form was not re-measured.

## Results

- `tests/story-packs.test.ts`, nine tests, through commands: placement with a usable consent; refusal of `clip.add`, undo, `clip.replaceMedia`, a re-import, restore and another project; an emptied later pack; a new consent as the way back; a reopen; renewing then revoking; a clip that stays opening nothing further, while it can still be moved and split; two characters on one photo; an older grant revoked after renewing; unmuting a second clip, spending another clip's time and lengthening, all refused; and revalidation after a new epoch, set directly rather than by a real restore. The first three failed with the gate removed.
- `npm run qualify:consent-gate`, real Edge against the real service: the real Undo button is refused with the message on screen, the head unmoved and the file kept. CI does not run it. Its way back is driven through the service, not the interface.
- A review ran redo, relink, assembly and `project.save` against an earlier form of the gate, and they were refused; the suite has no test of its own for those.

## What is left open

The decision asked that a revoked person's photo not be placed or used. These remain:

- **A clip already there can be seen and exported,** by the decision's own terms.
- **Unmuting a track, or ending a solo, that reveals the photo is refused,** and so is undoing that mute, a shortening or a removal. So a person can be stuck with a mute or solo until they remove the clip, and earlier undo steps sit behind the refused one. The message says it can no longer be shown, which is the rule as written, but this is a sharp edge.
- **For footage, a new in-point or speed shows other frames in the same time.** The total play time is bounded, not what is shown.
- **A re-encode, or an export re-imported,** has a different hash, so it is not caught. The gate matches exact bytes.
- **A photo no pack links to a consent:** nothing says it is a person. This includes a scene's `referenceAssetId` and Studio bitmaps, which do not reach this check.
- **A take that only pins a pack:** a pin does not show the take depicts that person.
- **A `style` pack entry or a story naming the photo can be saved after revocation.** It cannot then be used at the attempt stage or placed, by reading; the check at the attempt and attach stages has no test of its own.
- **A recovery restore over a damaged head is exempt,** so committed work can come back; it needs a damaged head to reach. By reading and a review's tamper test of the earlier form.
- **A browser session can block any medium across the workspace,** by linking it to a throwaway consent and revoking it. Agents cannot. In the contract.
- **The interface has no way to record a consent, save a pack or revoke,** and no explicit removal or cleanup action. All of this works only through the commands.

Rollback: revert this change. No stored data is affected, and placements the gate refused become possible again.
