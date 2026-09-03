const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');
const migrations = require('./src/database/migrations');
const conversations = require('./src/database/repositories/conversations');
const session = require('./src/database/repositories/session');
const messages = require('./src/database/repositories/messages');

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

        let conversationId = session.getCurrentConversation();

        if (!conversationId) {

            conversationId = conversations.createConversation(
                message.slice(0, 40)
            );

            session.setCurrentConversation(conversationId);

            console.log(
                'Nueva conversación creada:',
                conversationId
            );

        }

        messages.createMessage(
            conversationId,
            'user',
            message
        );

        conversations.updateConversationTimestamp(conversationId);

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
            currentAbortController.signal,
            conversationId
        );

        messages.createMessage(
            conversationId,
            'assistant',
            response
        );

        conversations.updateConversationTimestamp(conversationId);

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

ipcMain.handle('nova-new-conversation', () => {

    const conversationId =
        conversations.createConversation(
            'Nueva conversación'
        );

    session.setCurrentConversation(conversationId);

    console.log(
        'Nueva conversación creada:',
        conversationId
    );

    return {
        success: true,
        conversationId
    };
});

/* Obtener conversaciones */
ipcMain.handle('nova-get-conversations', () => {

    return conversations.getAllConversations();

});

/* Obtener mensajes de una conversación */
ipcMain.handle('nova-get-messages', (event, conversationId) => {

    return messages.getMessages(conversationId);

});

/* Seleccionar conversación actual */
ipcMain.handle('nova-select-conversation', (event, conversationId) => {

    session.setCurrentConversation(conversationId);

    console.log(
        'Conversación seleccionada:',
        conversationId
    );

    return {
        success: true
    };

});

/* Eliminar conversación */
ipcMain.handle('nova-delete-conversation', (event, conversationId) => {

    conversations.deleteConversation(conversationId);

    if (
        session.getCurrentConversation() === conversationId
    ) {
        session.clearCurrentConversation();
    }

    console.log(
        'Conversación eliminada:',
        conversationId
    );

    return {
        success: true
    };

});

/* Renombrar conversación */
ipcMain.handle('nova-rename-conversation', (event, conversationId, title) => {

    conversations.renameConversation(
        conversationId,
        title
    );

    console.log(
        'Conversación renombrada:',
        conversationId,
        title
    );

    return {
        success: true
    };

});

ipcMain.on('nova-stop', () => {

    if (currentAbortController) {

        currentAbortController.abort();

        currentAbortController = null;

        console.log('Generación detenida.');

    }

});

app.whenReady().then(() => {

    migrations.initializeDatabase();

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