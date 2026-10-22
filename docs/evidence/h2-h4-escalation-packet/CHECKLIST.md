# H2–H4 — Executable external-gate checklists

**Status:** OPEN. These gates require administrator / clean Profile A / second account / constrained volume.  
**Do not** treat development-profile substitutes as passes.  
**Related:** [README.md](./README.md), unsigned RC assessment (`docs/evidence/qualification/p10-08-unsigned-rc-assessment.md`).

## Shared binding (fill once per campaign)

| Field | Value |
| --- | --- |
| Exact git SHA under test | |
| Unsigned RC / release artifact path | |
| Artifact sha256 (zip or installer) | |
| Operator | |
| Date (UTC) | |

---

## H2 — Clean Profile A + offline packet capture

**Owner:** Administrator  
**Blocks:** Public release

### Steps

1. Create a **fresh** Windows user profile with no Yamakan paths under `%LOCALAPPDATA%`, `%APPDATA%`, or Program Files.
2. Install from the **release** or labeled unsigned-RC artifact under test (record hash above). For public ship, use the **signed** installer only.
3. Disable network (or firewall deny-all egress); start administrator packet capture (`pktmon` / equivalent).
4. Cold launch → create project → import sample → preview → export → backup → quit.
5. Confirm launch-time verification against the bundle manifest.
6. Stop capture; assert no unexpected external destinations.

### Pass table

| # | Criterion | Pass? | Evidence path | Initials |
| --- | --- | --- | --- | --- |
| 1 | Fresh profile (no prior Yamakan state) | | | |
| 2 | Install from hashed artifact | | | |
| 3 | Network disabled + packet capture | | | |
| 4 | Journey completes without unexpected egress | | | |
| 5 | Launch verify against manifest | | | |

**Dev substitutes (NOT H2):** `qualify:release` on development profile; `qualify:bundle-r6`; `qualify:unsigned-rc` on temp/`%LOCALAPPDATA%\Yamakan-unsigned-rc`.

---

## H3 — Second Windows account + clean-profile restore

**Owner:** Administrator  
**Blocks:** Public release

### Steps

1. Create a real second **standard** Windows account (not an AppContainer probe).
2. As primary account: create workspace, import media, run backup.
3. As second account: attempt read of workspace, `token`, and `launch` files — expect denial.
4. Restore backup into a path owned by the second (or a second clean) profile; confirm recovery folder ACLs.
5. Record before/after ACL listings.

### Pass table

| # | Criterion | Pass? | Evidence path | Initials |
| --- | --- | --- | --- | --- |
| 1 | Real second standard account used | | | |
| 2 | Workspace/token/launch denied to second account | | | |
| 3 | Restore into second clean profile succeeds | | | |
| 4 | Recovery folder restricted | | | |

**Dev substitutes (NOT H3):** `yamakan-acl probe-other` restricted-token proxy (T9b).

---

## H4 — Constrained-volume disk-full

**Owner:** Administrator  
**Blocks:** Public release (fault matrix)

### Steps

1. Attach or create a dedicated volume with known free capacity.
2. Fill the volume so free space is below import/export/backup needs (induce ENOSPC).
3. Attempt import, export, and backup; confirm fail-closed (no silent corruption; clear error).
4. Free space; confirm recovery / retry path.

### Pass table

| # | Criterion | Pass? | Evidence path | Initials |
| --- | --- | --- | --- | --- |
| 1 | Dedicated constrained volume | | | |
| 2 | Import fails closed on ENOSPC | | | |
| 3 | Export fails closed on ENOSPC | | | |
| 4 | Backup fails closed on ENOSPC | | | |
| 5 | No silent corruption after refill | | | |

**Dev substitutes (NOT H4):** Injected ENOSPC unit tests (T4b/T5); free-space checks (T9a).

---

## H5 reminder (founder only)

Artifact-bound ship decision on a **signed** installer hash. Not executed by engineering. Public release **NO-GO** until H5.

| Gate | Result | Date | Artifact hash |
| --- | --- | --- | --- |
| H5 | **open** | | |
