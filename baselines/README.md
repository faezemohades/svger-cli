# Behavioral baseline policy

Every versioned directory below this path is sealed by its `baseline.lock.json`. Existing sealed
artifacts are immutable: CI rejects modification, deletion, or rename even when a pull request has
the baseline approval label.

To add a new baseline, first place the reviewed artifacts in a new versioned directory, then seal it
with the only supported update command:

```sh
npm run baseline:update -- --target v4.1.x --reason "why a new baseline is required"
```

The resulting pull request requires the `baseline-update-approved` label and CODEOWNERS review. The
verifier rejects missing, changed, and unexpected files in every sealed directory.
