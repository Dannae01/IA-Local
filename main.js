const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');

const migrations = require('./src/database/migrations');

const {
    registerMemoryHandlers
} = require('./src/ipc/memoryHandlers');

const {
    registerDocumentHandlers
} = require('./src/ipc/documentHandlers');

let mainWindow;

const {
    registerConversationHandlers
} = require('./src/ipc/conversationHandlers');

const {
    registerSettingsHandlers
} = require('./src/ipc/settingsHandlers');

const {
    registerChatHandlers
} = require('./src/ipc/chatHandlers');

const {
    registerWindowHandlers
} = require('./src/ipc/windowHandlers');

function getBubblePosition() {
    const display = screen.getPrimaryDisplay();
    const workArea = display.workArea;

    const width = 24;
    const height = 24;
    const margin = 16;

    return {
        x: workArea.x + workArea.width - width - margin,
        y: workArea.y + workArea.height - height - margin
    };
}

function getChatPosition() {
    const display = screen.getPrimaryDisplay();
    const workArea = display.workArea;

    const width = 400;
    const height = 600;
    const margin = 20;

    return {
        x: workArea.x + workArea.width - width - margin,
        y: workArea.y + workArea.height - height - margin
    };
}

function createWindow() {

    const position = getBubblePosition();

    mainWindow = new BrowserWindow({
        width: 24,
        height: 24,

        x: position.x,
        y: position.y,

        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(
        path.join(__dirname, 'renderer', 'index.html')
    );
}

app.whenReady().then(() => {

    migrations.initializeDatabase();

    registerConversationHandlers(
        ipcMain
    );

    registerSettingsHandlers(
        ipcMain
    );

    registerMemoryHandlers(
        ipcMain
    );

    registerDocumentHandlers(
        ipcMain,
        dialog,
        () => mainWindow
    );

    registerChatHandlers(
        ipcMain
    );

    registerWindowHandlers(
        ipcMain,
        () => mainWindow,
        getBubblePosition,
        getChatPosition
    );

    createWindow();

    app.on('activate', () => {

        if (
            BrowserWindow
                .getAllWindows()
                .length === 0
        ) {
            createWindow();
        }

    });

});


app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {
        app.quit();
    }

});