# vb-runs — VerticalBench run artifacts

Every project generated during VerticalBench experiment runs, browsable by
run → cell. One **cell** = one agent profile (model × harness × search arm)
building one **leaf** (scenario) once.

```
runs/<YYYY-MM-DD>-<run-name>/
  README.md                  ← cell index (leaf, outcome, file count)
  <profile-cell-id>/r<rep>/
    META.md                  ← model, harness, outcome, error kind, cost
    ...the actual generated project
```

Exported by `vb-export-runs.ts` from the blueprint-agent experiments harness.
Workspaces are filtered (no node_modules/caches/runtime dirs), size-capped,
and secret-scanned before publishing; withheld files are listed in each
cell's `META.md`. Cells with `turns=0` outcomes are infra failures
(quarantined from leaderboards), kept here for transparency.
