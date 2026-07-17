# v4.0.9 rollback plan

Use this plan only if the Phase 0 patch causes a release-critical regression that cannot be
corrected immediately with a forward patch.

1. Stop the v4.0.9 release workflow or deprecate the published v4.0.9 package.
2. Restore the `latest` distribution tag to v4.0.8 while retaining the v4.0.9 tarball and provenance
   for incident analysis.
3. Revert the v4.0.9 release commit with a normal revert commit. Do not rewrite release history and
   do not remove the immutable `baselines/v4.0.x/` archive.
4. Run the v4.0.8 baseline verifier and consumer smoke test against the restored artifact.
5. Publish an advisory explaining the affected entry point, impact, temporary mitigation, and
   planned forward-fix version.

Rollback must not silently re-enable unsafe input in environments that already depend on the v4.0.9
protection. Those consumers should pin v4.0.9 or apply an equivalent upstream input rejection rule
until a forward patch is available.

Release owner, package owner, and security reviewer must record the rollback decision and UTC
timestamp in the release incident.
