# H2–H4 escalation packet (external gates)

**Status:** Requirements packet only. **Not executed** on this machine as release evidence.  
**Do not** treat absent runs as passes.  
**Executable checklists:** [CHECKLIST.md](./CHECKLIST.md) (H2 Profile A, H3 second account, H4 disk-full; H5 reminder).

## H2 — Clean Profile A + offline packet capture

- Fresh Windows user profile; nothing Yamakan-related preinstalled.
- Install from the **release** artifact (not `bundle:install-dev` alone).
- Network off; administrator packet capture showing no unexpected egress.
- Launch verify against bundle manifest on every start.

## H3 — Second Windows account + clean-profile restore

- Real second standard account denied workspace/token/launch (beyond `probe-other`).
- Restore into a second profile path; recovery folder restricted.

## H4 — Constrained-volume disk-full

- Dedicated volume filled to induce ENOSPC during import/export/backup.
- Confirm fail-closed behavior and no silent corruption.

## H5 — Founder artifact-bound ship

- Founder decision on a specific signed artifact hash (not this packet).

## Achievable substitutes already in-repo (not H2–H4)

- `probe-other` ACL evidence (T9b)
- Bundle lifecycle unit suite (`qualify:bundle-r6`)
- Dev-profile `qualify:release` / E2E (not Profile A)

## Sign-off

| Gate | Operator | Result | Date | Artifact |
| --- | --- | --- | --- | --- |
| H2 | | **open** | | |
| H3 | | **open** | | |
| H4 | | **open** | | |
| H5 | | **open** | | |
