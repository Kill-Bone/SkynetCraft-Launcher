const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const launcher = new Client();

let mainWindow;

// Útvonalak
const minecraftPath = path.join(app.getPath('userData'), ".minecraft");
const configPath = path.join(app.getPath('userData'), 'config.json');

// Szerverlista másolása (hogy a Multiplayer menüben ott legyenek a szerverek)
function updateServerList() {
    const sourceServersDat = path.join(__dirname, 'servers.dat');
    const targetServersDat = path.join(minecraftPath, 'servers.dat');
    try {
        if (!fs.existsSync(minecraftPath)) {
            fs.mkdirSync(minecraftPath, { recursive: true });
        }
        if (fs.existsSync(sourceServersDat)) {
            fs.copyFileSync(sourceServersDat, targetServersDat);
        }
    } catch (err) {
        console.error("Szerverlista hiba:", err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 600,
        transparent: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

ipcMain.handle('get-profile', async () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath));
        } catch (e) { return null; }
    }
    return null;
});

ipcMain.on('save-profile', (event, userData) => {
    // Adatok mentése
    fs.writeFileSync(configPath, JSON.stringify({
        username: userData.username,
        password: userData.password
    }));

    // Szerverlista frissítése indítás előtt
    updateServerList();

    // Minecraft indítása
    let opts = {
        authorization: Authenticator.getAuth(userData.username),
        root: minecraftPath,
        version: {
            number: "1.21",
            type: "release"
        },
        memory: {
            max: "3G",
            min: "1G"
        }
    };

    launcher.launch(opts);

    launcher.on('progress', (e) => {
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', e);
        }
    });

    launcher.on('close', () => {
        console.log("Játék bezárva.");
    });
});

ipcMain.on('close-app', () => app.quit());
ipcMain.on('minimize-app', () => mainWindow.minimize());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});