// First-run cleanup after updating from Electron Spectre (2.x) to this Tauri build
use crate::core::Ctx;

pub fn run(ctx: &Ctx) {
    // dev builds run from target\ and must not touch the real install's autostart entries
    if ctx.is_dev { return; }
    #[cfg(windows)]
    if let Some(app) = ctx.app.clone() {
        if let Err(e) = windows::autostart(ctx, &app) { eprintln!("[migrate] autostart: {e}"); }
    }
}

#[cfg(windows)]
mod windows {
    use crate::core::{truthy, Ctx};
    use std::path::{Path, PathBuf};
    use windows_registry::CURRENT_USER;

    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

    /// the exe a Run command starts: `"C:\a b\x.exe" --args` or `C:\a b\x.exe --args`
    fn exe_of(cmd: &str) -> Option<PathBuf> {
        let cmd = cmd.trim();
        if let Some(rest) = cmd.strip_prefix('"') {
            return rest.split('"').next().filter(|s| !s.is_empty()).map(PathBuf::from);
        }
        let end = cmd.to_ascii_lowercase().find(".exe")? + 4;
        Some(PathBuf::from(&cmd[..end]))
    }

    fn same(a: &Path, b: &Path) -> bool {
        let n = |p: &Path| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf()).to_string_lossy().to_lowercase();
        n(a) == n(b)
    }

    /// electron Spectre's per-user install folder (electron-builder oneClick, perMachine false): %LOCALAPPDATA%\Programs\spectre, with "Uninstall Spectre.exe" next to Spectre.exe
    fn electron_install(exe: &Path) -> bool {
        let dir = exe.parent().unwrap_or(Path::new(""));
        if dir.join("Uninstall Spectre.exe").exists() { return true; }
        let Some(local) = std::env::var_os("LOCALAPPDATA") else { return false };
        same(dir, &PathBuf::from(local).join("Programs").join("spectre"))
    }

    pub fn autostart(ctx: &Ctx, app: &tauri::AppHandle) -> windows_registry::Result<()> {
        let me = std::env::current_exe().unwrap_or_default();
        let own_name = app.package_info().name.clone();
        let run = CURRENT_USER.options().read().write().open(RUN)?;

        // Spectre's Run values (Electron "electron.app.Spectre" or our own "Spectre") that start a missing exe or the old Electron one
        let mut stale = Vec::new();
        for (name, _) in run.values()? {
            if !name.to_lowercase().contains("spectre") { continue; }
            let Ok(cmd) = run.get_string(&name) else { continue };
            let Some(exe) = exe_of(&cmd) else { continue };
            let is_spectre = exe.file_stem().map(|s| s.to_string_lossy().eq_ignore_ascii_case("spectre")).unwrap_or(false);
            if !is_spectre || same(&exe, &me) { continue; }
            if !exe.exists() || electron_install(&exe) { stale.push(name); }
        }
        let approved = CURRENT_USER.options().read().write().open(APPROVED).ok();
        for name in &stale {
            match run.remove_value(name) {
                Ok(()) => eprintln!("[migrate] removed stale autostart entry {name:?}"),
                Err(e) => eprintln!("[migrate] could not remove autostart entry {name:?}: {e}"),
            }
            if let Some(k) = &approved { let _ = k.remove_value(name); }
        }

        // "Launch at login" on but our own entry missing (it was the Electron one, or just removed): register this exe
        if truthy(&crate::api::settings::load(ctx)["launchAtLogin"]) && run.get_string(&own_name).is_err() {
            use tauri_plugin_autostart::ManagerExt;
            match app.autolaunch().enable() {
                Ok(()) => eprintln!("[migrate] re-enabled launch at login"),
                Err(e) => eprintln!("[migrate] could not enable launch at login: {e}"),
            }
        }
        Ok(())
    }
}
