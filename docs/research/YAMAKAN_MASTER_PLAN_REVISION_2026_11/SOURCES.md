# Sources

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This file resolves every source key used in this package. A source key is a short code, such as S7, HF-S7, R-TOS, U12, V-WHI or C-4, that stands for a public page or a paper.

How to resolve a key:

1. Note which document or research note the key appears in.
2. Find the key family in section 3. The same letters can mean different things in different documents. Section 6 lists those cases.
3. Find the key in the table of that family in section 4.

The tables in section 4 were built by a script from the research notes and the numbered documents. They hold 476 keys. Every address, title and date in them is copied from those files. None was typed by hand, completed or guessed. Where a note gives no address for a key, the row says so in the words of the note.

Short names used in this file:

| short name | file |
|---|---|
| note 01 to note 10 | the research notes listed in section 2 |
| document 00 | [00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md) |
| document 01 | [01_COMPETITIVE_CAPABILITY_MATRIX.md](01_COMPETITIVE_CAPABILITY_MATRIX.md) |
| document 02 | [02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md) |
| document 03 | [03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md) |
| document 04 | [04_SOURCE_REUSE_DECISIONS.md](04_SOURCE_REUSE_DECISIONS.md) |
| document 07 | [07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md) |
| document 09 | [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md) |
| document 10 | [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) |
| document 11 | [11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md) |
| document 12 | [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md) |
| the cards | [TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json); document 09 is the readable copy |
| the legacy addendum | [LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json) |

## 1. Evidence labels and limits

Each outside fact in the package carries one label at the place where it is stated.

| label | meaning |
|---|---|
| [DOC] | Stated on an official page of the product or project: documentation, help centre, pricing page, changelog, terms, privacy page, model card, licence file or the project's own repository page. It means the vendor or project says so. It does not mean the feature works. |
| [CLAIM] | Vendor marketing, a press release, a vendor blog or a founder statement, not independently confirmed. |
| [IND] | An independent third party: press, a review, a forum or a review site. Some of these parties are competitors or affiliates of the product they describe. The notes say so where it applies. |
| [ASSUMED] | An inference or a calculation by the author of the note or document. |
| [UNKNOWN] | Not established from public sources: proprietary, not published, the page could not be read, or the sources conflict. |

Nothing in this package comes from hands-on use of a competitor product. All outside facts were read from public pages on the retrieval dates given, and prices, limits and features may have changed since.

The package has no label for a hands-on result about another product, because there is no such result. A label says how a fact was read. It does not say the fact is true.

Some sources are a third party's own account of using a product, for example a journalist's article. The tables below then give the kind of source in the words of the note. That use is the third party's, not ours.

Research notes 01 to 06 each define the labels near their start. Local rules that differ between notes:

- Note 06 also uses [DOC] for a statement in a paper abstract returned by a scholarly index. The label then covers only what the abstract states. The full texts were not read.
- Some pages were seen only through a search-result summary and were not opened. Note 01 marks these facts "snippet only". Notes 03 and 04 write (snippet) after the label, and note 03 then uses [IND] even for an official page. Note 05 writes "search result" in its source list and uses such items only with [IND]. Note 06 labels a vendor page seen that way [CLAIM]. Document 01 repeats the marker (snippet) beside the keys it concerns.
- Notes 02 and 04 say their pages were read through an automated tool that returns a summary of each page, not the raw text.

Retrieval date. Each research note with outside sources states one access date for all its sources: 2026-11-11. Documents 01, 04 and 07 restate that date for the addresses they copy. The column "retrieved" repeats it. The notes say they were not verified again after they were written.

The column "label" lists the labels found beside the key where it is cited, most frequent first. One page can support a [DOC] statement in one place and an [ASSUMED] calculation in another. The label at the place of use governs.

## 2. Research notes

Ten research notes are kept under evidence/research/. Each opens with a header that says it is evidence and not authority, that it was written on 2026-11-11, and that it was not verified again afterwards. Where a note disagrees with the numbered documents or with the code, those govern.

| note | file | title of the note | source keys it defines |
|---|---|---|---|
| note 01 | [01-higgsfield.md](evidence/research/01-higgsfield.md) | Higgsfield (higgsfield.ai): competitive research | S1 to S46 with letter variants (54 keys). Table 4.1. |
| note 02 | [02-runway-kling-luma-pika.md](evidence/research/02-runway-kling-luma-pika.md) | Competitive research 02: Runway, Kling, Luma, Pika (state as of 2026-11-11) | 80 mnemonic keys such as R-TOS, K-POLICY, L-TOS, P-TOS. Table 4.2. |
| note 03 | [03-pro-editors-blender-oss.md](evidence/research/03-pro-editors-blender-oss.md) | Professional/prosumer editors, Blender, and open-source building blocks for AI video production | No keys. Addresses are listed in its section 11 and given inline where used. Section 5.1. |
| note 04 | [04-emerging-competitors-agents.md](evidence/research/04-emerging-competitors-agents.md) | Emerging competitors and agentic creation tools | No keys. Addresses are listed in its section 9 and given inline where used. Section 5.1. |
| note 05 | [05-video-image-models-providers.md](evidence/research/05-video-image-models-providers.md) | Video and Image Generation Models and Provider Access (state as of 2026-11-11) | S1 to S128 with variants (140 keys). Table 4.4. |
| note 06 | [06-audio-lipsync-consistency-eval.md](evidence/research/06-audio-lipsync-consistency-eval.md) | Voice/audio, lip sync, restoration, consistency methods and evaluation | C-1 to C-20 for papers. Table 4.7. Its other addresses have no keys. Section 5.1. |
| note 07 | [07-code-models-orchestration-security.md](evidence/research/07-code-models-orchestration-security.md) | Code assessment: model adapters, AI orchestration, resource governance, security boundaries, licensing/provenance | None. It holds no outside address. It reads the repository at commit 0284ba8 and its pull requests. |
| note 08 | [08-code-project-timeline-studio-cinema-director-blender.md](evidence/research/08-code-project-timeline-studio-cinema-director-blender.md) | Code assessment: project, timeline, Studio, Cinema, Director, Blender | None. It holds no outside address. It reads the repository at commit 0284ba8 and its pull requests. |
| note 09 | [09-code-sdk-cli-mcp-tests-release.md](evidence/research/09-code-sdk-cli-mcp-tests-release.md) | Code reality: SDK, CLI, MCP, server/core authorities, tests, qualification, release | None. It holds no outside address. It reads the repository at commit 0284ba8 and its pull requests. |
| note 10 | [10-prs-history-active-work.md](evidence/research/10-prs-history-active-work.md) | Pull requests, planning history and active work (Yamakan) | None. It holds no outside address. It reads the repository at commit 0284ba8 and its pull requests. |

The package names a research note in several ways. All of them mean the files in the table above.

| wording | where it is used | notes named this way |
|---|---|---|
| research note NN | cards MPR-201, MPR-203, MPR-204, MPR-208, MPR-801, and their copy in document 09; the README | cards: 05, 06, 07; README: 05 |
| report NN | documents 01 and 10 | document 01: 01, 03, 04; document 10: 01, 02, 06 |
| R03, R05, R06, R07, R10 | document 04 only; its header defines them | 03, 05, 06, 07, 10 |
| the video and image note; the audio and lip-sync note | document 07 | 05; 06 |
| the code note 08 | document 01 | 08 |

A part or section reference after the name is a heading inside that note. Examples: "research note 05 Part E" and "research note 06 sections 7.2 to 7.4" in the cards, and "R05 E.6" and "R06 §8" in document 04. Those headings exist in the notes. Document 07 also writes "research note C.7" and "research note sections C.7, D.3, 9". Those are sections of note 05.

The cards use no source key. Where a card relies on an outside fact it names the research note. Cards MPR-208, MPR-221, MPR-222, MPR-701 also mention the research notes without a number.

R-style tokens were checked in every file of the package. Only document 04 uses an R token for a research note. The R tokens in the cards do not refer to research notes: R-01, R-02 and R-03 (cards MPR-210, MPR-222, MPR-601, MPR-602, MPR-603, MPR-604, MPR-605, MPR-606) are research prerequisites of the earlier System Supremacy plan, and R1 and R2 (cards MPR-801, MPR-802, MPR-803) are the two revision requests of the benchmark. Section 6.2 lists every meaning of R found.

## 3. Key families

| family | form of the key | defined in | restated in | cited in | keys | table |
|---|---|---|---|---|---|---|
| Higgsfield sources | S and a number, sometimes a letter; HF-S and the same number in documents 00 and 01 | note 01, section (j) | document 01, section 9 (27 keys, as HF-S) | note 01; document 10; as HF-S: documents 00 and 01 | 54 | 4.1 |
| Runway, Kling, Luma, Pika sources | R-, K-, L- or P- and a word; a few other words | note 02, section 9 | document 01, section 9 (57 keys) | note 02; documents 00 and 01 | 80 | 4.2 |
| Other products, keyed in document 01 | two or three letters, a hyphen and a number, for example AD-3 | document 01, section 9 | none | documents 00 and 01 | 92 | 4.3 |
| Video and image models and providers | S and a number, sometimes with a letter, -ind or -note | note 05, section 9 | document 07, section 10 (93 keys) | note 05; document 07 | 140 | 4.4 |
| Speech, music, lip sync, restoration | V- and a word | document 07, section 10 | none | document 07 | 30 | 4.5 |
| Model licences and reuse | U and a number | document 04, section 8 | none | document 04 | 60 | 4.6 |
| Papers | C- and a number | note 06, section 11.6 | none | note 06 | 20 | 4.7 |

Total: 476 keys. Document 04 also lists 7 topic lines without a key (section 5.2).

## 4. Key tables

Columns: the key; what it is, in the words of the file that defines it; the address exactly as that file gives it; the labels found beside the key; the retrieval date; where the key is defined; where it is cited. "Not cited" in the label column means the key is defined but no statement uses it.

### 4.1 Higgsfield sources (note 01; HF-S keys of document 01)

