const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mclc = require('minecraft-launcher-core');
const { Client } = require('minecraft-launcher-core');
const { autoUpdater } = require("electron-updater"); // Frissítés modul

const launcher = new Client();

// GRAFIKAI JAVÍTÁS: Hardveres gyorsítás kikapcsolása a fekete csíkok ellen
app.disableHardwareAcceleration();

let mainWindow;
const dbPath = path.join(process.cwd(), 'users.json');

// Jelszó titkosítása
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Felhasználók kezelése
function getUsers() {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, JSON.stringify({}));
            return {};
        }
        return JSON.parse(fs.readFileSync(dbPath));
    } catch (err) {
        return {};
    }
}

function saveUser(username, password) {
    const users = getUsers();
    users[username] = password;
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 350,
        height: 500,
        frame: false,
        transparent: true,
        resizable: false,
        hasShadow: false,
        thickFrame: false,
        icon: path.join(__dirname, 'icon.ico.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');

    // FRISSÍTÉS ELLENŐRZÉSE INDÍTÁSKOR
    mainWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
}

// Auto-updater visszajelzések (opcionális logolás)
autoUpdater.on('update-available', () => {
    console.log('Frissítés elérhető!');
});

autoUpdater.on('update-downloaded', () => {
    console.log('Frissítés letöltve, telepítés újraindításkor.');
});

app.whenReady().then(createWindow);

// --- KOMMUNIKÁCIÓ ---

ipcMain.on('register-user', (event, data) => {
    const users = getUsers();
    if (users[data.user]) {
        event.reply('auth-error', 'Ez a név foglalt!');
        return;
    }
    saveUser(data.user, hashPassword(data.pass));
    event.reply('auth-success', 'Sikeres regisztráció!');
});

ipcMain.on('launch-game', (event, data) => {
    const users = getUsers();
    const hashedInputPass = hashPassword(data.pass);

    if (!users[data.user] || users[data.user] !== hashedInputPass) {
        event.reply('auth-error', 'Hibás adatok!');
        return;
    }

    const rootPath = path.join(process.cwd(), 'minecraft_data');
    
    const auth = {
        access_token: "null",
        client_token: "null",
        uuid: "12345678-1234-1234-1234-1234567890ab",
        name: data.user,
        user_properties: "{}"
    };

    let opts = {
        authorization: auth,
        root: rootPath,
        version: { number: "1.20.1", type: "release" },
        memory: { max: "2G", min: "1G" }
    };

    launcher.on('progress', (e) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('progress', e);
        }
    });

    launcher.launch(opts);
    launcher.on('launch', () => { app.quit(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });