# Automatic Unity build repair — package 0.1.2

The pasted log is from the earlier interactive Editor session (`BatchMode: 0`), still showing the invalid inputlegacy package and CS0266. It is not evidence of a new batch-build cause: either the log is stale or the complete repair did not reach the project. This package automatically installs and verifies all four required files.

## Existing project: automatic repair

1. Close Unity Editor and previous build windows.
2. Extract **DCSMCRAFT-Unity-Automatic-Repair-v0.1.2.zip** anywhere, using Extract All first. Open the extracted DCSMCRAFT-Unity-Repair folder.
3. Double-click **Apply-Fix.cmd**. It finds the original project under Downloads automatically when there is one matching project; otherwise select the existing DCSMCRAFT-Unity folder containing Assets, Packages and ProjectSettings.
4. Wait for **Repair applied and verified**. It prints the actual project path and saves backups. Then double-click **Build-Windows.cmd in that project**, with Unity Editor closed.

The installer verifies its full payload before changing anything, backs up the four original files under `.buildfix-backups`, copies the corrected files, checks every installed SHA-256 and writes `Verification/build-repair-v0.1.2.json`. It does not delete Library, source content, assets or saves. Payload corruption, invalid targets and unexpected paths are rejected. The separate full Project-v0.1.2.zip is also corrected for a fresh extraction; Media and Models-Art v0.1.0 remain unchanged.

## Corrections

- Removes nonexistent `com.unity.modules.inputlegacy@1.0.0`; Unity already supplies its legacy input engine module.
- Changes the Editor build receipt's error count from uint to int, matching Unity 6 `BuildSummary.totalErrors`, fixing CS0266.
- Waits for the Unity process using Start-Process -Wait -PassThru and reads its ExitCode directly instead of relying on LASTEXITCODE for a Windows GUI executable.
- Quotes project/log paths; requires fresh successful receipts and output; prints actual Unity diagnostics.
- Rejects a partially repaired manifest or Editor script before starting Unity.
- Writes the current failure's error matches and log tail to **BuildLogs/BuildFailure.txt**. If Unity still fails, attach that file, rather than the old interactive Editor log. Previous Unity.log/receipts are retained with `.previous` suffixes.

This is a build repair, not a completed game port or a precompiled executable. It cannot claim to fix an unseen new compiler/package/license error. A successful actual build must produce Builds/Windows/DCSMCRAFT-Unity.exe plus supporting files.

## Verification

- 12 launcher scenarios pass in actual PowerShell 7.4.13 on Linux against a delayed stand-in process: completion, EditorCheck, environment editor selection, numeric failure, no log, missing output, stale output, failed/malformed receipt, missing Editor, old manifest and old Editor script.
- Six installer scenarios pass against isolated old-project fixtures: successful hash-verified repair with backup/gameplay/cache/save preservation, repeat repair, corrupt payload rejection, duplicate manifest rejection, traversal rejection and invalid project rejection.
- Three prior build checks cover actual BuildCli compilation against a narrow API fixture with the documented int totalErrors signature, reproduction of CS0266 with the old unsigned field, and absence of the invalid package.

These are build-tool tests, not actual Unity Editor/Windows runtime tests. Automatic Downloads discovery, the Windows folder dialog, Windows file locking and a real Unity build still require confirmation on the user's PC. Installer source is in tools/repair; the distributable repair ZIP adds its generated payload and hash manifest.