Defined in note 01, section (j) Source list. The note says all sources were accessed 2026-11-11. In note 01 and in document 10 the key is written S7. In documents 00 and 01 the same source is written HF-S7. Document 10 points to this numbering as "S7–S38 as listed in report 01". Do not confuse it with the S numbering of note 05 (table 4.4 and section 6.1). Rows are in key order.

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| S1 / HF-S1 | Terms of Use (last updated 23 Oct 2026). | https://higgsfield.ai/terms | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S1 in document 01, section 9 | note 01, document 10; as HF-S1: document 00, document 01 |
| S2 | Privacy Policy (last updated 31 Oct 2026). | https://higgsfield.ai/privacy-policy | [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S3 / HF-S3 | Blog: Cinema Studio 4.0 (12 Aug 2026). | https://higgsfield.ai/blog/cinema-studio-4-0 | [CLAIM], [ASSUMED] | 2026-11-11 | note 01, section (j); restated as HF-S3 in document 01, section 9 | note 01; as HF-S3: document 01 |
| S4 / HF-S4 | Help: How do I use Cinema Studio. | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-cinema-studio | [DOC], [ASSUMED] | 2026-11-11 | note 01, section (j); restated as HF-S4 in document 01, section 9 | note 01; as HF-S4: document 01 |
| S5 / HF-S5 | Help: How do I use Canvas. | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-canvas | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S5 in document 01, section 9 | note 01; as HF-S5: document 00, document 01 |
| S6 / HF-S6 | Official site index. | https://higgsfield.ai/llms.txt | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S6 in document 01, section 9 | note 01; as HF-S6: document 01 |
| S7 / HF-S7 | Cinema Studio 4.0 landing page. | https://higgsfield.ai/cinematic-video-generator | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S7 in document 01, section 9 | note 01, document 10; as HF-S7: document 00, document 01 |
| S8 / HF-S8 | AI Video Editor page. | https://higgsfield.ai/ai-video-editor | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S8 in document 01, section 9 | note 01; as HF-S8: document 00, document 01 |
| S9 / HF-S9 | Help: External integrations. | https://higgsfield.ai/creator-hub/help-center/integrations/external-integrations-higgsfield | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S9 in document 01, section 9 | note 01, document 10; as HF-S9: document 01 |
| S10 / HF-S10 | Help: How do I use Supercomputer (modified 26 Oct 2026). | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-supercomputer | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S10 in document 01, section 9 | note 01, document 10; as HF-S10: document 01 |
| S11 / HF-S11 | Help: Create and use a Soul ID character. | https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S11 in document 01, section 9 | note 01; as HF-S11: document 00, document 01 |
| S12 / HF-S12 | Popcorn storyboard page. | https://higgsfield.ai/storyboard-generator | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S12 in document 01, section 9 | note 01; as HF-S12: document 01 |
| S13 | Help: Which Higgsfield tool should I use. | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/which-higgsfield-tool-should-i-use | [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S14 / HF-S14 | Changelog and RSS feed. | https://higgsfield.ai/creator-hub/changelog and https://higgsfield.ai/creator-hub/changelog/rss.xml | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S14 in document 01, section 9 with 1 of 2 addresses | note 01, document 10; as HF-S14: document 00, document 01 |
| S15 / HF-S15 | Canvas intro page. | https://higgsfield.ai/canvas-intro | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S15 in document 01, section 9 | note 01; as HF-S15: document 01 |
| S16 / HF-S16 | Enterprise page. | https://higgsfield.ai/enterprise | [DOC], [CLAIM] | 2026-11-11 | note 01, section (j); restated as HF-S16 in document 01, section 9 | note 01; as HF-S16: document 01 |
| S17 / HF-S17 | Help: How credits work. | https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work.md | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S17 in document 01, section 9 | note 01, document 10; as HF-S17: document 00, document 01 |
| S18 | Pricing page (script shell only) and Team page (404). | https://higgsfield.ai/pricing and https://higgsfield.ai/team | [DOC] | 2026-11-11 | note 01, section (j) | note 01, document 10 |
| S19 | Blog: Credits vs Unlimited (15 Sep 2026). | https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation | [CLAIM] | 2026-11-11 | note 01, section (j) | note 01, document 10 |
| S20 / HF-S20 | Blog: AI short film pipeline (29 Jul 2026). | https://higgsfield.ai/blog/ai-short-film-pipeline | [CLAIM] | 2026-11-11 | note 01, section (j); restated as HF-S20 in document 01, section 9 | note 01; as HF-S20: document 01 |
| S21 | Blog: Higgsfield API (16 Sep 2026). | https://higgsfield.ai/blog/higgsfield-api | [CLAIM], [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S21a / HF-S21a | Help: What are Unlimited models. | https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S21a in document 01, section 9 | note 01; as HF-S21a: document 01 |
| S22 / HF-S22 | Help: Connect Higgsfield to an AI agent (MCP). | https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent ; also https://higgsfield.ai/mcp and https://higgsfield.ai/enterprise-help-center/platform/integrations | [DOC], [CLAIM] | 2026-11-11 | note 01, section (j); restated as HF-S22 in document 01, section 9 with 1 of 3 addresses | note 01; as HF-S22: document 00, document 01 |
| S23 / HF-S23 | Help: Access Higgsfield via CLI. | https://higgsfield.ai/creator-hub/help-center/mcp-cli/how-do-i-access-higgsfield-via-cli | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S23 in document 01, section 9 | note 01; as HF-S23: document 01 |
| S24 / HF-S24 | API docs FAQ. | https://docs.higgsfield.ai/docs/help/faq.md | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S24 in document 01, section 9 | note 01; as HF-S24: document 00, document 01 |
| S24a | API docs: rate limits. | https://docs.higgsfield.ai/docs/concepts/rate-limits.md | [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S25 / HF-S25 | Help: What is the Higgsfield API. | https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S25 in document 01, section 9 | note 01, document 10; as HF-S25: document 01 |
| S26 | Search-result snippets only, pages not fetched (Soul ID blog, Ads 2.0 blog, upscale troubleshooting, enterprise projects help, All Unlimited blog, Kapwing, Flowith, G2, review round-ups, docs index). | Representative: https://higgsfield.ai/blog/keep-ai-character-consistent ; https://higgsfield.ai/blog/higgsfield-all-unlimited-explained ; https://higgsfield.ai/creator-hub/help-center/troubleshooting/my-video-upscale-is-stuck-or-failed-what-should-i-do ; https://higgsfield.ai/enterprise-help-center/manage-account/projects ; https://www.g2.com/sellers/higgsfield ; https://docs.higgsfield.ai/llms.txt | [IND], [CLAIM], [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S27 | Blog: 11.11 deals (11 Nov 2026). | https://higgsfield.ai/blog/higgsfield-11-11-deals | [CLAIM] | 2026-11-11 | note 01, section (j) | note 01 |
| S28 | Help: How do Higgsfield plans work. | https://higgsfield.ai/creator-hub/help-center/plans/how-do-higgsfield-plans-work.md | [DOC] | 2026-11-11 | note 01, section (j) | note 01 |
| S29 / HF-S29 | Help: Content flagged as NSFW; Trust page. | https://higgsfield.ai/creator-hub/help-center/troubleshooting/content-flagged-as-nsfw and https://higgsfield.ai/trust | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S29 in document 01, section 9 with 1 of 2 addresses | note 01; as HF-S29: document 01 |
| S30 | Trustpilot, Higgsfield AI. Kind of source, per the note: Review site, read 11 Nov 2026. | https://uk.trustpilot.com/review/higgsfield.ai | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S30a / HF-S30a | Help: Who owns my generations. | https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially | [DOC] | 2026-11-11 | note 01, section (j); restated as HF-S30a in document 01, section 9 | note 01, document 10; as HF-S30a: document 01 |
| S31 / HF-S31 | Taylor Lorenz, User Mag (30 Jul 2026). Kind of source, per the note: Journalist hands-on. | https://www.usermag.co/p/my-journey-into-the-slop-factory | [IND] | 2026-11-11 | note 01, section (j); restated as HF-S31 in document 01, section 9 | note 01; as HF-S31: document 01 |
| S32 | PiunikaWeb (11 Feb 2026). Kind of source, per the note: Press. | https://piunikaweb.com/2026/02/11/higgsfield-ai-ceo-speaks-up-after-x-account-suspension-negative-pr/ | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S33 | The Register (6 Feb 2026). Kind of source, per the note: Press. | https://www.theregister.com/2026/02/06/higgsfield_ai_job_loss/ | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S34a | MindStudio: terms of service backlash (28 Jul 2026). Kind of source, per the note: Competitor blog. | https://mindstudio.ai/blog/higgsfield-terms-of-service-backlash | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S34b | MindStudio: subscription cancellation complaints. Kind of source, per the note: Competitor blog. | https://www.mindstudio.ai/blog/higgsfield-subscription-cancellation-complaints | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S34c | X DOT AI newsletter (24 Jul 2026). Kind of source, per the note: Newsletter. | https://xdotai.beehiiv.com/p/higgsfield-has-updated-its-terms-creators-should-read-them-before-clicking-accept | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S34d | AI Tool Curator: terms and privacy update. Kind of source, per the note: Guide site. | https://www.aitoolcurator.com/learn/higgsfield-guide/terms-privacy-policy-update/ | not cited | 2026-11-11 | note 01, section (j) | defined only; no use found |
| S35a | r/HiggsfieldAI subreddit snapshot (archive, 25 Apr 2026). Kind of source, per the note: Forum archive. | https://reddit.sentinel-team.org/subreddits/HiggsfieldAI/snapshots/2026-04-25T00%3A11%3A40.375255Z | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S35b | r/generativeAI post on a bad experience (archive snapshot 20 May 2026). Kind of source, per the note: Forum archive. | https://reddit.sentinel-team.org/posts/1ti8536/snapshots/2026-05-20T18%3A21%3A40.772808Z | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S35c | r/HiggsfieldAI user review post (archive snapshot 3 Jun 2026). Kind of source, per the note: Forum archive. | https://reddit.sentinel-team.org/posts/1tu8a80/snapshots/2026-06-03T21%3A12%3A01.444315Z | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S36 / HF-S36 | The Post Flow review (updated 7 Nov 2026). Kind of source, per the note: Review, not hands-on. | https://thepostflow.com/ai/higgsfield-ai-review/ | [IND] | 2026-11-11 | note 01, section (j); restated as HF-S36 in document 01, section 9 | note 01, document 10; as HF-S36: document 01 |
| S37 | Krea: Higgsfield pricing explained (data captured 31 Aug 2026). Kind of source, per the note: Competitor blog. | https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs | [IND] | 2026-11-11 | note 01, section (j) | note 01, document 10 |
| S38 / HF-S38 | AI Funnel Insider review (updated 31 Oct 2026). Kind of source, per the note: Affiliate site, not hands-on. Document 01 marks it (affiliate). | https://aifunnelinsider.com/higgsfield-ai-review-2026/ | [IND] | 2026-11-11 | note 01, section (j); restated as HF-S38 in document 01, section 9 | note 01, document 10; as HF-S38: document 01 |
| S39 | Press release, Cinema Studio 4.0 (PR Newswire copy, 28 Oct 2026). | https://www.webull.com/news/15825991486301184 | [CLAIM] | 2026-11-11 | note 01, section (j) | note 01 |
| S40 | SiliconANGLE: $400M raise (17 Aug 2026). Kind of source, per the note: Press. | https://siliconangle.com/2026/08/17/higgsfield-raises-400m-at-5-4-billion-valuation-to-scale-video-and-image-generation-platform/ | [CLAIM], [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S41 | TNW: Supercomputer enterprise marketing (19 Jun 2026). Kind of source, per the note: Press. | https://thenextweb.com/news/higgsfield-supercomputer-enterprise-marketing-nvidia | [CLAIM], [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S42 | Secondary coverage of the Forbes investigation (Feb 2026); original not fetched. Kind of source, per the note: Press, secondary. | No address in the note. The note says: Forbes regional editions and digests found via search; original article URL not confirmed | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S43 | Sacra analysis note on moderation and enterprise sales. Kind of source, per the note: Analyst note. | https://sacra.com/chat/h/78077664-0525-4adb-8d9a-234f6f551e38/ | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S44 | Supercomputer launch coverage (snippets only). Kind of source, per the note: Press and blogs. | https://runtimewire.com/article/higgsfield-schedules-no-code-ai-video-production ; https://neuronfeed.com/news/higgsfield-supercomputer-launch | [IND] | 2026-11-11 | note 01, section (j) | note 01 |
| S45 / HF-S45 | ChatCut vs Higgsfield (checked 7 Nov 2026). Kind of source, per the note: Competitor comparison. Document 01 marks it (competitor). | https://chatcut.io/compare/chatcut-vs-higgsfield | [IND] | 2026-11-11 | note 01, section (j); restated as HF-S45 in document 01, section 9 | note 01; as HF-S45: document 01 |
| S46 | App Store search results for Higgsfield and Diffuse (snippets only; US listing returned 404). Kind of source, per the note: Store listing. | https://apps.apple.com/il/app/diffuse-ai-video-generator/id6474068152 | [IND] | 2026-11-11 | note 01, section (j) | note 01 |

### 4.2 Runway, Kling, Luma and Pika sources (note 02; restated in document 01)

Defined in note 02, section 9. Sources (all accessed 2026-11-11). For most keys the note gives the key and the address alone, under a product name. The column "what it is" then gives that product name and any remark the note adds after the address.

#### Runway

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| R-CHG | Listed under Runway in note 02. | https://runway.com/changelog | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| R-PRICE | Listed under Runway in note 02. | https://runway.com/pricing | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-TOS | Listed under Runway in note 02. The note adds: last updated 2026-10-23. | https://runway.com/terms-of-use | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-GWM | Listed under Runway in note 02. | https://runway.com/research/introducing-runway-gwm-1 | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| R-LGF | Listed under Runway in note 02. | https://runway.com/news/runway-and-lionsgate-expand-partnership | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| R-GEN45 | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/46974685288467 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-EDIT | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/51683104370451 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| R-ACT2 | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/42311337895827 | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-DEPR | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/40213860628371 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-TL | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/52685547867667 | [DOC], [UNKNOWN] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-AGENT | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/51601639579667 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| R-REF | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/52963720640275 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-UNL1 | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/52068047744019 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-UNL2 | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/18053095835795 | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-RIGHTS | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/18927776141715 | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-SEC | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/24300377879827 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-ENT | Listed under Runway in note 02. | https://help.runwayml.com/hc/en-us/articles/48625698573075 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-HELP-SNIP | Listed under Runway in note 02. The note says: help.runwayml.com article seen only as a search-result snippet (local-editor recommendation, 35 GB export); exact URL not captured. | No address in the note. | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-API | Listed under Runway in note 02. | https://docs.dev.runwayml.com/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-API-PRICE | Listed under Runway in note 02. | https://docs.dev.runwayml.com/guides/pricing/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-API-TIERS | Listed under Runway in note 02. | https://docs.dev.runwayml.com/usage/tiers/ | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-API-MODELS | Listed under Runway in note 02. | https://docs.dev.runwayml.com/guides/models/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-API-PRO | Listed under Runway in note 02. | https://docs.dev.runwayml.com/guides/professional-outputs/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| R-API-ATTR | Listed under Runway in note 02. | https://docs.dev.runwayml.com/usage/attribution/ | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-API-USE | Listed under Runway in note 02. | https://docs.dev.runwayml.com/guides/using-the-api/ | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| R-API-MOD | Listed under Runway in note 02. | https://docs.dev.runwayml.com/api-details/moderation/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| T-RUNWAY | Listed under Runway in note 02. | https://www.trustpilot.com/review/runwayml.com | [IND] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |

#### Kling

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| K-BLOG40 | Listed under Kling in note 02. | https://kling.ai/blog/kling-4-ai-video-model ; https://kling.ai/blog/kling40-kling-visual-realism-creative-control-introducing-storytelling | [DOC], [UNKNOWN] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 with 1 of 2 addresses | note 02, document 01 |
| K-DIRECTOR | Listed under Kling in note 02. | https://kling.ai/blog/kling-video-3-director-mode-multi-shot-tutorial | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-CREDIT | Listed under Kling in note 02. The note adds: 2026-07-28. | https://kling.ai/blog/kling-video-3-0-credit-cost-guide | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-PR30 | Listed under Kling in note 02. The note says: Kling 3.0 press release, February 2026 (found via search; wire copy). | No address in the note. | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| K-POLICY | Listed under Kling in note 02. The note adds: last updated 2026-04-21. | https://kling.ai/docs/user-policy | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-CAP | Listed under Kling in note 02. | https://kling.ai/document-api/guides/capability-map/video.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-USE40 | Listed under Kling in note 02. | https://kling.ai/document-api/api/usage-guide/kling-4-0.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| K-I2V40 | Listed under Kling in note 02. | https://kling.ai/document-api/api/video/4-0/image-to-video.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| K-CALLBACK | Listed under Kling in note 02. | https://kling.ai/document-api/api/get-started/callbacks.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-CONC | Listed under Kling in note 02. | https://kling.ai/document-api/api/get-started/concurrency-rules.md | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| K-APIPRICE | Listed under Kling in note 02. | https://kling.ai/document-api/pricing/base/video.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-APITOS | Listed under Kling in note 02. The note adds: effective 2026-04-21. | https://kling.ai/document-api/guides/protocols/paid-service.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| K-KS-Q1 | Listed under Kling in note 02. | https://kuaishou.gcs-web.com/news-releases/news-release-details/kuaishou-technology-announces-first-quarter-2026-unaudited | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| T-KLING | Listed under Kling in note 02. | https://www.trustpilot.com/review/kling.ai | [IND] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |

#### Luma

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| L-NEWS | Listed under Luma in note 02. | https://lumalabs.ai/news | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-PRICE | Listed under Luma in note 02. | https://lumalabs.ai/pricing | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-RAY32 | Listed under Luma in note 02. | https://lumalabs.ai/news/introducing-ray-3-2 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-RAY314 | Listed under Luma in note 02. | https://lumalabs.ai/news/ray3_14 | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| L-MODIFY | Listed under Luma in note 02. | https://lumalabs.ai/news/ray3-modify | [DOC], [ASSUMED] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-SCENES | Listed under Luma in note 02. | https://lumalabs.ai/news/introducing-luma-scenes | [DOC], [ASSUMED], [CLAIM] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-SKILLS | Listed under Luma in note 02. | https://lumalabs.ai/news/luma-skills | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-VARIANTS | Listed under Luma in note 02. | https://lumalabs.ai/news/introducing-luma-variants | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| L-MCP | Listed under Luma in note 02. | https://lumalabs.ai/news/new-luma-mcp | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-SERIESC | Listed under Luma in note 02. | https://lumalabs.ai/news/series-c | [CLAIM] | 2026-11-11 | note 02, section 9 | note 02 |
| L-TOS | Listed under Luma in note 02. The note adds: last updated 2026-05-14. | https://lumalabs.ai/legal/tos | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-APIPRICE | Listed under Luma in note 02. | https://lumalabs.ai/api/pricing | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-API-OLD | Listed under Luma in note 02. | https://docs.lumalabs.ai/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-API-VID | Listed under Luma in note 02. | https://docs.lumalabs.ai/docs/video-generation.md | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| L-API-RL | Listed under Luma in note 02. | https://docs.lumalabs.ai/docs/rate-limits.md | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| L-API-FAQ | Listed under Luma in note 02. | https://docs.lumalabs.ai/docs/faq.md | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-AG | Listed under Luma in note 02. | https://docs.agents.lumalabs.ai/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-AG-VID | Listed under Luma in note 02. | https://docs.agents.lumalabs.ai/guides/videos/generation/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 00, document 01 |
| L-AG-RL | Listed under Luma in note 02. | https://docs.agents.lumalabs.ai/guides/rate-limits/ | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| L-AG-FAQ | Listed under Luma in note 02. | https://docs.agents.lumalabs.ai/guides/faq/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| L-HELP-SNIP | Listed under Luma in note 02. The note says: Luma help-centre and billing-policy pages seen only through search-result summaries; not opened. Document 01 marks it (snippet). | https://lumaai-help.freshdesk.com/support/solutions/articles/151000220904 ; https://lumalabs.ai/legal/billing-policy | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 with 1 of 2 addresses | note 02, document 01 |
| EESEL-L | Listed under Luma in note 02. The note adds: last edited 2026-06-05; publisher sells other AI tools. | https://eesel.ai/blog/luma-ai-pricing | [IND] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| T-LUMA | Listed under Luma in note 02. | https://www.trustpilot.com/review/lumalabs.ai | [IND] | 2026-11-11 | note 02, section 9 | note 02 |

#### Pika

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| P-HOME | Listed under Pika in note 02. | https://pika.art/ | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-PRICE | Listed under Pika in note 02. | https://pika.art/pricing | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-FAQ | Listed under Pika in note 02. | https://pika.art/faq | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-TOS | Listed under Pika in note 02. The note adds: last updated 2026-08-04. | https://pika.art/terms-of-service | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-BLOG | Listed under Pika in note 02. | https://pika.art/blog | [DOC], [CLAIM] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-NEW | Listed under Pika in note 02. | https://pika.art/blog/welcome-to-the-new-pika | [DOC], [CLAIM] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-H3 | Listed under Pika in note 02. | https://pika.art/blog/pika-h3-flex | [DOC], [CLAIM] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-H3R | Listed under Pika in note 02. | https://pika.art/blog/pika-h3-flex-research | [DOC], [CLAIM] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-CLUB | Listed under Pika in note 02. | https://pika.art/blog/pika-api-club | [CLAIM], [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| P-VS | Listed under Pika in note 02. | https://create.pika.art/apps/create-video | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-25 | Listed under Pika in note 02. | https://create.pika.art/apps/pika-2-5 | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-DEV | Listed under Pika in note 02. | https://dev.pika.art/ | [DOC], [ASSUMED] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| P-DEVTOS | Listed under Pika in note 02. | https://dev.pika.art/terms-of-service | [DOC] | 2026-11-11 | note 02, section 9 | note 02 |
| P-HF | Listed under Pika in note 02. | https://huggingface.co/Pika-Labs/Pika-H3-Flex | [DOC] | 2026-11-11 | note 02, section 9; restated in document 01, section 9 | note 02, document 01 |
| SEMAFOR | Listed under Pika in note 02. | https://www.semafor.com/article/09/17/2026/video-ai-company-pika-offers-tool-to-speed-up-ai-video-creation | [IND] | 2026-11-11 | note 02, section 9 | note 02 |
| T-PIKA | Listed under Pika in note 02. | https://www.trustpilot.com/review/pika.art | [IND] | 2026-11-11 | note 02, section 9 | note 02 |

### 4.3 Other products, keyed in document 01 only

Defined in document 01, section 9, which says the addresses were copied from the research notes and accessed 2026-11-11. Document 01 gives no title for these keys, only a product group and the address. The column "what it is" therefore gives the group and the place in the research notes where the same address is listed. Where the address also has a key in note 05, that key and its description are given.

#### Adobe

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| AD-1 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187 | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-2 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://www.adobe.com/products/firefly/plans.html | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-3 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://www.adobe.com/products/premiere.html | [CLAIM], [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-4 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe; note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Complaints and provenance. | https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699 | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-5 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://developer.adobe.com/premiere-pro/uxp/changelog | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-6 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://blog.adobe.com/en/publish/2026/11/10/adobe-firefly-premiere-mobile-ways-create-videos-edit-content-perfect-soundtrack-stories | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-7 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://blog.adobe.com/en/publish/2026/11/10/explore-new-ways-create-across-creative-cloud-adobe-firefly-while-advancing-craft-precision-choice-control | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-8 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://www.adobe.com/ai/overview/firefly/gen-ai-approach.html | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-9 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://nofilmschool.com/adobe-generative-media-tool | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-13 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://community.adobe.com/announcements-727/meet-your-new-assistant-editor-ai-assistant-in-premiere-pro-is-now-in-public-beta-1629317 | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-15 | Listed under Adobe in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Complaints and provenance. | https://community.adobe.com/t5/adobe-firefly-bugs/credits-are-being-deducted-even-when-video-generation-fails/idi-p/15659871 | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| AD-16 | Listed under Adobe in document 01. Address listed in: note 03 source list, under Adobe. | https://community.adobe.com/bug-reports-728/premiere-xml-exports-semantically-suspicious-transition-ratio-values-for-ol-cross-dissolve-1556968 | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### DaVinci Resolve

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| DR-1 | Listed under DaVinci Resolve in document 01. Address listed in: note 03 source list, under DaVinci Resolve. | https://www.blackmagicdesign.com/products/davinciresolve/studio | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| DR-2 | Listed under DaVinci Resolve in document 01. Address listed in: note 03 source list, under DaVinci Resolve (the note adds: Resolve 21 free readme). | https://www.blackmagicdesign.com/support/content/readme/6aefbffe870f4ba686e61ecb83b19ec0 | [DOC], [ASSUMED] | 2026-11-11 | document 01, section 9 | document 01 |
| DR-3 | Listed under DaVinci Resolve in document 01. Address listed in: note 03 source list, under DaVinci Resolve (the note adds: Resolve Studio 21.1 readme). | https://www.blackmagicdesign.com/support/content/readme/baf7c071c0524fbf8ccc961925c9f443 | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| DR-6 | Listed under DaVinci Resolve in document 01. Address listed in: note 03 source list, under DaVinci Resolve. | https://digitalproduction.com/2026/09/08/resolve-21-1-adds-mcp-and-finally-gets-presets/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| DR-7 | Listed under DaVinci Resolve in document 01. Address listed in: note 03 source list, under DaVinci Resolve. | https://www.cined.com/davinci-resolve-21-hands-on-at-nab-2026-photo-page-intellisearch-and-cinefocus-in-action/ | [IND], [ASSUMED] | 2026-11-11 | document 01, section 9 | document 01 |
| DR-10 | Listed under DaVinci Resolve in document 01. Document 01 marks it (snippet): only a search summary was seen. Address listed in: note 03 source list, under DaVinci Resolve (the note adds: snippet only). | https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1411.htm | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### CapCut

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| CC-1 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/help/how-to-export-pro-project | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-2 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/clause/privacy | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-3 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/clause/terms-of-service | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-4 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/ideas/seedance-2-0-for-pc | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-5 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://capcut.com/resource/is-capcut-pc-free-for-ai-video-editing | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-6 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/features/dreamina-seedance-price | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-7 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://www.capcut.com/help/join-capcut-pro-for-exporting | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CC-8 | Listed under CapCut in document 01. Address listed in: note 03 source list, under CapCut. | https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### Blender

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| BL-1 | Listed under Blender in document 01. Address listed in: text of note 03 (its source list does not give this full address). | https://developer.blender.org/docs/release_notes/5.3/sequencer/ | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-2 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://docs.blender.org/manual/en/latest/render/layers/passes.html | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-3 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-4 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://docs.blender.org/manual/en/latest/getting_started/about/license.html | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-7 | Listed under Blender in document 01. Address listed in: text of note 03 (its source list does not give this full address). | https://opendata.blender.org | [ASSUMED] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-8 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://nvd.nist.gov/vuln/detail/CVE-2026-10688 | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-9 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://www.cgchannel.com/?p=175735 | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-10 | Listed under Blender in document 01. Address listed in: text of note 03 (its source list does not give this full address). | https://developer.blender.org/docs/release_notes/5.3/pipeline_io/ | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-12 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://github.com/tin2tin/Pallaidium | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| BL-13 | Listed under Blender in document 01. Address listed in: note 03 source list, under Blender. | https://docs.blender.org/manual/en/dev/video_editing/storyboarding/app_template.html | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |

#### Google Flow

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| GF-1 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-2 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://venturebeat.com/ai/google-releases-new-ai-video-model-veo-3-1-in-flow-and-api-what-it-means-for | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-3 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://yourstory.com/ai-story/google-veo-31-flow-ai-editing-tool | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-4 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://aitoolsatlas.ai/tools/flow | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-5 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://discuss.ai.google.dev/t/veo-flow-generation-issues-lost-credits-consistency-problems-and-excessive-failed-generations/147374 | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-6 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://rar.design/posts/google-flow-omni-agent-tools-complete-guide | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| GF-8 | Listed under Google Flow in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Google Flow. | https://design-offset.com/202604-google-flow-updates/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### Lightricks

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| LX-1 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-2 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/desktop-assistant.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-3 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/gen-space-and-video-editor.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-4 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Fetched independent sources (the note adds: first 100,000 characters read). | https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/ | [IND] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| LX-5 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Lightricks. | https://stacksheriff.com/ai-tools/ltx-studio-review/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-6 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Lightricks. | https://the-decoder.com/lightricks-open-sources-ai-video-model-ltx-2-challenges-sora-and-veo/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-7 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/Lightricks/LTX-Desktop | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| LX-8 | Listed under Lightricks in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Lightricks. | https://dupple.com/reviews/ltx-studio | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### Flora

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| FL-1 | Listed under Flora in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.flora.ai/llms.txt | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| FL-2 | Listed under Flora in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.flora.ai/mcp/cost-and-limits.md | [DOC] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| FL-3 | Listed under Flora in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.flora.ai/mcp/security.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| FL-4 | Listed under Flora in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.flora.ai/legal/data-security-and-ip.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| FL-5 | Listed under Flora in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.flora.ai/plans-and-billing/pricing | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| FL-6 | Listed under Flora in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Flora, Figma Weave, Magnific, Krea. | https://www.testingcatalog.com/flora-launches-fauna-ai-design-agent-for-teams | [IND] | 2026-11-11 | document 01, section 9 | document 01 |

#### ComfyUI

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| CU-1 | Listed under ComfyUI in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages); note 05 key S63 (ComfyUI partner nodes overview). | https://docs.comfy.org/tutorials/partner-nodes/overview | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CU-2 | Listed under ComfyUI in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://docs.comfy.org/development/cloud/mcp-server | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CU-4 | Listed under ComfyUI in document 01. Document 01 marks it (snippet): only a search summary was seen. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line ComfyUI. | https://docs.comfy.org/agent-tools/comfy-cli | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |

