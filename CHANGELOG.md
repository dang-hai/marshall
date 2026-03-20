# Changelog

## [0.0.11](https://github.com/dang-hai/marshall/compare/v0.0.10...v0.0.11) (2026-03-20)


### Bug Fixes

* **ci:** add vercel pull before build to fetch project settings ([93e193b](https://github.com/dang-hai/marshall/commit/93e193b789917e6a32ec45f5347e1318cd1e815f))
* **desktop:** inject backend urls at build time via vite define ([c5d75d4](https://github.com/dang-hai/marshall/commit/c5d75d4b5fc2a097d3d4974e4a43db113d3884c3))

## [0.0.10](https://github.com/dang-hai/marshall/compare/v0.0.9...v0.0.10) (2026-03-20)


### Bug Fixes

* **ci:** deploy prebuilt assets and fix release upload ([b49e0c7](https://github.com/dang-hai/marshall/commit/b49e0c770b07b9f78bb95a2acfb6459b872884d5))

## [0.0.9](https://github.com/dang-hai/marshall/compare/v0.0.8...v0.0.9) (2026-03-20)


### Features

* **ci:** add smoke test to catch missing modules in electron build ([d08bed1](https://github.com/dang-hai/marshall/commit/d08bed1b39229b0bc67389b0b99f04dfe7c7650f))


### Bug Fixes

* **ci:** chain build workflow from release-please and fix type errors ([da1efa3](https://github.com/dang-hai/marshall/commit/da1efa3c3271ae412c31547101deb0de49d3f0d9))
* **desktop:** add node-fetch for notionhq/client in electron build ([b9c7871](https://github.com/dang-hai/marshall/commit/b9c7871275c7c5e27a11fe46d661dec66924d317))
* **desktop:** use node-fetch v2 for commonjs compatibility ([10a82b5](https://github.com/dang-hai/marshall/commit/10a82b5dfa1b55a2ea8be51195c4691fb166b276))

## [0.0.8](https://github.com/dang-hai/marshall/compare/v0.0.7...v0.0.8) (2026-03-20)

### Bug Fixes

- **ci:** build shared package before running tests ([34ce8ca](https://github.com/dang-hai/marshall/commit/34ce8ca7f627477fcc45341fe6ba225dc28c4f6d))
- **ci:** remove type import before mock and require ci for releases ([573fc02](https://github.com/dang-hai/marshall/commit/573fc029138523051bc680765aae08960386fae7))
- **desktop:** correct electron mock to use named export ([3e1d8cb](https://github.com/dang-hai/marshall/commit/3e1d8cb1c19e68976f1222ff98b34556c1ddbe08))
- **desktop:** simplify electron mock in ai-agent-monitor test ([d857856](https://github.com/dang-hai/marshall/commit/d8578567b5c1e3019c51a6c3011b47d23cd98c57))
- **desktop:** skip ai-agent-monitor test in ci ([da61f89](https://github.com/dang-hai/marshall/commit/da61f89479d26e563efd06bc88f1f7de8da6d979))

## [0.0.7](https://github.com/dang-hai/marshall/compare/v0.0.6...v0.0.7) (2026-03-20)

### Features

- **utilities:** add notion cli and mcp server with electron integration ([#53](https://github.com/dang-hai/marshall/issues/53)) ([8fbb321](https://github.com/dang-hai/marshall/commit/8fbb321d6c161ad7ad34ce171743abeb12e09726))

### Bug Fixes

- **desktop:** update upcoming events panel test to match component ([d08fbc5](https://github.com/dang-hai/marshall/commit/d08fbc522130e4e3c71047c0e78ac3a9ecd8fdce))
- **scripts:** use branch name as initial pull request title ([e8c1cad](https://github.com/dang-hai/marshall/commit/e8c1cadf54cae941f72df595dedaaabe485bb29e))

## [0.0.6](https://github.com/dang-hai/marshall/compare/v0.0.5...v0.0.6) (2026-03-20)

### Features

- close pr on worktree teardown ([d57079b](https://github.com/dang-hai/marshall/commit/d57079bcf35052229373e7b3c56052bfd2aaa0e2))
- per-worktree electron protocol for multi-workspace auth ([d023378](https://github.com/dang-hai/marshall/commit/d023378be8f92ea649393ddde32d6f74421bd349))

### Bug Fixes

- **desktop:** add timed call notification dismissal ([2510b0d](https://github.com/dang-hai/marshall/commit/2510b0d0755ab20e5a85b3cd1f6aabaa9cd4edc3))
- **desktop:** bundle conf in main build ([#46](https://github.com/dang-hai/marshall/issues/46)) ([0acb383](https://github.com/dang-hai/marshall/commit/0acb3832b4f0d6043ff68b607d4420691c3ce95d))
- **desktop:** launch transcription from call notifications ([af7e838](https://github.com/dang-hai/marshall/commit/af7e8383a064d5835729f5327a76e69f5b494c2b))
- **desktop:** show full codex debug prompt ([#48](https://github.com/dang-hai/marshall/issues/48)) ([13e7c7c](https://github.com/dang-hai/marshall/commit/13e7c7c31ef206c173aaf1937595f385823650d6))

## [0.0.5](https://github.com/dang-hai/marshall/compare/v0.0.4...v0.0.5) (2026-03-20)

### Features

- add mprocs for interactive workspace log viewing ([f13a47a](https://github.com/dang-hai/marshall/commit/f13a47a8833ccc1952f4a0f3e053bd1d717e65cd))
- **desktop:** add chat input to codex notification window ([4da6be7](https://github.com/dang-hai/marshall/commit/4da6be73842021b82e93724f7d3748f58c9ae8c7))
- **desktop:** add codex live call monitor ([e7d9b95](https://github.com/dang-hai/marshall/commit/e7d9b955af299df6a7f319ead7cb9e8f4bb0f9e9))
- **desktop:** persist codex sessions for conversation continuity ([4793132](https://github.com/dang-hai/marshall/commit/479313281f4ca1dd72eb804e5aeae28f715eb9b9))
- **desktop:** redesign codex notification window with stable item tracking ([7f6f507](https://github.com/dang-hai/marshall/commit/7f6f50751c65e189ef79c9000e80bb3c0fcbd25a))
- **transcription:** add audio buffering and interim transcription support ([8d65ef0](https://github.com/dang-hai/marshall/commit/8d65ef0b9692dd3b366a64d3d2c6bc39d68323fb))

### Bug Fixes

- **desktop:** avoid facetime false positives ([#38](https://github.com/dang-hai/marshall/issues/38)) ([6a7a1dc](https://github.com/dang-hai/marshall/commit/6a7a1dc7536c0552acbc6da0906e7cb32e3dff6e))
- **desktop:** hydrate transcription state when persisted snapshot arrives ([3f88d4f](https://github.com/dang-hai/marshall/commit/3f88d4fd803524aa93b4033391cefa9185c83e8f))
- **desktop:** hydrate transcription state when persisted snapshot arrives ([a2abddb](https://github.com/dang-hai/marshall/commit/a2abddbfb9e0c2389f758d86f89a6cee417d6d13))
- **desktop:** hydrate transcription state when persisted snapshot arrives ([a3823a6](https://github.com/dang-hai/marshall/commit/a3823a64b8d75b09d08720b4a411464f56b35595))
- **desktop:** make notification window header draggable ([cdd0964](https://github.com/dang-hai/marshall/commit/cdd0964d8090292afcdadffc527cf12d11fa5f0d))
- keep active transcription running across window close ([bd1cf2d](https://github.com/dang-hai/marshall/commit/bd1cf2dee918831deb0ec6e82cd95f2bdcf96e2a))
- persist note transcription across editor close ([#40](https://github.com/dang-hai/marshall/issues/40)) ([3b507cc](https://github.com/dang-hai/marshall/commit/3b507cce3bd1aea352caa7465725de476b9b5db3))

## [0.0.4](https://github.com/dang-hai/marshall/compare/v0.0.3...v0.0.4) (2026-03-19)

### Features

- add floating call notification with quick note and transcription ([#33](https://github.com/dang-hai/marshall/issues/33)) ([0e53b3d](https://github.com/dang-hai/marshall/commit/0e53b3d79a1ea7248eb8a62860090100f6e6a848))
- **transcription:** auto-generate coreml encoder after model download ([5d9af3b](https://github.com/dang-hai/marshall/commit/5d9af3b0397cfa5e04259f39d343c2ccb7154f72))

## [0.0.3](https://github.com/dang-hai/marshall/compare/v0.0.2...v0.0.3) (2026-03-19)

### Features

- add audio settings page and CoreML model support ([#22](https://github.com/dang-hai/marshall/issues/22)) ([44f1f1b](https://github.com/dang-hai/marshall/commit/44f1f1b9a3ed255e66d5e37332dba540b475c15a))
- add floating transcription recorder with subtle icon-only ui ([77ead54](https://github.com/dang-hai/marshall/commit/77ead540f2cd3ec6af7b745f2fd4b1c7edea204d))

### Bug Fixes

- build shared package before desktop to fix ci deployment ([a66b4e1](https://github.com/dang-hai/marshall/commit/a66b4e1432323db0b1fc22cfb74b8e610b00ac0f))
- show floating recorder only in note editor, centered at bottom ([ab3c6ed](https://github.com/dang-hai/marshall/commit/ab3c6ed5824958381a089737f632114dfd98f633))

## [0.0.2](https://github.com/dang-hai/marshall/compare/v0.0.1...v0.0.2) (2026-03-18)

### Features

- add desktop app sidebar shell ([2563d0d](https://github.com/dang-hai/marshall/commit/2563d0d55bb7b053adce7aa6420b19b523c3def4))
- add desktop sidebar shell ([be43d2f](https://github.com/dang-hai/marshall/commit/be43d2f7ada1aa78ae217334bc038d47ed57f507))
- add GitHub workflow for macOS build and notarization ([#7](https://github.com/dang-hai/marshall/issues/7)) ([6939bde](https://github.com/dang-hai/marshall/commit/6939bde6f5a8d626ce77b3223e23286bc9dd40ed))
- add Home quick note workflow ([1f2f50c](https://github.com/dang-hai/marshall/commit/1f2f50cb5588f242cc12f57e002539241f237cc5))
- add marketing website with slideshow ([5d21298](https://github.com/dang-hai/marshall/commit/5d21298f5deebc0967167b85fc87c60950e52483))
- add Mintlify docs app ([6d2e5cd](https://github.com/dang-hai/marshall/commit/6d2e5cd397b2124f47b4551b5f877a8f873046f8))
- add whisper transcription with system audio capture and modern ui ([#5](https://github.com/dang-hai/marshall/issues/5)) ([b73282f](https://github.com/dang-hai/marshall/commit/b73282feeb1aff00e69a4074a39845683fa84d3b))
- automate neon preview databases ([a3abd45](https://github.com/dang-hai/marshall/commit/a3abd456963a787e3e8e05868f06a649a81ddedb))
- automate neon preview databases ([ad8d9cc](https://github.com/dang-hai/marshall/commit/ad8d9cc2e2ee2c099a7b6f0e26d1831029f2c371))
- bootstrap preview database setup ([871f074](https://github.com/dang-hai/marshall/commit/871f0746e58f0b5603b97de44b123d09dd3958e0))
- **home:** add quick note workflow ([a234c55](https://github.com/dang-hai/marshall/commit/a234c55e5c3d995e696f009bb4b58821e3d1e62b))
- **marketing:** add standalone privacy and terms pages ([0385d55](https://github.com/dang-hai/marshall/commit/0385d55da1f8d25805280bd967eea78814fb447c))
- **marketing:** add trusted section, footer links, privacy popup, and analytics ([c74d096](https://github.com/dang-hai/marshall/commit/c74d096519cbed22b512da6d78d47c87780f2aa3))
- **marketing:** add vercel analytics deployment ([0bce5ab](https://github.com/dang-hai/marshall/commit/0bce5ab2e4aeea6ee4498138e73adfd7431a534e))
- **release:** automate semantic release prep ([9a3ccf6](https://github.com/dang-hai/marshall/commit/9a3ccf673b4ddbd9458b5591bcde745d0984bc54))

### Bug Fixes

- build packages before desktop app in workflow ([#9](https://github.com/dang-hai/marshall/issues/9)) ([1d7e6e5](https://github.com/dang-hai/marshall/commit/1d7e6e58997765ac6df8d7e61ea06272bd2ff52b))
- extract tray icons from asar ([#12](https://github.com/dang-hai/marshall/issues/12)) ([2cb4092](https://github.com/dang-hai/marshall/commit/2cb4092b2058cda131eaa3be84c7343852021036))
- **marketing:** deploy on release pushes ([547376b](https://github.com/dang-hai/marshall/commit/547376bdd4b8f230104534a314afaff9c22a39dd))
- **release:** trigger deploy after release push ([89b7ce8](https://github.com/dang-hai/marshall/commit/89b7ce8f228f6675929fc50c273b447acd50c2a3))
