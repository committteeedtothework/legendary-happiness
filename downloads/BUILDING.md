# Reproducible source build

The review branch contains the unpacked application at the repository root. Its
baseline is the 667-file source archive from `downloads-v2.8.6`, commit
`696a15bc4310c3a5b2bb520eab615bb81fc6bbb1`; every imported file was byte-compared.
The remote default branch remains unchanged. No release or deployment is part of
this audit. Generated outputs stay in ignored `dist/`, `.desktop-cache/` and
`artifacts/`; supplied source assets remain under `public/` with their notices.

Use **Node 24 LTS, at least 24.22.1, and npm 11, at least 11.9.0**. The pinned,
verified combination is **Node 24.22.1 / npm 11.9.0**, recorded in `.nvmrc`,
`.node-version` and `packageManager`. Other Node/npm major versions are unsupported.

```sh
nvm install
nvm use
npm install --global npm@11.9.0
npm ci
npm test
npm run build
npm run build:standalone
npx playwright install --with-deps chromium
npm run test:smoke
```

`npm ci` must not change `package-lock.json`. The lock was regenerated with npm,
in an empty dependency directory, retaining all previous resolved versions.
`esbuild` is now an explicit build dependency at its existing resolved version.
No dependency was upgraded. Asset embedding and the terrain worker regenerate
from checked-in sources, including `pretest` generating the worker before unit
tests; no paid tool, external model download or credential is
required. CI executes these commands on Linux and does not publish anything.

`npm run dev` runs the development server. `npm run preview` serves the production
build. The standalone output is `dist/DCSMCRAFT-Standalone.html`: double-click it
in a desktop browser with WebGL 2. Singleplayer needs no server; public multiplayer
still needs a separately configured relay. Smoke tests serve the exact packaged
HTML over loopback because managed browser policies can block `file://` itself.

Optional Windows packaging: after the standalone build, set `DCSMCRAFT_ZIG` to
the compiler described in `desktop/TOOLCHAIN.json`, then run `npm run build:desktop`.
It cross-compiles the existing Windows launcher and verifies its embedded HTML
using a Linux extraction companion. This does not verify native Windows launch.
Full release ZIP packaging uses `python3 scripts/package-release.py --output artifacts`.
Packaging is local only; publication requires separate approval.

The local audit's save contract is in [SAVE-DURABILITY.md](SAVE-DURABILITY.md).
[AUDIT.md](AUDIT.md) records completed stages, verification and the continuation
checklist. `npm run test:regression` exercises the retained sandbox, Survival
co-op and Titan browser suites against the development server. Build standalone
first; leave source files unchanged during the run to avoid Vite hot reloads.
Those suites disable large-script tracing and use screenshots/assertions instead.