#### Other products and projects

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| OC-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://raw.githubusercontent.com/0xsline/OpenChatCut/main/README.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| CH-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://chatcut.io/docs/what-is-chatcut.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| PA-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/palmier-io/palmier-pro | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OM-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/calesthio/OpenMontage | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| HY-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/heygen-com/hyperframes | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| VM-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/HKUDS/ViMax | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| VF-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://github.com/vericontext/vibeframe | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| KP-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://www.kapwing.com/help/release-notes-august-2026-2/ | [DOC] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| IV-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Invideo, ElevenLabs, HeyGen, Descript, Kapwing. | https://www.trustpilot.com/review/invideo.io ; https://aireiter.com/blog/invideo-ai-review | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| EL-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://elevenlabs.io/docs/creative-platform/products/studio | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| KR-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://www.krea.ai/docs/llms.txt | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| SD-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://seed.bytedance.com/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 | [CLAIM] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| SD-2 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line ByteDance and other model vendors. | https://www.nbcnews.com/tech/tech-news/seedance-2-bytedance-copyright-infringement-concerns-hollywood-rcna259173 | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| FA-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Aggregators. | https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server | [CLAIM] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| WS-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages). | https://wavespeed.ai/ | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| MO-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched independent sources. | https://news.ycombinator.com/item?id=45980760 | [CLAIM], [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| DC-1 | Listed under Other products and projects in document 01. Document 01 marks it (snippet): only a search summary was seen. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Other platforms. | https://docs.platform.decart.ai/getting-started/pricing | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OD-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Other platforms. | https://odyssey.ml/ | [CLAIM] | 2026-11-11 | document 01, section 9 | document 01 |
| OA-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages); note 05 key S1 (OpenAI API deprecations). | https://developers.openai.com/api/docs/deprecations | [DOC] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| ST-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Flora, Figma Weave, Magnific, Krea. | https://thenextweb.com/news/freepik-rebrands-as-magnific | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| ST-2 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Flora, Figma Weave, Magnific, Krea. | https://www.fastcompany.com/91431691/figma-weave-weavy-acquisition | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| ST-3 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Other platforms. | https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| ST-4 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Aggregators. | https://www.helpnetsecurity.com/2025/11/17/cloudflare-to-acquire-replicate/ | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| CP-1 | Listed under Other products and projects in document 01. Address listed in: note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Complaints and provenance. | https://dev.to/smophyai/the-real-cost-of-ai-video-in-2026-why-credit-systems-cost-more-than-the-sticker-price-j6h | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| MD-1 | Listed under Other products and projects in document 01. Document 01 marks it (snippet): only a search summary was seen. Address listed in: note 05 key S47 (Artificial Analysis text-to-video leaderboard (search snippet)); note 06 source list, 11.1 Part A — voice and audio. | https://artificialanalysis.ai/video/leaderboard/text-to-video | [IND] | 2026-11-11 | document 01, section 9 | document 01 |
| MD-2 | Listed under Other products and projects in document 01. Address listed in: note 05 key S43 (LTX open-source system requirements). | https://docs.ltx.io/open-source-model/getting-started/system-requirements.md | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OS-1 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components. | https://github.com/AcademySoftwareFoundation/OpenTimelineIO | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OS-2 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components; note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Video as code. | https://www.remotion.dev/docs/export-opentimeline | [DOC] | 2026-11-11 | document 01, section 9 | document 00, document 01 |
| OS-5 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components. | https://www.remotion.dev/docs/license/pricing | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OS-6 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components. | https://github.com/redotvideo/revideo | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OS-7 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components. | https://github.com/motion-canvas/motion-canvas | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |
| OS-8 | Listed under Other products and projects in document 01. Address listed in: note 03 source list, under Open-source components; note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Agentic editors and pipelines. | https://github.com/OpenCut-app/OpenCut | [DOC] | 2026-11-11 | document 01, section 9 | document 01 |

