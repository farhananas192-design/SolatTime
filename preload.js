const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("solat", {
    getCatalog: () => ipcRenderer.invoke("solat:catalog"),
    getCities: (country, state) => ipcRenderer.invoke("solat:cities", country, state),
    getDay: (selection, date) => ipcRenderer.invoke("solat:day", selection, date),
    getTimetable: (zone, period, number) => ipcRenderer.invoke("solat:timetable", zone, period, number)
});
