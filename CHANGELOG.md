# Changelog

All notable changes to this project are documented in this file.

## [1.0.2] - 2026-04-02

### Added
- Prompt duplicate guard before execution to reduce cross-machine double-runs.
- Prompt output existence check keyed by `prompt_id + brand_id + batch_id` before dispatching each prompt.
- `Skip Prompts` control in the popup with offset options: `0, 20, 40, 60, 80, 100`.
- Runtime skip-offset behavior so `20` starts execution at prompt index `20`.

### Changed
- Unified first prompt dispatch with the same validation/dedup flow used for subsequent prompts.
- Persisted skip prompt settings in extension storage and passed them through start automation messaging.

### Amends
- Bumped extension version in `manifest.json` from `1.0.1` to `1.0.2`.
- Added fail-open behavior for duplicate-check API failures so automation continues even if the check endpoint is unavailable.