### 4.4 Video and image models and providers (note 05; restated in document 07)

Defined in note 05, section 9. The note says the access date for all entries is 2026-11-11, and that "search result" marks an item seen in web-search output and not necessarily fetched in full. In note 05 and in document 07 the key is written S13. Do not confuse it with the S numbering of note 01 (table 4.1 and section 6.1).

#### Note 05, section 9.1 Hosted video vendors (Part A)

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| S1 | OpenAI API deprecations. | https://developers.openai.com/api/docs/deprecations | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S1-ind | third-party Sora shutdown reports (search results). | https://dev.to/mr_manushukla/sora-2-and-the-videos-api-shut-down-on-24-september-2026-the-migration-and-the-real-cost-per-second-bek ; https://wavespeed.ai/blog/ai-guides/sora-2-api-shutdown-migration-guide/ ; https://benchlm.ai/media-pricing/sora | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S2 | OpenAI models. | https://developers.openai.com/api/docs/models | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S3 | Google Gemini API pricing. | https://aistudio.google.com/docs/pricing | [DOC], [UNKNOWN] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S4 | Google Gemini API video (Veo) page. | https://aistudio.google.com/docs/video | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S5 | Google Gemini Omni guide. | https://aistudio.google.com/docs/omni | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S6 | Google Gemini API deprecations. | https://aistudio.google.com/docs/deprecations | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S7 | Vertex AI Veo 3.1 model page. | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S8-ind | third-party Veo price reports (search results). | https://the-decoder.com/googles-veo-3-1-lite-cuts-video-generation-costs-by-more-than-half/ ; https://benchlm.ai/media-pricing/veo | [IND] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S9 | BytePlus blog, Seedance 2.5. | https://byteplus.com/en/blog/dreamina-seedance2-5 | [CLAIM] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S10 | ByteDance Seed blog, Seedance 2.5. | https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 | [CLAIM] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S11a | Volcengine Ark video generation API (create task). | https://docs.volcengine.com/docs/82379/1520757 | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S11b | BytePlus ModelArk docs (navigation only). | https://docs.byteplus.com/ | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S11c | Volcengine Ark cancel / delete task. | https://docs.volcengine.com/docs/82379/1521720 | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S11d | Volcengine Ark pricing. | https://docs.volcengine.com/docs/82379/1099320 | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S11-ind | third-party Seedance identifiers and prices (search results). | https://www.atlascloud.ai/blog/seedance-2.0-pricing-full-cost-breakdown-2026 ; https://the-decoder.com/bytedances-seedance-2-5-generates-30-second-video-clips-with-built-in-audio/ | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S12 | Kling API docs index. | https://kling.ai/document-api/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S13 | Kling 4.0 image-to-video. | https://kling.ai/document-api/api/video/4-0/image-to-video.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S14 | Kling 4.0 omni video. | https://kling.ai/document-api/api/video/4-0/video-omni.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S15 | Kling callbacks. | https://kling.ai/document-api/api/get-started/callbacks.md | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S16 | Kling video pricing. | https://kling.ai/document-api/pricing/base/video.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S17 | Kling video capability map. | https://kling.ai/document-api/guides/capability-map/video.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S18 | Kling paid-service protocol. | https://kling.ai/document-api/guides/protocols/paid-service.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S19 | Kling concurrency rules. | https://kling.ai/document-api/api/get-started/concurrency-rules.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S20 | Kling Video 3 model user guide. | https://kling.ai/quickstart/klingai-video-3-model-user-guide | not cited | 2026-11-11 | note 05, section 9.1 | defined only; no use found |
| S20-ind | Kling 4.0 launch press release (search result). | https://bernama.com/en/press/news.php?id=2622471 | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S21 | Runway API pricing. | https://docs.dev.runwayml.com/guides/pricing/ | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S22 | Runway API reference. | https://docs.dev.runwayml.com/api/ | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S23 | Runway core API text. | https://docs.dev.runwayml.com/_llms-txt/core-api.txt | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S24 | Runway outputs. | https://docs.dev.runwayml.com/assets/outputs/ | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S25 | terms-monitoring summary of Runway Terms of Use (third party). | https://conductatlas.com/platform/runway/runway-terms-of-service/api-use-requires-prominent-powered-by-runway-display/ | [IND] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S26 | Luma Agents API model guide. | https://docs.agents.lumalabs.ai/guides/model | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S27 | Luma Agents API pricing. | https://docs.agents.lumalabs.ai/guides/pricing/ | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S27-ind | third-party Luma credit-value reports (search results). | https://wavespeed.ai/blog/cost-and-billing/luma-ai-pricing/ ; https://www.atlascloud.ai/blog/guides/luma-ray-3-api-guide | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S28 | Luma "llm-info" page (vendor marketing; contains text addressed to AI assistants, treated as data). | https://lumalabs.ai/llm-info | [CLAIM] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S29 | MiniMax pricing. | https://platform.minimax.io/docs/pricing/overview | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S30 | MiniMax video generation guide. | https://platform.minimax.io/docs/guides/video-generation | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S31 | Vidu pricing. | https://platform.vidu.com/docs/overview/pricing | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S32 | Vidu cancel task. | https://platform.vidu.com/docs/api-reference/task-management/cancel-task | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S32b | Vidu callback signature. | https://platform.vidu.com/docs/api-reference/other-documentation/callback-signature | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S33 | PixVerse Platform Terms of Service. | https://pixverse.ai/de/pixverse-platform-terms-of-service | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S34 | PixVerse platform docs V6 page (HTTP 404 on fetch; search-indexed summary only). | https://docs.platform.pixverse.ai/v6-2056814m0 | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S35 | Alibaba Cloud Model Studio, Wan 3.0 video. | https://help.aliyun.com/en/model-studio/wan3-0-video | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S35-ind | third-party reports on Wan 3.0 open-weight status (search results). | https://wavespeed.ai/blog/video-model-access/is-wan-3-0-open-source/ ; https://www.atlascloud.ai/blog/tips/wan-3.0-preview | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S36 | Alibaba Cloud Model Studio text-to-video API reference. | https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S37 | xAI Grok Imagine Video 1.5 model page. | https://docs.x.ai/developers/models/grok-imagine-video-1.5 | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S37-ind | third-party report of xAI per-resolution prices (search result). | https://dev.to/creeta/a-10-second-grok-imagine-15-clip-at-720p-runs-141-24ol | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S38 | xAI video generation guide. | https://docs.x.ai/developers/model-capabilities/video/generation | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S39 | LTX API pricing. | https://docs.ltx.io/pricing.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S40 | LTX docs index. | https://docs.ltx.io/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S41 | LTX async jobs. | https://docs.ltx.io/async-jobs.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S42 | LTX-2.5 model page. | https://docs.ltx.io/models/ltx-2-5.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S43 | LTX open-source system requirements. | https://docs.ltx.io/open-source-model/getting-started/system-requirements.md | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S44 | LTX open-source overview. | https://docs.ltx.io/open-source-model/getting-started/overview.md | [DOC] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S45-note | Midjourney: official docs returned HTTP 403; secondary sources only (search results). | https://wavespeed.ai/blog/posts/what-is-midjourney-v8-features-pricing-how-to-use-2026 ; https://dev.to/_37bbf0c253c0b3edec531e/midjourney-v1-video-price-and-compare-to-competitors-2l35 ; https://www.atlascloud.ai/models/midjourney | [IND] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 with 1 of 3 addresses | note 05, document 07 |
| S46 | ComfyUI Moonvalley partner-node page. | https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S46-ind | secondary reports on Moonvalley / Marey (search results; one exact URL not retained). | https://infer.reka.ai/leaderboards | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S47 | Artificial Analysis text-to-video leaderboard (search snippet). | https://artificialanalysis.ai/video/leaderboard/text-to-video | [IND] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S48 | third-party HappyHorse reports and listings (search results). | https://www.atlascloud.ai/blog/ai-updates/happyHorse-hits-1-api-coming-soon ; https://302.ai/product/detail/tongyi-happyhorse-1.0-i2v | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |
| S49 | Pika developer API. | https://dev.pika.art/ | [DOC] | 2026-11-11 | note 05, section 9.1; restated in document 07, section 10 | note 05, document 07 |
| S49-ind | earlier search results describing Pika models served through fal.ai (exact URLs not retained). | No address in the note. | [IND] | 2026-11-11 | note 05, section 9.1 | note 05 |

