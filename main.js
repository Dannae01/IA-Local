const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');

let mainWindow;
let currentAbortController = null;

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


/* Abrir NOVA */

ipcMain.on('nova-open', () => {

    const position = getChatPosition();

    mainWindow.setBounds({
        x: position.x,
        y: position.y,
        width: 400,
        height: 600
    });

});


/* Cerrar NOVA */

ipcMain.on('nova-close', () => {

    const position = getBubblePosition();

    mainWindow.setBounds({
        x: position.x,
        y: position.y,
        width: 24,
        height: 24
    });

});

ipcMain.handle('nova-message', async (event, message) => {

    try {

        const model = 'qwen2.5:14b';

        currentAbortController = new AbortController();

        const streamId = Date.now().toString();

        const response = await novaCore.processMessage(
            message,
            model,
            (chunk) => {

                event.sender.send('nova-stream', {
                    id: streamId,
                    chunk: chunk
                });

            },
            currentAbortController.signal
        );

        currentAbortController = null;

        return {
            success: true,
            response,
            id: streamId
        };

    } catch (error) {

        currentAbortController = null;

        if (error.name === 'AbortError') {

            return {
                success: false,
                stopped: true
            };

        }

        console.error('Error de NOVA:', error);

        return {
            success: false,
            error: error.message
        };

    }

});

ipcMain.on('nova-stop', () => {

    if (currentAbortController) {

        currentAbortController.abort();

        currentAbortController = null;

        console.log('Generación detenida.');

    }

});

app.whenReady().then(() => {

    createWindow();

    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }

    });

});


app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {
        app.quit();
    }

});