const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const axios = require('axios');
const { autoUpdater } = require("electron-updater");
const launcher = new Client();

let mainWindow;

// --- SZERVER BEÁLLÍTÁSOK (Itt írd át, ha változik) ---
const SERVER_NAME = "SkynetCraft";
const SERVER_IP = "145.236.106.186:25565";
const SECRET_KEY = "-Dskynet.secret.key=SkynetForceJoin2026";
// ----------------------------------------------------

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400, height: 550,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        },
        resizable: false, 
        frame: false, 
        transparent: true, 
        autoHideMenuBar: true
    });
    mainWindow.loadFile('index.html');
}

ipcMain.on('close-app', () => { app.quit(); });
ipcMain.on('minimize-app', () => { mainWindow.minimize(); });

const profilePath = path.join(app.getPath('userData'), 'profile.json');
ipcMain.handle('get-profile', () => {
    if (fs.existsSync(profilePath)) return JSON.parse(fs.readFileSync(profilePath));
    return null;
});

ipcMain.on('save-profile', (event, data) => {
    fs.writeFileSync(profilePath, JSON.stringify(data));
});

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdatesAndNotify(); 
});

ipcMain.on('launch-game', async (event, data) => {
    const { username, password } = data;
    try {
        const response = await axios.post(`http://s-net.mygamesonline.org/auth.php`, new URLSearchParams({
            username: username, password: password
        }));
        const responseData = response.data.trim();
        if (responseData.startsWith("OK:")) {
            const finalUsername = responseData.split(":")[1];
            launchMinecraft(finalUsername, event);
        } else {
            event.reply('auth-error', responseData.replace("ERROR:", ""));
        }
    } catch (e) { 
        event.reply('auth-error', "Szerver hiba vagy nincs internet!"); 
    }
});

function launchMinecraft(username, event) {
    const minecraftPath = path.join(app.getPath('userData'), '.minecraft');
    if (!fs.existsSync(minecraftPath)) fs.mkdirSync(minecraftPath, { recursive: true });

    // --- AUTOMATIKUS SZERVER LISTA GENERÁLÁS ---
    const serversPath = path.join(minecraftPath, 'servers.dat');
    if (!fs.existsSync(serversPath)) {
        // NBT formátumú puffer összeállítása a megadott névvel és IP-vel
        const nameBuf = Buffer.from(SERVER_NAME, 'utf8');
        const ipBuf = Buffer.from(SERVER_IP, 'utf8');
        
        const serverData = Buffer.concat([
            Buffer.from([0x0a, 0x00, 0x00, 0x09, 0x00, 0x07, 0x73, 0x65, 0x72, 0x76, 0x65, 0x72, 0x73, 0x0a, 0x00, 0x00, 0x08, 0x00, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x00]),
            Buffer.from([nameBuf.length]), nameBuf,
            Buffer.from([0x08, 0x00, 0x02, 0x69, 0x70, 0x00]),
            Buffer.from([ipBuf.length]), ipBuf,
            Buffer.from([0x00, 0x00])
        ]);
        
        try { fs.writeFileSync(serversPath, serverData); } catch (err) {}
    }

    let opts = {
        authorization: Authenticator.getAuth(username),
        root: minecraftPath,
        version: { number: "1.21", type: "release" },
        memory: { max: "4G", min: "2G" },
        detached: true, 
        inheritOutputs: false,
        // Ha azt akarod, hogy egyből be is lépjen:
        // quickPlay: { type: "multiplayer", identifier: SERVER_IP },
        jvmArgs: [SECRET_KEY],
        customArgs: [SECRET_KEY],
        extraArgs: [SECRET_KEY]
    };

    launcher.launch(opts);
    launcher.on('progress', (e) => event.reply('launch-progress', e));
    launcher.on('data', (data) => {
        if (data.includes('Setting user:')) setTimeout(() => { app.quit(); }, 5000);
    });
    launcher.on('close', () => app.quit());
}