#### Note 05, section 9.2 Aggregators and marketplaces (Part B)

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| S50 | fal docs index. | https://fal.ai/docs/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S51 | fal queue submit reference. | https://fal.ai/docs/api-reference/inference-api/queue/submit.md | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S52 | fal terms. | https://fal.ai/terms | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S53 | fal model explorer (text-to-video). | https://fal.ai/explore/models?categories=text-to-video | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S54 | Replicate prediction lifecycle. | https://replicate.com/docs/topics/predictions/lifecycle | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S55 | Replicate data retention. | https://replicate.com/docs/topics/predictions/data-retention | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S56 | Replicate text-to-video collection. | https://replicate.com/collections/text-to-video | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S57 | Replicate terms. | https://replicate.com/terms | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S58 | OpenRouter docs index and video cookbook. | https://openrouter.ai/docs/llms.txt ; https://openrouter.ai/docs/cookbook/video-generation/text-to-video.md ; https://openrouter.ai/docs/cookbook/video-generation/choose-video-model.md ; https://openrouter.ai/docs/cookbook/video-generation/provider-specific-video-options.md | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 with 1 of 4 addresses | note 05, document 07 |
| S59 | OpenRouter BYOK. | https://openrouter.ai/docs/guides/overview/auth/byok | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S60 | Runware docs index. | https://runware.ai/docs/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S61 | Hugging Face Inference Providers, text-to-video task. | https://huggingface.co/docs/inference-providers/tasks/text-to-video | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S62 | Hugging Face Inference Providers pricing. | https://huggingface.co/docs/inference-providers/pricing | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S63 | ComfyUI partner nodes overview. | https://docs.comfy.org/tutorials/partner-nodes/overview | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S64 | ComfyUI partner nodes pricing. | https://docs.comfy.org/tutorials/partner-nodes/pricing | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S65 | Together AI videos overview. | https://docs.together.ai/docs/videos-overview | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S66 | DeepInfra text-to-video models. | https://deepinfra.com/models/text-to-video | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S67 | Amazon Bedrock model cards. | https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S68 | Amazon Bedrock Nova Reel model card. | https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S69 | Vercel AI Gateway video generation. | https://vercel.com/docs/ai-gateway/modalities/video-generation | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S70 | Vercel AI Gateway BYOK. | https://vercel.com/docs/ai-gateway/authentication-and-byok/byok | [DOC] | 2026-11-11 | note 05, section 9.2; restated in document 07, section 10 | note 05, document 07 |
| S71 | Azure AI Foundry video generation. | https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/video-generation | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S72 | WaveSpeedAI docs. | https://wavespeed.ai/docs ; https://wavespeed.ai/docs/rest-api ; https://wavespeed.ai/docs/data-retention-policy | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S73 | AIMLAPI video models. | https://docs.aimlapi.com/api-references/video-models | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S74 | Segmind docs. | https://docs.segmind.com/ | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |
| S75 | Vertex AI Model Garden overview. | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models | [DOC] | 2026-11-11 | note 05, section 9.2 | note 05 |

#### Note 05, section 9.3 Open-weight video models and runtimes (Part C)

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| S76 | Wan 2.2 repository. | https://github.com/Wan-Video/Wan2.2 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S77 | ComfyUI Wan 2.2 tutorial. | https://docs.comfy.org/tutorials/video/wan/wan2_2.md | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S78 | Wan-AI organisation on Hugging Face. | https://huggingface.co/Wan-AI | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S79 | ComfyUI Wan Animate 2 tutorial. | https://docs.comfy.org/tutorials/video/wan/wan-animate-2.md | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S80 | Wan2.2-Animate-2-14B model card. | https://huggingface.co/Wan-AI/Wan2.2-Animate-2-14B | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S81 | Wan 2.1 repository. | https://github.com/Wan-Video/Wan2.1 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S82 | community GGUF of Wan 2.2 TI2V-5B (third party). | https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF | [IND] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S83 | ComfyUI tutorials index. | https://docs.comfy.org/_llms/en/tutorials.txt | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S84 | ComfyUI system requirements. | https://docs.comfy.org/installation/system_requirements.md | [DOC], [ASSUMED] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S85 | MiniMax on Hugging Face and MiniMax-H3 model card. | https://huggingface.co/MiniMaxAI ; https://huggingface.co/MiniMaxAI/MiniMax-H3 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S86 | MiniMax H3 Community License Agreement. | https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S87 | ComfyUI MiniMax H3 native tutorial. | https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native.md | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S88 | LTX-2 repository. | https://github.com/Lightricks/LTX-2 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S89 | LTX-2.5 model card and Lightricks organisation. | https://huggingface.co/Lightricks/LTX-2.5 ; https://huggingface.co/Lightricks | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S90 | ComfyUI LTX-2.5 tutorial. | https://docs.comfy.org/tutorials/video/ltx/ltx-2-5.md | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S91 | HunyuanVideo 1.5 repository and model card. | https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 ; https://huggingface.co/tencent/HunyuanVideo-1.5 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S92 | Tencent Hunyuan Community License Agreement (HunyuanVideo 1.5). | https://huggingface.co/tencent/HunyuanVideo-1.5/blob/main/LICENSE | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S93 | ComfyUI HunyuanVideo 1.5 tutorial. | https://docs.comfy.org/tutorials/video/hunyuan/hunyuan-video-1-5.md | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S94 | WanGP / Wan2GP repository and model notes. | https://github.com/deepbeepmeep/Wan2GP ; https://github.com/deepbeepmeep/Wan2GP/blob/main/docs/MODELS.md | [DOC], [ASSUMED] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S95 | FramePack repository. | https://github.com/lllyasviel/FramePack | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S96 | stable-diffusion.cpp repository. | https://github.com/leejet/stable-diffusion.cpp | [DOC], [IND] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S97 | LightX2V repository. | https://github.com/ModelTC/LightX2V | [DOC], [CLAIM] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S98 | Self-Forcing repository. | https://github.com/guandeh17/Self-Forcing | [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S99 | Hugging Face trending text-to-video models. | https://huggingface.co/models?pipeline_tag=text-to-video&sort=trending | [IND], [DOC] | 2026-11-11 | note 05, section 9.3 | note 05 |
| S100 | CogVideo repository. | https://github.com/zai-org/CogVideo | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S101 | SkyReels-V3 repository and model card. | https://github.com/SkyworkAI/SkyReels-V3 ; https://huggingface.co/Skywork/SkyReels-V3-R2V-14B | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S102 | Mochi repository. | https://github.com/genmoai/mochi | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S103 | MAGI-1 repository. | https://github.com/SandAI-org/MAGI-1 | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S104 | LongCat-Video repository. | https://github.com/meituan-longcat/LongCat-Video | [DOC] | 2026-11-11 | note 05, section 9.3; restated in document 07, section 10 | note 05, document 07 |
| S105 | community fine-tune example (third party). | https://huggingface.co/SulphurAI/Sulphur-2-base | [IND] | 2026-11-11 | note 05, section 9.3 | note 05 |

#### Note 05, section 9.4 Image models (Part D)

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| S106 | Black Forest Labs docs index. | https://docs.bfl.ai/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.4 | note 05 |
| S107 | BFL pricing (docs). | https://docs.bfl.ml/quick_start/pricing.md | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S108 | BFL integration guidelines. | https://docs.bfl.ml/api_integration/integration_guidelines.md | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S109 | FLUX 3 Image Klein docs and model card. | https://docs.bfl.ml/flux_3/flux3_image_klein.md ; https://huggingface.co/black-forest-labs/flux-3-image-klein | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S110 | ComfyUI FLUX 3 Klein tutorial. | https://docs.comfy.org/tutorials/flux/flux-3-klein.md | [DOC] | 2026-11-11 | note 05, section 9.4 | note 05 |
| S111 | Black Forest Labs organisation on Hugging Face. | https://huggingface.co/black-forest-labs | not cited | 2026-11-11 | note 05, section 9.4 | defined only; no use found |
| S112 | FLUX.2 [dev] model card. | https://huggingface.co/black-forest-labs/FLUX.2-dev | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S113 | FLUX.2 [klein] 4B model card. | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B | [DOC], [ASSUMED] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S114 | FLUX.1 Kontext [dev] model card. | https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S115 | Qwen-Image repository. | https://github.com/QwenLM/Qwen-Image | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S116 | Qwen-Image-2.1 model card and licence. | https://huggingface.co/Qwen/Qwen-Image-2.1 ; https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S117 | ComfyUI Qwen-Image-2.1 tutorial. | https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1.md | [DOC] | 2026-11-11 | note 05, section 9.4 | note 05 |
| S118 | Z-Image repository and ComfyUI tutorial. | https://github.com/Tongyi-MAI/Z-Image ; https://docs.comfy.org/tutorials/image/z-image/z-image-turbo.md | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S119 | MiniMax-H3-Image model card and ComfyUI tutorial. | https://huggingface.co/MiniMaxAI/MiniMax-H3-Image ; https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image.md | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S120 | ComfyUI Ideogram 4.0 open-source model tutorial. | https://docs.comfy.org/tutorials/image/ideogram/ideogram-v4.md | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S121 | Ideogram developer docs index. | https://developer.ideogram.ai/v2/llms.txt | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S122 | Krea-2 ComfyUI tutorial and model card. | https://docs.comfy.org/tutorials/image/krea/krea-2.md ; https://huggingface.co/krea/Krea-2-Turbo | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S123 | OpenAI image generation guide (truncated on fetch). | https://developers.openai.com/api/docs/guides/image-generation | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S124 | OpenAI API pricing. | https://developers.openai.com/api/docs/pricing | [DOC] | 2026-11-11 | note 05, section 9.4 | note 05 |
| S125 | HunyuanImage 3.0 repository and model card. | https://github.com/Tencent-Hunyuan/HunyuanImage-3.0 ; https://huggingface.co/tencent/HunyuanImage-3.0 | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 with 1 of 2 addresses | note 05, document 07 |
| S126 | Stable Diffusion 3.5 Large model card. | https://huggingface.co/stabilityai/stable-diffusion-3.5-large | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S127 | Recraft API docs. | https://www.recraft.ai/docs | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |
| S128 | HiDream-I1 repository. | https://github.com/HiDream-ai/HiDream-I1 | [DOC] | 2026-11-11 | note 05, section 9.4; restated in document 07, section 10 | note 05, document 07 |

### 4.5 Speech, music, lip sync and restoration (V-keys of document 07)

Defined in document 07, section 10, under "Speech, voice, music, lip sync, restoration". Document 07 says the V-keys are assigned there to addresses from the audio and lip-sync note (note 06) and that the notes accessed them 2026-11-11. Document 07 gives no title for these keys. The column "what it is" gives the table rows of document 07 that cite the key, by their first cell, and the place in the research notes where the address is listed.

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| V-WHI | Cited in document 07 in the row: Speech to text. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/openai/whisper-large-v3-turbo | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-FW | Cited in document 07 in the rows: Speech to text; Tier 0. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SYSTRAN/faster-whisper | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-WX | Cited in document 07 in the row: Speech to text. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/m-bain/whisperX | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-KOK | Cited in document 07 in the row: Voice. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/hexgrad/Kokoro-82M | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-HAB | Cited in document 07 in the row: Voice. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SWivid/Habibi-TTS | [IND] | 2026-11-11 | document 07, section 10 | document 07 |
| V-CHB | Cited in document 07 in the row: Voice. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/resemble-ai/chatterbox | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-F5 | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SWivid/F5-TTS | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-XTTS | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/coqui/XTTS-v2 | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-HIG | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/boson-ai/higgs-audio | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-FISH | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/fishaudio/fish-speech/blob/main/LICENSE | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-IDX | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/index-tts/index-tts | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-PIP | Cited in document 07 in the row: Voice refused. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/OHF-Voice/piper1-gpl | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-ACE | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/ace-step/ACE-Step-1.5 | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-DR | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/ASLP-lab/DiffRhythm | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-MUS | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/facebookresearch/audiocraft | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-YUE | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/multimodal-art-projection/YuE | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-SUNO | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ | [IND] | 2026-11-11 | document 07, section 10 | document 07 |
| V-MMA | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/hkchengrex/MMAudio | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-ELSFX | Cited in document 07 in the row: Music and effects. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://elevenlabs.io/docs/overview/capabilities/sound-effects | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-MT | Cited in document 07 in the row: Lip sync. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/TMElyralab/MuseTalk | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-LS | Cited in document 07 in the rows: Lip sync; Tier 3. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/bytedance/LatentSync | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-W2L | Cited in document 07 in the row: Lip sync. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/Rudrabha/Wav2Lip | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-LP | Cited in document 07 in the row: Lip sync. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-INS | Cited in document 07 in the row: Lip sync. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/deepinsight/insightface | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-SYNC | Cited in document 07 in the row: Lip sync. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://sync.so/docs/models/lipsync | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-ESR | Cited in document 07 in the rows: Restoration (enhance); Tier 0. Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/xinntao/Real-ESRGAN | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-RIFE | Cited in document 07 in the row: Restoration (enhance). Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/hzwer/Practical-RIFE | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-SVR | Cited in document 07 in the row: Restoration (enhance). Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-ECHO | Cited in document 07 in the row: Tier 2. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/antgroup/echomimic_v3 | [DOC] | 2026-11-11 | document 07, section 10 | document 07 |
| V-LTX16 | Cited in document 07 in the row: LTX-2.5 (open). Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://medium.com/@creativeaininja/ltx-2-5-what-lightricks-open-weights-video-model-actually-does-and-how-to-run-it-a17bad9664fd | [IND] | 2026-11-11 | document 07, section 10 | document 07 |

