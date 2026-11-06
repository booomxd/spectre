; Spectre NSIS installer hooks (Tauri 2: bundle > windows > nsis > installerHooks).
;
; Migration from the Electron build (Spectre <= 2.4.x, electron-builder NSIS oneClick, per-user, appId com.spectre.app).
; 2.4.x's updater downloads this setup, starts it with no arguments and quits ~800 ms later. Before Tauri copies
; any file we silently run the old electron-builder uninstaller so the user ends up with ONE Spectre:
;   - old files in %LOCALAPPDATA%\Programs\spectre, its Start-menu/desktop shortcuts and its uninstall entry go away;
;   - its autostart value (HKCU\...\Run "electron.app.Spectre") is removed and, if it was active, re-created for the
;     new exe under the name tauri-plugin-autostart uses ("Spectre"), so "Launch at login" keeps working;
;   - user data in %APPDATA%\Spectre is NOT touched (we pass --updated, never --delete-app-data).
; No-op when the Electron uninstall key is absent (clean machine, or any later Tauri -> Tauri update).
; Tauri's own install uses different keys (Uninstall\Spectre, $LOCALAPPDATA\Spectre), so they are never affected.

; electron-builder's UNINSTALL_APP_KEY / APP_GUID: UUIDv5 of appId "com.spectre.app" (fixed for every 2.x build).
!define SPECTRE_ELECTRON_GUID "30f18f89-1d16-50ed-ad44-867d3f1d6e05"
!define SPECTRE_ELECTRON_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SPECTRE_ELECTRON_GUID}"
!define SPECTRE_ELECTRON_INSTKEY "Software\${SPECTRE_ELECTRON_GUID}"
!define SPECTRE_ELECTRON_EXE "Spectre.exe"
!define SPECTRE_ELECTRON_UNINSTALLER "Uninstall Spectre.exe"
!define SPECTRE_ELECTRON_RUNVALUE "electron.app.Spectre"
!define SPECTRE_RUNKEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define SPECTRE_STARTUPAPPROVED "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"

Var SpectreMigrateAutostart

