const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');
const migrations = require('./src/database/migrations');
const conversations = require('./src/database/repositories/conversations');
const session = require('./src/database/repositories/session');
const messages = require('./src/database/repositories/messages');
const settings = require('./src/database/repositories/settings');

const {
    registerMemoryHandlers
} = require('./src/ipc/memoryHandlers');

const {
    registerDocumentHandlers
} = require('./src/ipc/documentHandlers');

let mainWindow;
let currentAbortController = null;

const {
    ensureCurrentConversation
} = require('./src/ipc/conversationState');

const {
    registerConversationHandlers
} = require('./src/ipc/conversationHandlers');

const {
    registerSettingsHandlers
} = require('./src/ipc/settingsHandlers');

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
    if (currentAbortController) {
        return {
            success: false,
            busy: true,
            error: 'Espera a que termine la generación actual.'
        };
    }

    if (typeof message !== 'string' || !message.trim()) {
        return {
            success: false,
            error: 'El mensaje está vacío.'
        };
    }

    const controller = new AbortController();
    currentAbortController = controller;

    let conversationId = null;
    let userMessageSaved = false;
    let partialResponse = '';

    const streamId = Date.now().toString();

    try {
        const model =
            settings.getSetting('selected_model') || 'qwen2.5:14b';

        const temperature = parseFloat(
            settings.getSetting('temperature') || '0.7'
        );

        const contextSize = parseInt(
            settings.getSetting('context_size') || '8192',
            10
        );

        conversationId = ensureCurrentConversation(message);

        messages.createMessage(conversationId, 'user', message);
        userMessageSaved = true;

        conversations.updateConversationTimestamp(conversationId);

        const response = await novaCore.processMessage(
            message,
            model,
            (chunk) => {
                if (controller.signal.aborted) {
                    return;
                }

                partialResponse += chunk;

                if (!event.sender.isDestroyed()) {
                    event.sender.send('nova-stream', {
                        id: streamId,
                        chunk
                    });
                }
            },
            controller.signal,
            conversationId,
            temperature,
            contextSize
        );

        controller.signal.throwIfAborted();

        messages.createMessage(
            conversationId,
            'assistant',
            response
        );

        conversations.updateConversationTimestamp(conversationId);

        return {
            success: true,
            response,
            id: streamId,
            conversationId
        };
    } catch (error) {
        if (controller.signal.aborted || error.name === 'AbortError') {
            const stoppedResponse = partialResponse +
                '\n\n[Generación detenida por el usuario; esta solicitud fue cancelada.]';

            try {
                if (userMessageSaved) {
                    messages.createMessage(
                        conversationId,
                        'assistant',
                        stoppedResponse
                    );

                    conversations.updateConversationTimestamp(
                        conversationId
                    );
                }
            } catch (saveError) {
                console.error(
                    'Error al guardar la respuesta interrumpida:',
                    saveError
                );

                return {
                    success: false,
                    error: 'La generación se detuvo, pero no se pudo guardar la respuesta parcial.'
                };
            }

            return {
                success: false,
                stopped: true,
                response: stoppedResponse,
                id: streamId,
                conversationId
            };
        }

        console.error('Error de NOVA:', error);

        return {
            success: false,
            error: error.message
        };
    } finally {
        if (currentAbortController === controller) {
            currentAbortController = null;
        }
    }
});

ipcMain.on('nova-stop', () => {
    if (currentAbortController) {
        currentAbortController.abort();

        console.log('Cancelación solicitada.');
    }
});

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