### 4.6 Model licences and reuse (U-keys of document 04)

Defined in document 04, section 8, which says the addresses were copied from the research notes (accessed 2026-11-11) and that the label at the place of use governs. Document 04 gives no title for these keys. The column "what it is" gives the table row of document 04 that cites the key and the place in the research notes where each address is listed.

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| U1 | Cited in document 04 in 2 rows: (1) Wan 2.2 TI2V-5B; Wan 2.1 T2V-1.3B (2) Wan 14B family (A14B, S2V, Animate-2, VACE 14B), MAGREF, InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking. Address listed in: note 05 key S76 (Wan 2.2 repository). | https://github.com/Wan-Video/Wan2.2 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U2 | Cited in document 04 in 2 rows: (1) Wan 2.2 TI2V-5B; Wan 2.1 T2V-1.3B (2) Wan 14B family (A14B, S2V, Animate-2, VACE 14B), MAGREF, InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking. Address listed in: note 05 key S81 (Wan 2.1 repository). | https://github.com/Wan-Video/Wan2.1 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U3 | Cited in document 04 in the row: Wan 2.2 TI2V-5B; Wan 2.1 T2V-1.3B. Address listed in: note 05 key S77 (ComfyUI Wan 2.2 tutorial). | https://docs.comfy.org/tutorials/video/wan/wan2_2.md | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U4 | Cited in document 04 in the row: VACE 1.3B, Phantom 1.3B. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/ali-vilab/VACE | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U5 | Cited in document 04 in the row: VACE 1.3B, Phantom 1.3B. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/Phantom-video/Phantom | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U6 | Cited in document 04 in the row: Wan 14B family (A14B, S2V, Animate-2, VACE 14B), MAGREF, InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/MAGREF-Video/MAGREF | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U7 | Cited in document 04 in the row: Wan 14B family (A14B, S2V, Animate-2, VACE 14B), MAGREF, InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/MeiGen-AI/InfiniteTalk ; https://github.com/MeiGen-AI/MultiTalk ; https://github.com/Omni-Avatar/OmniAvatar ; https://github.com/Fantasy-AMAP/fantasy-talking ; https://huggingface.co/Wan-AI/Wan2.2-S2V-14B | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U8 | Cited in document 04 in 2 rows: (1) CogVideoX-2B (2) CogVideoX-5B, 1.5-5B. Address listed in: note 05 key S100 (CogVideo repository). | https://github.com/zai-org/CogVideo | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U9 | Cited in document 04 in the row: Mochi 1, MAGI-1 4.5B, LongCat-Video, Self-Forcing. Address listed in: note 05 key S102 (Mochi repository); note 05 key S103 (MAGI-1 repository); note 05 key S104 (LongCat-Video repository); note 05 key S98 (Self-Forcing repository). | https://github.com/genmoai/mochi ; https://github.com/SandAI-org/MAGI-1 ; https://github.com/meituan-longcat/LongCat-Video ; https://github.com/guandeh17/Self-Forcing | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U10 | Cited in document 04 in the row: FramePack. Address listed in: note 05 key S95 (FramePack repository); note 06 source list, 11.4 Part D — consistency methods. | https://github.com/lllyasviel/FramePack | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U11 | Cited in document 04 in the row: LTX-2.5, LTX-2.3. Address listed in: note 05 key S89 (LTX-2.5 model card and Lightricks organisation); note 06 source list, 11.1 Part A — voice and audio; note 05 key S43 (LTX open-source system requirements). | https://huggingface.co/Lightricks/LTX-2.5 ; https://docs.ltx.io/open-source-model/getting-started/system-requirements.md | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U12 | Cited in document 04 in the row: MiniMax H3 (open). Address listed in: note 05 key S86 (MiniMax H3 Community License Agreement). | https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U13 | Cited in document 04 in the row: HunyuanVideo 1.5, -Avatar, -Foley, HunyuanCustom, HunyuanImage 3.0. Address listed in: note 05 key S92 (Tencent Hunyuan Community License Agreement (HunyuanVideo 1.5)); note 06 source list, 11.2 Part B — lip sync and talking characters; note 06 source list, 11.1 Part A — voice and audio; note 06 source list, 11.4 Part D — consistency methods; note 05 key S125 (HunyuanImage 3.0 repository and model card). | https://huggingface.co/tencent/HunyuanVideo-1.5/blob/main/LICENSE ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar/blob/main/LICENSE ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley ; https://github.com/Tencent-Hunyuan/HunyuanCustom ; https://github.com/Tencent-Hunyuan/HunyuanImage-3.0 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U14 | Cited in document 04 in the row: SkyReels-V3/A2; Lynx weights. Address listed in: note 05 key S101 (SkyReels-V3 repository and model card); note 06 source list, 11.4 Part D — consistency methods. | https://github.com/SkyworkAI/SkyReels-V3 ; https://github.com/SkyworkAI/SkyReels-A2 ; https://github.com/bytedance/lynx | none beside the key; the row carries [UNKNOWN] | 2026-11-11 | document 04, section 8 | document 04 |
| U15 | Cited in document 04 in the row: HoloCine. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/yihao-meng/HoloCine | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U16 | Cited in document 04 in the row: Stand-In. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/WeChatCV/Stand-In | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U17 | Cited in document 04 in the row: Z-Image / Z-Image-Turbo. Address listed in: note 05 key S118 (Z-Image repository and ComfyUI tutorial); note 05 key S96 (stable-diffusion.cpp repository). | https://github.com/Tongyi-MAI/Z-Image ; https://github.com/leejet/stable-diffusion.cpp | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U18 | Cited in document 04 in the row: FLUX.2 [klein] 4B. Address listed in: note 05 key S113 (FLUX.2 [klein] 4B model card). | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U19 | Cited in document 04 in the row: Qwen-Image 2025 line (Edit, -2509, -2511, Layered, 2512). Address listed in: note 05 key S115 (Qwen-Image repository); note 06 source list, 11.4 Part D — consistency methods. | https://github.com/QwenLM/Qwen-Image ; https://huggingface.co/Qwen/Qwen-Image-Edit-2511 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U20 | Cited in document 04 in the row: OmniGen2; IP-Adapter (not FaceID). Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/VectorSpaceLab/OmniGen2 ; https://github.com/tencent-ailab/IP-Adapter | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U21 | Cited in document 04 in the row: FLUX.1 Kontext [dev], FLUX.2 [dev], FLUX.2 [klein] 9B; PuLID-FLUX, USO, DreamO, InfiniteYou. Address listed in: note 05 key S114 (FLUX.1 Kontext [dev] model card); note 06 source list, 11.4 Part D — consistency methods; note 05 key S112 (FLUX.2 [dev] model card). | https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev ; https://huggingface.co/black-forest-labs/FLUX.2-dev ; https://github.com/ToTheBeginning/PuLID ; https://github.com/bytedance/USO ; https://github.com/bytedance/DreamO ; https://github.com/bytedance/InfiniteYou | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U22 | Cited in document 04 in the row: Qwen-Image-2.1. Address listed in: note 05 key S116 (Qwen-Image-2.1 model card and licence). | https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U23 | Cited in document 04 in the row: FLUX 3 Image Klein. Address listed in: note 05 key S109 (FLUX 3 Image Klein docs and model card). | https://docs.bfl.ml/flux_3/flux3_image_klein.md ; https://huggingface.co/black-forest-labs/flux-3-image-klein | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U24 | Cited in document 04 in the row: SD 3.5 Large; Stable Audio Open 1.0. Address listed in: note 05 key S126 (Stable Diffusion 3.5 Large model card); note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/stabilityai/stable-diffusion-3.5-large ; https://huggingface.co/stabilityai/stable-audio-open-1.0 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U25 | Cited in document 04 in the row: HiDream-I1/E1. Address listed in: note 05 key S128 (HiDream-I1 repository). | https://github.com/HiDream-ai/HiDream-I1 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U26 | Cited in document 04 in the row: Krea-2; Ideogram 4.0 open; MiniMax-H3-Image. Address listed in: note 05 key S122 (Krea-2 ComfyUI tutorial and model card); note 05 key S120 (ComfyUI Ideogram 4.0 open-source model tutorial); note 05 key S119 (MiniMax-H3-Image model card and ComfyUI tutorial). | https://huggingface.co/krea/Krea-2-Turbo ; https://docs.comfy.org/tutorials/image/ideogram/ideogram-v4.md ; https://huggingface.co/MiniMaxAI/MiniMax-H3-Image | none beside the key; the row carries [UNKNOWN], [ASSUMED] | 2026-11-11 | document 04, section 8 | document 04 |
| U27 | Cited in document 04 in the row: InstantID. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/instantX-research/InstantID | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U28 | Cited in document 04 in the row: Whisper large-v3-turbo and smaller. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/openai/whisper-large-v3-turbo | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U29 | Cited in document 04 in the row: faster-whisper; WhisperX. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SYSTRAN/faster-whisper ; https://github.com/m-bain/whisperX | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U30 | Cited in document 04 in the row: Qwen3-ASR / ForcedAligner. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://arxiv.org/abs/2601.21337 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U31 | Cited in document 04 in the row: Parakeet TDT 0.6B v3. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U32 | Cited in document 04 in the row: Kokoro-82M. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/hexgrad/Kokoro-82M ; https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U33 | Cited in document 04 in the row: Chatterbox (Turbo, Nano, Multilingual V3). Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/resemble-ai/chatterbox | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U34 | Cited in document 04 in the row: Dia 1.6B; CosyVoice 3. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/nari-labs/dia ; https://github.com/FunAudioLLM/CosyVoice | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U35 | Cited in document 04 in the row: Orpheus. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/canopyai/Orpheus-TTS | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U36 | Cited in document 04 in the row: Qwen3-TTS, NeuTTS Air, KittenTTS, VoxCPM2, OmniVoice, Pocket TTS, Supertonic. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource ; https://github.com/neuphonic/neuTTS ; https://localclaw.io/tts/kitten-tts ; https://pypi.org/project/voxcpm ; https://arxiv.org/html/2604.00688v2 ; https://pypi.org/project/pocket-tts/1.0.0/ ; https://huggingface.co/Supertone/supertonic-2 | [IND] | 2026-11-11 | document 04, section 8 | document 04 |
| U37 | Cited in document 04 in the row: Habibi-TTS. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SWivid/Habibi-TTS | [IND] | 2026-11-11 | document 04, section 8 | document 04 |
| U38 | Cited in document 04 in the row: F5-TTS, XTTS-v2, Higgs Audio v3, VibeVoice. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/SWivid/F5-TTS ; https://huggingface.co/coqui/XTTS-v2 ; https://github.com/boson-ai/higgs-audio ; https://github.com/microsoft/VibeVoice | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U39 | Cited in document 04 in the row: Fish Speech / OpenAudio S2; IndexTTS-2/2.5. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/fishaudio/fish-speech/blob/main/LICENSE ; https://github.com/index-tts/index-tts | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U40 | Cited in document 04 in the row: Piper (piper1-gpl). Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/OHF-Voice/piper1-gpl | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U41 | Cited in document 04 in the row: ACE-Step 1.5. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/ace-step/ACE-Step-1.5 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U42 | Cited in document 04 in the row: DiffRhythm. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/ASLP-lab/DiffRhythm | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U43 | Cited in document 04 in the row: MusicGen, YuE, MMAudio, ThinkSound. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://github.com/facebookresearch/audiocraft ; https://github.com/multimodal-art-projection/YuE ; https://github.com/hkchengrex/MMAudio ; https://github.com/FunAudioLLM/ThinkSound | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U44 | Cited in document 04 in the row: Demucs weights; Sony Woosh; PrismAudio. Address listed in: note 06 source list, 11.1 Part A — voice and audio. | https://huggingface.co/adefossez/HTDemucs/discussions/1 ; https://www.mixonline.com/post-and-broadcast/sony-ai-announces-sfx-generation-model-woosh | [IND] | 2026-11-11 | document 04, section 8 | document 04 |
| U45 | Cited in document 04 in the row: MuseTalk 1.5. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/TMElyralab/MuseTalk | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U46 | Cited in document 04 in the row: EchoMimicV3; SadTalker. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/antgroup/echomimic_v3 ; https://github.com/OpenTalker/SadTalker | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U47 | Cited in document 04 in the row: LatentSync 1.5/1.6; LivePortrait as shipped. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/bytedance/LatentSync ; https://huggingface.co/ByteDance/LatentSync-1.6 ; https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U48 | Cited in document 04 in the row: Wav2Lip; Hallo2; Hallo3. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/Rudrabha/Wav2Lip ; https://github.com/fudan-generative-vision/hallo2 ; https://github.com/fudan-generative-vision/hallo3 | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U49 | Cited in document 04 in the row: InsightFace packs (buffalo_l, antelopev2, inswapper); metrics on them; LRS2-trained SyncNet. Address listed in: note 06 source list, 11.2 Part B — lip sync and talking characters. | https://github.com/deepinsight/insightface | [ASSUMED] | 2026-11-11 | document 04, section 8 | document 04 |
| U50 | Cited in document 04 in the row: Real-ESRGAN (ncnn-Vulkan). Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/xinntao/Real-ESRGAN | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U51 | Cited in document 04 in the row: RIFE 4.25; SeedVR2 (+ community GGUF runtime); FlashVSR. Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/hzwer/Practical-RIFE ; https://github.com/ByteDance-Seed/SeedVR ; https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler ; https://github.com/OpenImagingLab/FlashVSR | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U52 | Cited in document 04 in the row: SUPIR; GIMM-VFI; STAR (CogVideoX variant); FILM. Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://github.com/Fanghua-Yu/SUPIR ; https://github.com/GSeanCDAT/GIMM-VFI/blob/main/LICENSE ; https://github.com/NJU-PCALab/STAR ; https://github.com/google-research/frame-interpolation | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U53 | Cited in document 04 in the row: IC-Light. Address listed in: note 06 source list, 11.4 Part D — consistency methods. | https://github.com/lllyasviel/IC-Light | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U54 | Cited in document 04 in the row: Topaz Video. Address listed in: note 06 source list, 11.3 Part C — upscaling, interpolation and restoration. | https://www.topazlabs.com/pricing ; https://docs.topazlabs.com/topaz-video/system-requirements | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U55 | Cited in document 04 in the row: stable-diffusion.cpp; LightX2V. Address listed in: note 05 key S96 (stable-diffusion.cpp repository); note 05 key S97 (LightX2V repository). | https://github.com/leejet/stable-diffusion.cpp ; https://github.com/ModelTC/LightX2V | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U56 | Cited in document 04 in 2 rows: (1) ComfyUI (the person's install), WanGP, diffusers (2) ComfyUI partner nodes; Vercel AI Gateway BYOK. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages); note 05 key S63 (ComfyUI partner nodes overview); note 05 key S94 (WanGP / Wan2GP repository and model notes). | https://docs.comfy.org/tutorials/partner-nodes/overview ; https://github.com/deepbeepmeep/Wan2GP | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U57 | Cited in document 04 in the row: Sora 2 API; Moonvalley Marey API; Amazon Nova Reel. Address listed in: note 04 source list, under Fetched primary sources (official docs, repositories, vendor pages); note 05 key S1 (OpenAI API deprecations); note 05 key S46 (ComfyUI Moonvalley partner-node page); note 05 key S68 (Amazon Bedrock Nova Reel model card). | https://developers.openai.com/api/docs/deprecations ; https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation ; https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U58 | Cited in document 04 in the row: PixVerse API; Midjourney; Suno, Udio. Address listed in: note 05 key S33 (PixVerse Platform Terms of Service); note 05 key S45-note (Midjourney: official docs returned HTTP 403; secondary sources only (search results)); note 06 source list, 11.1 Part A — voice and audio. | https://pixverse.ai/de/pixverse-platform-terms-of-service ; https://www.atlascloud.ai/models/midjourney ; https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ ; https://dynamoi.com/learn/ai-music-distribution/is-udio-music-still-downloadable | [IND] | 2026-11-11 | document 04, section 8 | document 04 |
| U59 | Cited in document 04 in the row: ComfyUI partner nodes; Vercel AI Gateway BYOK. Address listed in: note 05 key S70 (Vercel AI Gateway BYOK). | https://vercel.com/docs/ai-gateway/authentication-and-byok/byok | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |
| U60 | Cited in document 04 in the row: fal, Replicate, Kling, Runway, Google, OpenAI images, BFL, Luma, MiniMax, Vidu, Alibaba, xAI, LTX API, ElevenLabs, Sync Labs, Hedra. Address listed in: note 05 key S52 (fal terms); note 05 key S57 (Replicate terms); note 02 key K-APITOS; note 05 key S18 (Kling paid-service protocol); note 05 key S25 (terms-monitoring summary of Runway Terms of Use (third party)); note 05 key S5 (Google Gemini Omni guide); note 05 key S123 (OpenAI image generation guide (truncated on fetch)); note 06 source list, 11.2 Part B — lip sync and talking characters; note 06 source list, 11.1 Part A — voice and audio. | https://fal.ai/terms ; https://replicate.com/terms ; https://kling.ai/document-api/guides/protocols/paid-service.md ; https://conductatlas.com/platform/runway/runway-terms-of-service/api-use-requires-prominent-powered-by-runway-display/ ; https://aistudio.google.com/docs/omni ; https://developers.openai.com/api/docs/guides/image-generation ; https://sync.so/docs/models/lipsync ; https://elevenlabs.io/docs/overview/capabilities/sound-effects | [DOC] | 2026-11-11 | document 04, section 8 | document 04 |