!macro NSIS_HOOK_PREINSTALL
  StrCpy $SpectreMigrateAutostart "0"
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5

  ; ---- old autostart entry (written by Electron's app.setLoginItemSettings) ----
  ReadRegStr $0 HKCU "${SPECTRE_RUNKEY}" "${SPECTRE_ELECTRON_RUNVALUE}"
  ${If} $0 != ""
    StrCpy $SpectreMigrateAutostart "1"
    ; Task Manager "Disabled" = StartupApproved value whose first byte is odd (02 enabled, 03 disabled).
    System::Call '*(&i16) p .r3'
    System::Call 'advapi32::RegGetValueW(p 0x80000001, w "${SPECTRE_STARTUPAPPROVED}", w "${SPECTRE_ELECTRON_RUNVALUE}", i 0x8, p 0, p r3, *i 16) i .r4'
    ${If} $4 = 0
      System::Call '*$3(i .r5)'
      IntOp $5 $5 & 1
      ${If} $5 = 1
        StrCpy $SpectreMigrateAutostart "0"
      ${EndIf}
    ${EndIf}
    System::Free $3
    DeleteRegValue HKCU "${SPECTRE_RUNKEY}" "${SPECTRE_ELECTRON_RUNVALUE}"
    DeleteRegValue HKCU "${SPECTRE_STARTUPAPPROVED}" "${SPECTRE_ELECTRON_RUNVALUE}"
  ${EndIf}

  ; ---- old Electron install ----
  ReadRegStr $0 HKCU "${SPECTRE_ELECTRON_UNINSTKEY}" "UninstallString"
  ${If} $0 != ""
    ; install dir: InstallLocation, else the parent of the quoted path in UninstallString
    ReadRegStr $1 HKCU "${SPECTRE_ELECTRON_INSTKEY}" "InstallLocation"
    ${If} $1 == ""
      StrCpy $2 $0 1
      ${If} $2 == '"'
        StrCpy $2 $0 "" 1
        ${StrLoc} $3 $2 '"' ">"
        ${If} $3 != ""
          StrCpy $2 $2 $3
          ${GetParent} $2 $1
        ${EndIf}
      ${EndIf}
    ${EndIf}

    ; never point the old uninstaller (it does RMDir /r on its dir) at our own dir or at the data folder
    ${If} $1 == "$INSTDIR"
    ${OrIf} $1 == "$APPDATA\Spectre"
      StrCpy $1 ""
    ${EndIf}

    ${If} $1 != ""
    ${AndIf} ${FileExists} "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
      DetailPrint "Removing the previous Spectre (Electron) from $1"

      ; 2.4.x quits by itself right after starting this setup: give it up to ~10 s to let go of its exe.
      ; (A running exe can't be opened for writing; nothing is written.) If it is still running, the old
      ; uninstaller closes it itself (electron-builder CHECK_APP_RUNNING: taskkill, then taskkill /f).
      StrCpy $2 0
      ${Do}
        ${IfNot} ${FileExists} "$1\${SPECTRE_ELECTRON_EXE}"
          ${Break}
        ${EndIf}
        ClearErrors
        FileOpen $3 "$1\${SPECTRE_ELECTRON_EXE}" a
        ${IfNot} ${Errors}
          FileClose $3
          ${Break}
        ${EndIf}
        IntOp $2 $2 + 1
        ${If} $2 > 20
          ${Break}
        ${EndIf}
        Sleep 500
      ${Loop}

      ; Run a copy from $PLUGINSDIR with _?= so ExecWait really waits (same as electron-builder's own
      ; uninstallOldVersion). /currentuser: per-user install. --updated: keep app data even if the old build
      ; had deleteAppDataOnUninstall, and skip the "app is running" prompt. No --keep-shortcuts, so the old
      ; Start-menu/desktop shortcuts are removed (Tauri creates its own right after).
      InitPluginsDir
      StrCpy $3 "$PLUGINSDIR\spectre-electron-uninstall.exe"
      ClearErrors
      CopyFiles /SILENT "$1\${SPECTRE_ELECTRON_UNINSTALLER}" "$3"
      ${If} ${Errors}
        StrCpy $3 "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
      ${EndIf}

      StrCpy $2 0
      ${Do}
        IntOp $2 $2 + 1
        ClearErrors
        ExecWait '"$3" /S /currentuser --updated /KEEP_APP_DATA _?=$1' $4
        ${If} ${Errors}
        ${AndIf} $3 != "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
          ; copy could not be started (e.g. policy on %TEMP%): try in place
          StrCpy $3 "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
          ClearErrors
          ExecWait '"$3" /S /currentuser --updated /KEEP_APP_DATA _?=$1' $4
        ${EndIf}
        ${If} ${Errors}
          DetailPrint "Old Spectre uninstaller could not be started"
          ${Break}
        ${EndIf}
        ${If} $4 = 0
          ${Break}
        ${EndIf}
        DetailPrint "Old Spectre uninstaller returned $4 (attempt $2)"
        ${If} $2 >= 3
          ${Break}
        ${EndIf}
        Sleep 1500
      ${Loop}

      ; when run in place the uninstaller can't delete itself; tidy up if that's all that is left
      ${IfNot} ${FileExists} "$1\${SPECTRE_ELECTRON_EXE}"
        Delete "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
        RMDir "$1"
      ${EndIf}
    ${EndIf}

    ; stale entry with the app already gone (uninstaller missing): drop the leftover keys
    ${If} $1 != ""
    ${AndIfNot} ${FileExists} "$1\${SPECTRE_ELECTRON_EXE}"
    ${AndIfNot} ${FileExists} "$1\${SPECTRE_ELECTRON_UNINSTALLER}"
      ReadRegStr $0 HKCU "${SPECTRE_ELECTRON_UNINSTKEY}" "UninstallString"
      ${If} $0 != ""
        DeleteRegKey HKCU "${SPECTRE_ELECTRON_UNINSTKEY}"
        DeleteRegKey HKCU "${SPECTRE_ELECTRON_INSTKEY}"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; carry "Launch at login" over: same value name/format tauri-plugin-autostart (auto-launch) writes
  ${If} $SpectreMigrateAutostart == "1"
    WriteRegStr HKCU "${SPECTRE_RUNKEY}" "${PRODUCTNAME}" "$INSTDIR\${MAINBINARYNAME}.exe "
  ${EndIf}
!macroend
