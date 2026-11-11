# Prioritized sandbox audit — local review

Scope: the user's nine-stage audit of `downloads-v2.8.6`, commit
`696a15bc4310c3a5b2bb520eab615bb81fc6bbb1`. The request explicitly permits staged
delivery. This pass implements stages **1 and 2**. Stages 3–9 are unfinished and
are not represented as completed features.

## Source and isolation

- Remote `main` still contains the earlier README-only source layout. The latest
  available release source was 2.8.6; no newer development branch was found.
- The existing local source matched all **667 archive files byte-for-byte**.
  It was initially untracked on an unborn branch. A baseline import was committed
  locally before edits; work is isolated on **`audit/p0-build-save`**.
  The branch shares the unchanged `main` ancestor, so it is ready for ordinary
  source review if publication is later approved. Earlier local import trees
  were retained on `audit/p0-import-history`.
- The root now contains unpacked source, supplied assets/notices, tests, lockfile,
  build scripts and CI. Generated worker, embedded data and outputs are ignored.
- Nothing was pushed, merged, deployed or published. No default branch was changed.
  The existing published 2.8.6 downloads remain unchanged.

## Stage 1 — implemented

Reproduced the exact `Missing: fsevents@2.3.3 from lock file` failure using
**Node 24.22.1 / npm 11.9.0**, before changing dependencies. Ran npm lockfile
regeneration in a clean dependency directory; all previously resolved versions
were retained. Declared Node 24/npm 11 support, pinned the verified combination,
and declared the existing esbuild 0.25.12 build dependency directly.

Relevant files: `package.json`, `package-lock.json`, `.nvmrc`, `.node-version`,
`.gitignore`, `BUILDING.md`, `.github/workflows/verify.yml`,
`playwright.smoke.config.js`, `tests/browser/build-smoke.spec.js`,
`scripts/package-release.py`.

CI performs clean install, lockfile-diff checking, full unit suite, production
build, standalone packaging, and production/packaged browser smoke tests. It
does not publish. The exact HTML is streamed over a native loopback HTTP server;
passing the 134 MB file through Playwright interception/tracing caused a test
harness/browser failure, so no interception or large-script tracing is used.

## Stage 2 — implemented

Added explicit durable/session-only/failed results; separate memory overlays;
per-world persistent warnings and a live export action; ordered snapshot/write
requests; and unchanged durable backup generations after failed writes.

Relevant files: `src/storage.js`, `src/save-session.js`, `src/save-status.css`,
`src/main.js`, `src/ui.js`, `scripts/build-standalone.mjs`,
`tests/save-durability.test.js`, `tests/browser/save-durability.spec.js`.
The older art-only hash guard exempts the authorized storage change and keeps
its remaining asset/gameplay checks. See [SAVE-DURABILITY.md](SAVE-DURABILITY.md)
for the contract, compatibility details and explicit limits.

## Verification

- Clean worktree: `npm ci` succeeds; lockfile remains unchanged.
- Removed every generated embed and terrain worker, then ran `npm ci` →
  `npm test` **before any build**: **661/661 passed**. The audit caught and fixed
  a test/build ordering dependency by adding worker generation to `pretest`;
  the earlier concurrent test/build run alone did not establish this guarantee.
- Stage 1: **654/654** existing unit checks, production build, standalone package,
  and both production/packaged create → move → inventory → save → reload → quit
  browser cases passed.
- Stage 2: **661/661** unit checks passed, including seven new durability cases.
- Production and standalone builds pass. Windows x64 cross-compilation passes;
  the Linux companion extracts an HTML payload byte-identical to the tested file.
- Final `npm run test:smoke`: **8 passed, 1 skipped**. Tests cover production and
  exact packaged HTML, native IndexedDB rollback after put success, quota denial,
  live backup downloads, durable/backup recovery, concurrent saves/exports and
  both Survival/Creative compatibility when UUID/clone/IndexedDB APIs are absent.
  The only skip is managed Chromium rejecting `file://` navigation with
  `ERR_BLOCKED_BY_ADMINISTRATOR` before loading the game. No policy bypass was used.
- `npm run test:regression`: **21 passed**. Natural wood → crafting UI → tools,
  progressive mining, ore drops, smelting, building, running/paused furnaces,
  a simulated sheltered night, death/respawn, inventory/container/entity reload,
  corrupt-save recovery, Creative flight/water, backup import/export; two real
  host/guest Survival co-op cases including reconnect and shared-chest races;
  ten retained Titan cases including complete portal-to-victory play, checkpoint
  recovery, failed-save reward rollback, overflow drops, return state, clips,
  audio, Cyloop and swats. Total: **29 passed browser cases, 1 policy-blocked skip**.
- Another clean install rebuilt standalone HTML **byte-identical** to the tested
  build. All previously resolved dependency versions/integrities are unchanged;
  the new optional lock entry is Rollup's macOS fsevents dependency.
