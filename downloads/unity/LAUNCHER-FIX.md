# Windows build repair — package 0.1.1

This patch fixes the blank “Unity exited with code .” launcher error and both build blockers confirmed by the supplied Unity log. It does not change gameplay, content, assets, saves or the native port's unfinished status.

## Apply to your existing project

1. Close Unity Editor for this project and close any previous build windows.
2. Extract **DCSMCRAFT-Unity-Build-Fix-v0.1.1.zip directly into your existing DCSMCRAFT-Unity folder** (the folder containing Assets, Packages and ProjectSettings). Replace all supplied files when prompted: Build-Windows.cmd, tools/Build-Windows.ps1, Packages/manifest.json and Assets/DCSMCRAFT/Editor/BuildCli.cs. Do not extract into Assets or create a second nested project folder.
3. Double-click Build-Windows.cmd again and leave the window open. Asset restoration verifies the existing files and only downloads missing assets.
4. A successful actual Unity build produces Builds/Windows/DCSMCRAFT-Unity.exe and its supporting files. This patch itself is not a game executable.

The full Project-v0.1.1.zip is also available for a fresh extraction. It uses the same Media/Models-Art v0.1.0 bundles; those files do not need updating.

## Cause and fix

The actual Unity 6000.0.62f1 log identified two additional project errors. The manifest incorrectly requested com.unity.modules.inputlegacy@1.0.0, which is not an installable package; that entry has been removed (the engine already supplies its legacy input module). The build receipt declared errors as uint while BuildSummary.totalErrors returns int, causing CS0266; the receipt now uses int. Other resolved packages and gameplay code are unchanged.

The old launcher used PowerShell's LASTEXITCODE after directly starting Unity.exe. For a Windows GUI executable that variable can remain unset, so the launcher immediately raised a failure with no number before reliably waiting for the Editor.

The replacement explicitly starts Unity with Start-Process -Wait -PassThru and reads that process's ExitCode. Quoted project/log paths preserve spaces. Unity failures print their real numeric exit code and log details. Missing logs no longer cause a second Get-Content error. Previous log/receipt files are retained as .previous; a fresh successful receipt and output are required so an old EXE cannot mask a failed or incomplete run. The CMD wrapper preserves failure codes and keeps the result visible.

If Unity reports an additional compiler, package, licensing or project-already-open error, BuildLogs/Unity.log contains the actual issue; share that log to diagnose it. This launcher repair does not claim to resolve an unseen Unity compiler/license error.

## Validation

10 regression scenarios passed using real PowerShell 7.4.13 on Linux and a delayed stand-in Editor process: Windows-target success, EditorCheck success, editor supplied through UNITY_EDITOR, nonzero exit with compiler-style log, failure without a log, exit zero without output, stale prior output/receipt, failed receipt, malformed receipt, and missing Editor. Paths include spaces, ampersands and Unicode. The stand-in is a test fixture, not Unity or a game executable.

Three additional checks passed: the actual BuildCli source compiles against a narrow API fixture with int totalErrors, restoring the old uint field reproduces CS0266, and the invalid package is absent. The fixture uses the return type verified in Unity 6 documentation; it is not Unity Editor. See Tests/EditorCompile/results.json.

Actual Windows GUI launch behavior, Windows PowerShell 5.1 execution and Unity compilation still need confirmation on the user's PC. The reported faulty LASTEXITCODE code path has been removed. Tests/Launcher/results.json records the test scope.
