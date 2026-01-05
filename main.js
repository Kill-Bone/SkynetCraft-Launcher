const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');

let mainWindow;
const launcher = new Client();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        frame: false,
        transparent: true,
        resizable: false,
        icon: path.join(__dirname, 'icon.ico'), // Az ikon beállítása
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Automatikus frissítés keresése indításkor
    autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(createWindow);

// --- SZERVERLISTA MÁSOLÓ RÉSZ ---
function syncServerList() {
    const minecraftPath = path.join(app.getPath('userData'), '.minecraft');
    const serverFileSource = path.join(__dirname, 'servers.dat');
    const serverFileDest = path.join(minecraftPath, 'servers.dat');

    try {
        if (fs.existsSync(serverFileSource)) {
            // Ha nem létezik a .minecraft mappa, létrehozzuk
            if (!fs.existsSync(minecraftPath)) {
                fs.mkdirSync(minecraftPath, { recursive: true });
            }
            // Átmásoljuk a fájlt
            fs.copyFileSync(serverFileSource, serverFileDest);
            console.log("Szerverlista sikeresen szinkronizálva!");
        }
    } catch (err) {
        console.error("Hiba a szerverlista másolásakor:", err);
    }
}

// --- JÁTÉK INDÍTÁSA ---
ipcMain.on('launch-game', async (event, args) => {
    // 1. Szerverlista frissítése indítás előtt
    syncServerList();

    // 2. Bejelentkezés (Offline mód)
    const auth = Authenticator.getAuth(args.username);

    const opts = {
        clientPackage: null,
        authorization: auth,
        root: path.join(app.getPath('userData'), '.minecraft'),
        version: {
            number: "1.20.1", // Itt írd át a verziót, ha mást használtok!
            type: "release"
        },
        memory: {
            max: "4G",
            min: "2G"
        }
    };

    console.log("Indítás folyamatban...");
    launcher.launch(opts);

    launcher.on('debug', (e) => console.log(e));
    launcher.on('data', (e) => console.log(e));
    
    launcher.on('progress', (e) => {
        event.reply('launch-progress', e);
    });

    launcher.on('close', () => {
        console.log("A játék bezárult.");
        if (mainWindow) mainWindow.show();
    });

    // Indítás után elrejtjük a launchert
    launcher.on('launch', () => {
        console.log("Játék elindult!");
        if (mainWindow) mainWindow.hide();
    });
});

// Ablak kezelés
ipcMain.on('close-app', () => app.quit());
ipcMain.on('minimize-app', () => mainWindow.minimize());

// Frissítési üzenetek küldése a kezelőfelületre (opcionális)
autoUpdater.on('update-available', () => {
    console.log('Frissítés elérhető!');
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});