- Byte comparison against the audited source confirms **431 existing runtime,
  asset and server files unchanged**. Only `src/main.js`, `src/storage.js` and
  `src/ui.js` changed among existing runtime files; `src/save-session.js` and
  `src/save-status.css` are new. No world IDs, generators, combat rules, custom
  content, Stands, supplied assets or multiplayer protocol were changed.

The old Creative inventory assertion and closed-recipe-book test helper were
updated to exercise the current UI through its controls. The initial interrupted
development-server run and corrected test fixtures are not counted as passing
verification runs. Final pass logs and reproduction evidence are packaged in the
local audit evidence ZIP.

No hours-long persistence soak, native Windows launch, Firefox, Safari, macOS or
physical GPU/device matrix has been verified. CI has been prepared locally but
has not run on GitHub because publication is not authorized. The large embedded
audio/model bundle still triggers Vite's size warning; this pass does not claim
to solve that performance limitation.

The existing 20 MB world-backup import cap, single-writer-per-world expectation,
host-only durability warnings and best-effort page-close saving are documented
in SAVE-DURABILITY.md. Native Windows launch and file-origin browser persistence
still require testing on the target PC. This pass does not claim that every
browser suite or long-session scenario has been verified.

## Reproduce the completed checks

Use Node **24.22.1** and npm **11.9.0**, then run in this order:

```sh
npm ci
git diff --exit-code -- package-lock.json
npm test
npm run build
npm run build:standalone
npx playwright install --with-deps chromium
npm run test:smoke
npm run test:regression
# Optional with the documented Linux Zig compiler and gcc installed:
npm run build:desktop
```

Native extraction verification is part of `build:desktop`; it is not a native
Windows execution test. `test:regression` takes about 15 minutes on this software
renderer because it includes real traversal and combat. Keep source unchanged
during it so the development server does not hot-reload a running fixture.

## Exact continuation checklist

Complete each stage and its acceptance tests before advancing. Preserve save
format, generator versions, custom content and co-op authority throughout.

1. **Stage 3 — next, not started.** Inspect current `CONTENT.md`, edition recipes,
   world/entity loot, harvest/trade/smelting code and reference ledgers. Generate
   a Survival acquisition graph with catalog presence, behavior, starting source,
   renewable source and verified paths as separate fields. Detect source-less
   cycles and unreachable ingredients. Fix ordinary tools/equipment/farming/
   construction blockers first. Then implement anvil/grindstone transactions
   preserving damage, enchantments and metadata. Verify fresh-world progression
   through reload; label Creative-only and custom substitutes explicitly.
2. **Stage 4 — not started.** Revalidate renderer block lighting against simulation
   spawning/growth. Add mesh-independent block/skylight queries, wall occlusion,
   non-torch emitters and chunk-boundary invalidation. Build species-specific
   crop rules with a fair bounded scheduler and defined unloaded behavior.
   Test removal across seams, reload, and large-farm fairness.
3. **Stage 5 — not started.** Add explicit hand precedence/use state and atomic
   hand swapping, then correct-hand cooldown, charge and durability. Support
   sword + offhand shield and the selected reference's blocking/disable rules.
   Validate guest intents on the host. Test charge/menu/death/reconnect swaps,
   persistence, durability and duplicate prevention.
4. **Stage 6 — not started.** Replace hardness guesses with validated per-block
   mining/loot data; implement compatible waterlogged states and bounded neighbor,
   support and attachment updates. Prioritize slabs, stairs, doors, fences and
   plants. Separate manual/signal operation. Preserve IDs; explicitly migrate any
   changed block-state encoding. Test drops, tiers, seams and reload.
5. **Stage 7 — not started.** Implement deterministic signal/update scheduling
   before expanding catalogs: source/wire → repeater/comparator → device → hopper
   → piston. Define chunk/unloaded semantics and bound cycles. Verify saved/co-op
   door circuits, clocks, container readers and hopper-fed furnaces with item
   conservation. Do not label registry entries as functional automation.
6. **Stage 8 — not started.** Add budgeted loaded-geometry routes, invalidation
   on block/door edits and villager home/work/flee/trade tasks. Extend simulation
   coverage around active guests and validate guest realm transfer. Test separated
   guests, reconnect and item/entity conservation. Dedicated-server simulation and
   host migration remain separate proposals requiring approval.
7. **Stage 9 — not started.** Build one authoritative current feature ledger;
   generate current summaries separately from historical notes. Track implemented,
   verified, partial, deferred and excluded status. Recheck obsolete claims against
   code. Verify the declared Java Edition **26.3** reference before asserting parity.
   Keep supplied asset attribution distinct; assess a separate original-assets-only
   build without removing supplied assets. Do not add new Nether/End content.
   Full dimensional progression remains an unresolved broader-goal gap.

These are continuation tasks, not a new claim that each old audit finding still
exists unchanged. Each must be revalidated against the current code first.
