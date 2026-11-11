# Save durability contract — local audit

This change applies to the 2.8.6 development source on `audit/p0-build-save`.
It is not a published release. Terrain, inventory, Stands, Titan data, multiplayer
profiles and all existing generator versions keep their previous representation.

## Outcomes

`SaveStore.save(snapshot)` resolves an object with `status`, `backend`, `id`,
`name`, `updated`, and an `error` message where applicable:

| Status | Meaning | UI and recovery |
| --- | --- | --- |
| `durable` | IndexedDB transaction completed, or localStorage setItem succeeded. | Saved locally; updates the last-committed timestamp. |
| `session-only` | Serialization succeeded, but persistent storage rejected the write. | Latest state stays in this tab's memory; persistent warning and Export latest backup action. Last durable generations stay unchanged. |
| `failed` | No valid snapshot could be captured/serialized. | Save failed warning; last-committed timestamp stays unchanged. The live world remains available for retry/export if it can be serialized. |

`Game.save()` propagates successful/downgraded outcomes. A failed capture rejects
with `error.outcome` after updating the UI, preserving existing callers' rollback
handling. An IndexedDB put request succeeding is insufficient: aborting its
transaction still produces `session-only`, never a durable acknowledgement.

Durable means committed to the browser storage API. It does not prevent browser
eviction, private-mode deletion, profile/origin changes, user clearing data, or
hardware failure. Keep exported backups. Page-close saving is best effort and
must not be the only backup strategy.

## Queues, generations and exports

- Every save captures its snapshot at invocation. Each caller waits for its own
  queued write, including callers arriving during an earlier autosave.
- Storage reads, writes, listings and deletion are ordered within a SaveStore.
- Committed and memory-only records use separate caches. Failed writes cannot
  replace the current durable record or rotate its recovery generation.
- A successful retry backs up the previous **durable** current generation. If
  current is corrupt, the valid durable backup is retained instead.
- IndexedDB transaction failure never silently redirects that world to a second
  backend. The session overlay remains readable/exportable while the database
  retains its old generations; later saves can retry the same backend.
- Initial IndexedDB denial still permits the existing localStorage fallback.
  Unreadable/corrupt fallback data is preserved rather than replaced by `{}`.
- Export of the active local world snapshots the live simulation at click time,
  including changes newer than a pending save. It does not wait for, overwrite,
  or rotate durable saves. Inactive worlds export their latest session overlay,
  otherwise their validated durable current/backup.
- A warning stays visible through pause, title and encounter menus, and exporting
  does not falsely clear it. A successful durable retry clears that world's
  warning. Another world's unsaved overlay continues to warn.

## Compatibility

No save migration is needed: database `dcsmcraft-worlds` version **1**, object
store `worlds`, fallback key `dcsmcraft-worlds-fallback-v1`, checksummed envelope
fields `payload`/`checksum`, `current`/`backup`, and exported format **1** are
unchanged. Durability outcomes and warning state are session metadata only.
Block IDs, world seed, generator version, rewards, inventory metadata and realm
data are not transformed. Previously exported world backups remain importable.

No cross-tab merge, cross-device sync, dedicated server, or host migration is
introduced. Use one active writer per world; independent tabs still have
last-writer-wins world snapshots. The supplied local MP3 library continues to
live outside world backups. A session-only world is lost when its tab closes
unless exported. Persistent storage cannot be repaired by this code if the
browser continues to deny it.

The existing **20 MB world-backup import limit** is retained; larger exports are
not verified as importable. Durability warnings belong to the saving host's UI;
co-op guests do not receive durable-commit acknowledgements. These limits are
not changed by the new storage queue.

## Regression coverage

`tests/save-durability.test.js` checks real queue/snapshot behavior against a
quota-denying storage adapter, byte-preserved generations, corrupt-current
recovery, independent worlds, failed serialization and retry.

`tests/browser/save-durability.spec.js` runs the exact standalone HTML. It uses
native browser localStorage and IndexedDB, injects quota denial and an abort
**after put succeeds**, verifies warning/lastSaved behavior, downloads and reads
the exported JSON, restarts into the last committed save, deliberately corrupts
current, and restarts into the valid backup. An interrupted document disables
graceful pagehide saving so that the corruption fixture is not repaired before
the restart. Additional tests exercise live exports during queued writes and
the distinct failed-capture UI.
