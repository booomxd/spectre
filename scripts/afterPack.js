// electron-builder afterPack hook: stamps the Spectre icon and name into Spectre.exe before the installer and zip
// are made. Builds skip electron-builder's own exe editing (signAndEditExecutable: false), which would otherwise
// leave Electron's icon on the taskbar and shortcuts and "Electron" in Task Manager.
const path = require('path');
const rcedit = require('rcedit');

exports.default = async ({ electronPlatformName, appOutDir, packager }) => {
    if (electronPlatformName !== 'win32') return;
    const { productName, productFilename, version } = packager.appInfo;
    const exe = path.join(appOutDir, `${productFilename}.exe`);
    await rcedit(exe, {
        icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
        'file-version': version,
        'product-version': version,
        'version-string': {
            ProductName: productName,
            FileDescription: productName,
            InternalName: productName,
            OriginalFilename: `${productFilename}.exe`,
            CompanyName: 'booomxd',
            LegalCopyright: 'booomxd',
        },
    });
    console.log(`  • stamped icon and version info  file=${path.basename(exe)}`);
};