### 4.7 Papers (C-keys of note 06)

Defined in note 06, section 11.6. The note says these papers were reached at abstract level through the Consensus index and that the full texts were not read. The address is the record in that index. The details in brackets after each title are those the note gives. Note 06 cites every C-key beside [DOC], which for a paper covers only what the abstract states.

| key | what it is | URL | label | retrieved | defined in | used in |
|---|---|---|---|---|---|---|
| C-1 | Paper: Rethinking Human Evaluation Protocol for Text-to-Video Models: Enhancing Reliability, Reproducibility, and Practicality (Tianle Zhang et al., 2024, ArXiv, 9 citations). | https://consensus.app/papers/details/652319a5aa7d502994036ac89c6021e2/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-2 | Paper: EvalCrafter: Benchmarking and Evaluating Large Video Generation Models (Yao-Fang Liu et al., 2023, 2024 IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 432 citations). | https://consensus.app/papers/details/5e8686725b6c5518a89bef0978df1266/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-3 | Paper: SLVMEval: Synthetic Meta Evaluation Benchmark for Text-to-Long Video Generation (Ryosuke Matsuda et al., 2026, ArXiv, 2 citations). | https://consensus.app/papers/details/c3002c073891595ab78569ac9300e4fa/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-4 | Paper: Evaluation of Text-to-Video Generation Models: A Dynamics Perspective (Ming-Xiang Liao et al., 2024, ArXiv, 91 citations). | https://consensus.app/papers/details/23e9be97466e5aec98d308187999d367/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-5 | Paper: T2VTextBench: A Human Evaluation Benchmark for Textual Control in Video Generation Models (Xu-Yang Guo et al., 2025, ArXiv, 13 citations). | https://consensus.app/papers/details/bb7dc03329e55777b250b9a8ee20d25f/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-6 | Paper: VBench++: Comprehensive and Versatile Benchmark Suite for Video Generative Models (Zi-Qi Huang et al., 2025, IEEE Transactions on Pattern Analysis and Machine Intelligence, 303 citations). | https://consensus.app/papers/details/b949f78043f957958a9d1c6df3901762/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-7 | Paper: Multi-Dimensional Quality Assessment for AI-Generated Human-Centric Videos: Dataset and Model (Si-Jing Wu et al., 2026, IEEE Transactions on Circuits and Systems for Video Technology, 6 citations). | https://consensus.app/papers/details/712972761af755a99142cfca632cb4ee/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-8 | Paper: Can You Count to Nine? A Human Evaluation Benchmark for Counting Limits in Modern Text-to-Video Models (Xu-Yang Guo et al., 2025, ArXiv, 15 citations). | https://consensus.app/papers/details/9df221136792566da28569f600c71965/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-9 | Paper: FETV: A Benchmark for Fine-Grained Evaluation of Open-Domain Text-to-Video Generation (Yuanxin Liu et al., 2023, ArXiv, 154 citations). | https://consensus.app/papers/details/85e27627420f509abf0da9dd4d0554bf/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-10 | Paper: CVBench: Benchmarking and Comparing Video Generation with Large Multimodal Models (Jia-Rui Wang et al., 2025, 2025 International Conference on Visual Communications and Image Processing (VCIP), 0 citations). | https://consensus.app/papers/details/f8a1fefe454153368a6bfc32d4c90e82/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-11 | Paper: Strategy for Boosting Pair Comparison and Improving Quality Assessment Accuracy (Suiyi Ling et al., 2020, ArXiv, 11 citations). | https://consensus.app/papers/details/6d5b92f8892e5291b71993e70e2e64f5/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-12 | Paper: Benchmarking Subjective Quality Assessment Methodologies for Light Field Compression (Mahmoudpour et al., 2026, IEEE Transactions on Broadcasting, 3 citations). | https://consensus.app/papers/details/eedefff3c6a0547d80ab29dad1439710/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-13 | Paper: Adaptive Paired-Comparison Method for Subjective Video Quality Assessment on Mobile Devices (Storrs et al., 2018, Picture Coding Symposium (PCS), 3 citations). | https://consensus.app/papers/details/e3dbc6d8888f5aea83560cc6ee1ea8d6/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-14 | Paper: On Designing Paired Comparison Experiments for Subjective Multimedia Quality Assessment (Jong-Seok Lee, 2014, IEEE Transactions on Multimedia, 30 citations). | https://consensus.app/papers/details/b3d45f6f955f513490c9e631a186bc64/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-15 | Paper: Efficient, robust and divisible paired comparison for subjective quality assessment (Rui Song et al., 2017, Multimedia Tools and Applications, 1 citation). | https://consensus.app/papers/details/b6f441dd18e353119aed42a3114f98ff/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-16 | Paper: Active Sampling for Subjective Video Quality Assessment (Jiang et al., 2018, BigMM, 3 citations). | https://consensus.app/papers/details/7235258526f55764b3217319ec7aac90/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-17 | Paper: "Discriminability–Experimental Cost" Tradeoff in Subjective Video Quality Assessment of Codec: DCR with EVP Rating Scale Versus ACR–HR (Pastor et al., 2024, Picture Coding Symposium (PCS), 7 citations). | https://consensus.app/papers/details/7ff52a66073d5dde9a6223c4b495aa3e/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-18 | Paper: Random partial paired comparison for subjective video quality assessment via hodgerank (Qian-Qian Xu et al., 2011, Proceedings of the 19th ACM international conference on Multimedia, 46 citations). | https://consensus.app/papers/details/e39980eff0d05063ad181bff2e91ed00/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-19 | Paper: Crowd workers proven useful : a comparative study of subjective video quality assessment (D. Saupe et al., 2016, venue not given by the index, 40 citations). | https://consensus.app/papers/details/c7c5ba0a59b856e7ba454f5d4c0e99ef/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |
| C-20 | Paper: Comparison of Four Subjective Methods for Image Quality Assessment (Rafał K. Mantiuk et al., 2012, Computer Graphics Forum, 323 citations). | https://consensus.app/papers/details/0dc3c83c078a5df4a95fb90f971f2579/?utm_source=claude_desktop | [DOC] | 2026-11-11 | note 06, section 11.6 | note 06 |

## 5. Sources without keys

### 5.1 Research notes that list addresses without keys

Notes 03, 04 and 06 give the address in the sentence or table cell that uses it, and list all addresses again in a closing section. Those lists are not repeated here. Read them in the note.

| note | closing section | distinct addresses in it | what the note says about access |
|---|---|---|---|
| note 03 | 11. Sources (all accessed 2026-11-11) | 120 | All accessed 2026-11-11. One entry is marked (snippet only): it was seen only as a search summary. Lines that start "Not fetchable" or "Not readable" name pages that could not be read. |
| note 04 | 9. Sources | 190 | Access date for all sources 2026-11-11. The section separates fetched primary sources, fetched independent sources, fetch failures, and sources seen at search-result level. |
| note 06 | 11. Source list (all accessed 2026-11-11) | 341, of which 20 carry C-keys | All accessed 2026-11-11. The note says every address cited in its sections 0 to 10 is listed once, under the part where it is used. |

Note 02, section 9, also holds 5 lines with addresses and no key:

| line in note 02 | addresses |
|---|---|
| Docs index used | https://kling.ai/document-api/llms.txt |
| Not fetched | https://kling.ai/pricing ; https://kling.ai/membership/membership-plan |
| Press on the Luma Agents launch | https://techcrunch.com/2026/03/05/exclusive-luma-launches-creative-ai-agents-powered-by-its-new-unified-intelligence-models/ |
| Returned 404 | https://lumalabs.ai/legal/api-tos ; https://lumalabs.ai/learning-hub/pricing |
| Fetched but without the needed data | https://dev.pika.art/pricing |

Note 02 ends with a line of items seen only through search listings, which it says to treat as weak [IND]. Those items have no keys.

### 5.2 Topic lines without a key in document 04

Document 04, section 8, lists these addresses under a topic and not under a U-key.

| topic line | addresses | where the research notes list them |
|---|---|---|
| FFmpeg licensing | https://www.ffmpeg.org/legal.html ; https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md | note 03 source list, under Open-source components |
| Blender and GPL | https://docs.blender.org/manual/en/latest/getting_started/about/license.html ; https://www.gnu.org/licenses/gpl-faq.en.html ; https://pypi.org/project/bpy/ ; https://developer.blender.org/docs/release_notes/5.2/ ; https://docs.blender.org/manual/en/latest/render/layers/passes.html | note 03 source list, under Blender; text of note 03 (its source list does not give this full address) |
| OpenTimelineIO and OTIO loss | https://github.com/AcademySoftwareFoundation/OpenTimelineIO ; https://www.remotion.dev/docs/export-opentimeline | note 03 source list, under Open-source components; note 04 source list, under Search-result or earlier-session sources (snippet level unless stated in the text), line Video as code |
| Remotion, Diffusion Studio | https://www.remotion.dev/docs/license/pricing ; https://github.com/diffusionstudio/core | note 03 source list, under Open-source components |
| Aggregator catalogues | https://openrouter.ai/docs/llms.txt ; https://runware.ai/docs/llms.txt | note 05 key S58 (OpenRouter docs index and video cookbook); note 05 key S60 (Runware docs index) |
| Community fine-tune example | https://huggingface.co/SulphurAI/Sulphur-2-base | note 05 key S105 (community fine-tune example (third party)) |
| Voice-likeness consent overview | https://vorplabs.com/ai-regulatory-updates/deepfake-laws/voice-likeness-consent | note 06 source list, 11.1 Part A — voice and audio |

### 5.3 Addresses written inline in the numbered documents

Documents 10 and 12 write some addresses directly in the text, without a key. Each one is also listed in a research note.

| address | document | where the research notes list it |
|---|---|---|
| https://artificialanalysis.ai/methodology/video | document 10 | note 06 source list, 11.5 Part E — evaluation (web pages and SciSpace-indexed papers) |
| https://github.com/Vchitect/VBench | document 10 | note 06 source list, 11.5 Part E — evaluation (web pages and SciSpace-indexed papers) |
| https://github.com/deepinsight/insightface | document 10 | note 06 source list, 11.2 Part B — lip sync and talking characters |
| https://higgsfield.ai/terms | document 10 | note 01 key S1 (Terms of Use (last updated 23 Oct 2026)) |
| https://higgsfield.ai/pricing | document 10 | note 01 key S18 (Pricing page (script shell only) and Team page (404)) |
| https://lumalabs.ai/legal/tos | document 10 | note 02 key L-TOS |
| https://github.com/leejet/stable-diffusion.cpp | document 12 | note 05 key S96 (stable-diffusion.cpp repository) |
| https://github.com/SYSTRAN/faster-whisper | document 12 | note 06 source list, 11.1 Part A — voice and audio |
| https://huggingface.co/hexgrad/Kokoro-82M | document 12 | note 06 source list, 11.1 Part A — voice and audio |
| https://docs.comfy.org/tutorials/video/wan/wan2_2.md | document 12 | note 05 key S77 (ComfyUI Wan 2.2 tutorial) |
| https://github.com/Wan-Video/Wan2.1 | document 12 | note 05 key S81 (Wan 2.1 repository) |
| https://github.com/lllyasviel/FramePack | document 12 | note 05 key S95 (FramePack repository); note 06 source list, 11.4 Part D — consistency methods |
| https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 | document 12 | note 05 key S91 (HunyuanVideo 1.5 repository and model card) |
| https://github.com/Wan-Video/Wan2.2 | document 12 | note 05 key S76 (Wan 2.2 repository) |
| https://docs.ltx.io/open-source-model/getting-started/system-requirements.md | document 12 | note 05 key S43 (LTX open-source system requirements) |
| https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation | document 12 | note 01 key S19 (Blog: Credits vs Unlimited (15 Sep 2026)) |
| https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work.md | document 12 | note 01 key S17 (Help: How credits work) |
| https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs | document 12 | note 01 key S37 (Krea: Higgsfield pricing explained (data captured 31 Aug 2026)) |

The cards contain one address, https://example.com/x. It is an example value in a negative test of card MPR-304, where the request must be refused. It is not a source.

## 6. Keys that mean different things in different documents

Nothing was renamed. Resolve a key by the document it appears in.

### 6.1 S and a number

Notes 01 and 05 each number their sources S1, S2 and so on, independently.

| where the key appears | numbering that applies | table |
|---|---|---|
| note 01; document 10 | note 01 | 4.1 |
| documents 00 and 01, written HF-S7 | note 01 | 4.1 |
| note 05; document 07 | note 05 | 4.4 |

41 key strings exist in both numberings. All 41 stand for different sources. Examples:

| key | in note 01 and document 10 | in note 05 and document 07 |
|---|---|---|
| S1 | Terms of Use (last updated 23 Oct 2026) | OpenAI API deprecations |
| S7 | Cinema Studio 4.0 landing page | Vertex AI Veo 3.1 model page |
| S14 | Changelog and RSS feed | Kling 4.0 omni video |

Document 10 uses the note 01 numbering and says so: it cites report 01, whose table gives the address of each S-number. Document 07 says its S-keys follow the video and image note, which is note 05.

### 6.2 The letter R

R followed by a number or a word has seven meanings in the package. Only the first is a source key and only the second names a research note. Document 02 notes that R is overloaded and names four of these meanings.

| form | meaning | where it appears |
|---|---|---|
| R- and a word, for example R-TOS | Source key in the Runway group of note 02. Table 4.2. | note 02; documents 00 and 01 |
| R03, R05, R06, R07, R10 | The research note with that number. A section of that note may follow, as in R05 E.6. | document 04 only |
| R-01 to R-05 | Research prerequisites of the earlier System Supremacy plan. They are rows with those ids in the legacy addendum, not sources. | the legacy addendum; cards MPR-210, MPR-222, MPR-601, MPR-602, MPR-603, MPR-604, MPR-605, MPR-606; documents 02, 03 and 09; notes 09 and 10 |
| R01 to R18 | Risks in the register of draft pull request #86. | document 02; note 10 |
| R1 to R8 | Residual items of the frozen reuse-first plan. | documents 02, 03 and 11; notes 09 and 10 |
| R0, R1 | Roadmap steps of draft pull request #85. | document 02; note 10 |
| R1, R2 | The two revision requests of the benchmark described in document 10. | document 10; cards MPR-801, MPR-802, MPR-803; document 09 |

### 6.3 Look-alikes that are not collisions

- C-1 to C-20 are papers in note 06. CC-1 to CC-8 are CapCut pages in document 01.
- "S2" in note 06 and document 04 is part of a product name (a speech model), not a source key.
- C.5, C.7, D.3 and similar are section numbers of note 05, not C-keys.
- Document 02 lists other codes from earlier plans, such as AUD-01, AG-DOCS, REA-01, X-01, E-SEC. None is a source key.

### 6.4 One address under more than one key

81 addresses carry more than one key. This is not a collision: each key still has one meaning. There are two causes. More than one note lists the same page. Documents 01, 04 and 07 assigned their own keys to addresses taken from the notes.

| files whose keys share the address | addresses |
|---|---|
| note 05 and document 04 | 40 |
| document 04 and document 07 | 29 |
| note 02 and note 05 | 7 |
| note 05, document 01 and document 04 | 3 |
| note 02, note 05 and document 04 | 1 |
| note 05 and document 01 | 1 |

One address has two keys in the same file: https://github.com/leejet/stable-diffusion.cpp is U17 and U55 in document 04.

For a key defined in document 01, 04 or 07, the column "what it is" in section 4 names the note key that has the same address, where there is one. Examples:

| address | keys |
|---|---|
| https://developers.openai.com/api/docs/deprecations | S1 (note 05); OA-1 (document 01); U57 (document 04) |
| https://kling.ai/document-api/guides/protocols/paid-service.md | K-APITOS (note 02); S18 (note 05); U60 (document 04) |
| https://huggingface.co/openai/whisper-large-v3-turbo | V-WHI (document 07); U28 (document 04) |

## 7. Keys used without a definition found

One key is used without a definition.

| key | where it is used | what was found |
|---|---|---|
| S34 | note 01 (1 use) | Note 01 defines S34a, S34b, S34c and S34d and no plain S34. The use is in the opening summary of the note, in a list of keys labelled [IND]. It probably means the group S34a to S34d. That reading is an inference. The note does not state it. |

Every key cited in documents 00, 01, 04, 07 and 10 is defined, either in the source table of that document or in the note it names.

## 8. Differences between restated tables and the notes

Documents 01 and 07 restate keys from notes 01, 02 and 05. No restated address differs from the note. No address in a document key table is absent from the research notes. For the keys below the document gives fewer addresses than the note. The tables in section 4 give the full set from the note.

| key | document | addresses given | addresses in the note |
|---|---|---|---|
| HF-S14 | document 01 | 1 | 2 (note 01) |
| HF-S22 | document 01 | 1 | 3 (note 01) |
| HF-S29 | document 01 | 1 | 2 (note 01) |
| K-BLOG40 | document 01 | 1 | 2 (note 02) |
| L-HELP-SNIP | document 01 | 1 | 2 (note 02) |
| S8-ind | document 07 | 1 | 2 (note 05) |
| S45-note | document 07 | 1 | 3 (note 05) |
| S58 | document 07 | 1 | 4 (note 05) |
| S85 | document 07 | 1 | 2 (note 05) |
| S89 | document 07 | 1 | 2 (note 05) |
| S91 | document 07 | 1 | 2 (note 05) |
| S94 | document 07 | 1 | 2 (note 05) |
| S101 | document 07 | 1 | 2 (note 05) |
| S109 | document 07 | 1 | 2 (note 05) |
| S116 | document 07 | 1 | 2 (note 05) |
| S118 | document 07 | 1 | 2 (note 05) |
| S119 | document 07 | 1 | 2 (note 05) |
| S122 | document 07 | 1 | 2 (note 05) |
| S125 | document 07 | 1 | 2 (note 05) |

Keys defined but not cited by any statement: S34d (note 01), S20 (note 05), S111 (note 05).

Keys cited without a label beside them: U14, U26 (document 04). The table rows that cite them carry labels for the row as a whole.

## 9. Repository sources

Facts about Yamakan itself do not come from the sources above. They come from two places.

1. The repository at the baseline commit named at the top of this file. The numbered documents cite repository files by path, read at that commit. Document 02 is the assessment of the current code.
2. The pull requests named in the legacy addendum. It extends the earlier reconciliation file `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/LEGACY_RECONCILIATION.json`. Each stream record says its pull request numbers were read from the first-parent history of main.

Pull requests by stream, as the legacy addendum gives them:

| stream | pull requests |
|---|---|
| stream:comfyui | #188, #191, #192, #194, #195, #196, #198; checkpoint documents #190 and #199 |
| stream:kaggle-create | #200 to #202, #205 to #210, #212 to #215, #217, #218, #222 to #224, #233 to #235; ledger documents #211 and #236 |
| stream:consent | #179, #181, #183, #197, #216, #219 to #221, #232, #237 |
| stream:security-check | #225 to #231, #238 to #242, #249 to #255 |
| stream:cinema | issue #203 and #243 to #248 |
| stream:blender | #256 to #260 and #263 to #278; #279 is open and not merged |
| stream:prompt-library | #261 and #262 |

Pull requests the legacy addendum leaves outside the streams:

| item | what the addendum says |
|---|---|
| Pull requests #160 to #187 except #179, #181 and #183, plus #189 and #193 | System Supremacy programme merges; covered by the systemSupremacy rows. |
| Pull request #204 | Not verified by the planning author; MPR-003 assigns it when it verifies the stream records. |

Pull requests named in the legacy addendum with their state when it was written:

| pull request | title | state |
|---|---|---|
| #85 | Earlier draft master plan | open draft when read on 2026-11-22 |
| #86 | Ultimate Master Plan (YU cards) | open draft when read on 2026-11-22 |
| #279 | Blender render view and surface on the Cinema page | open, not a draft, not merged when read on 2026-11-22 |

Document 02 also names pull request #30 (the frozen reuse-first plan) and pull request #155 (the System Supremacy plan) in its table of earlier plans.

Research notes 07 to 10 are also repository evidence, but of an older commit, 0284ba8. Line citations in them refer to that commit. They were not verified again. Where they disagree with the numbered documents or with the code at the baseline, those govern.
