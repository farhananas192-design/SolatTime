const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const api = require("./api");

const prayerPage = pathToFileURL(path.join(__dirname, "index.html")).href;
const remindersPage = pathToFileURL(path.join(__dirname, "reminders.html")).href;

function prayerHandler(channel, handler) {
    ipcMain.handle(channel, (event, ...args) => {
        if (event.senderFrame?.url !== prayerPage) throw new Error("Invalid request origin.");
        return handler(...args);
    });
}

prayerHandler("solat:catalog", api.catalog);
prayerHandler("solat:cities", api.cities);
prayerHandler("solat:day", api.day);
prayerHandler("solat:timetable", api.timetable);

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 850,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
        if (url !== prayerPage && url !== remindersPage) event.preventDefault();
    });
    win.loadFile("index.html");
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
