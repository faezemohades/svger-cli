# Recovery Security Boundary

Recovery is authorized for a caller-selected transaction parent directory. The parent and its output
directories must be protected by the operating system; recovery is not an authentication mechanism
for an attacker who already has the same user's write access.

Recovery journals must be regular files owned by the current process user and must not be group- or
world-writable. Existing stage directories are subject to the same ownership and permission checks.
New stages bind their generated transaction UUID into the stage name, so a journal cannot select
another new transaction's staging directory by changing only its path metadata.

Recovery never deletes an output in an ambiguous new-transaction state where there is no backup
proving that the output belongs to the transaction. It leaves the journal for an operator to
inspect. Legacy journals without a bound stage name retain their historical rollback behavior for
compatibility and therefore require the protected-directory trust boundary above.

Filesystem checks are repeated immediately before mutation, but no portable Node.js API provides a
complete open-directory/no-follow transaction across all supported platforms. Applications requiring
protection from a concurrent same-user filesystem mutator must serialize recovery with their
filesystem operations.

Rollback performed while committing uses the same per-entry markers as startup recovery. If that
rollback is interrupted, the journal is retained for a subsequent recovery pass. The transaction
diagnostic distinguishes a successful rollback from an incomplete rollback and directs callers to
rerun recovery when cleanup remains necessary.
