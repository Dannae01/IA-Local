const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');
const ollama = require('./src/ai/ollama');
const migrations = require('./src/database/migrations');
const conversations = require('./src/database/repositories/conversations');
const session = require('./src/database/repositories/session');
const messages = require('./src/database/repositories/messages');
const settings = require('./src/database/repositories/settings');


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

        const model =
            settings.getSetting('selected_model') ||
            'qwen2.5:14b';

        const temperature =
            parseFloat(
                settings.getSetting('temperature') || '0.7'
            );

        const contextSize =
            parseInt(
                settings.getSetting('context_size') || '8192',
                10
            );

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
            conversationId,
            temperature,
            contextSize
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

/* Obtener modelos de Ollama */
ipcMain.handle('nova-get-models', async () => {

    try {

        return await ollama.getModels();

    } catch (error) {

        console.error(
            'ERROR AL OBTENER MODELOS:',
            error
        );

        return [];

    }

});

ipcMain.handle('nova-set-model', async (event, model) => {

    try {

        settings.setSetting(
            'selected_model',
            model
        );

        return true;

    } catch (error) {

        console.error(
            'ERROR AL GUARDAR MODELO:',
            error
        );

        return false;
    }

});


ipcMain.handle('nova-get-selected-model', async () => {

    try {

        return (
            settings.getSetting('selected_model') ||
            'qwen2.5:14b'
        );

    } catch (error) {

        console.error(
            'ERROR AL OBTENER MODELO SELECCIONADO:',
            error
        );

        return 'qwen2.5:14b';
    }

});

ipcMain.handle('nova-set-temperature', async (event, value) => {

    try {

        const temperature = parseFloat(value);

        console.log('GUARDANDO TEMPERATURA:', temperature);

        if (isNaN(temperature)) {
            return false;
        }

        settings.setSetting(
            'temperature',
            temperature.toString()
        );

        return true;

    } catch (error) {

        console.error(
            'ERROR AL GUARDAR TEMPERATURA:',
            error
        );

        return false;
    }

});


ipcMain.handle('nova-get-temperature', async () => {

    try {

        const savedTemperature =
            settings.getSetting('temperature');

        console.log(
            'TEMPERATURA GUARDADA EN SQLITE:',
            savedTemperature
        );

        return savedTemperature || '0.7';

    } catch (error) {

        console.error(
            'ERROR AL OBTENER TEMPERATURA:',
            error
        );

        return '0.7';
    }

});

ipcMain.handle('nova-set-context-size', async (event, value) => {
    try {
        const contextSize = parseInt(value, 10);

        if (isNaN(contextSize)) {
            return false;
        }

        settings.setSetting(
            'context_size',
            contextSize.toString()
        );

        console.log(
            'TAMAÑO DE CONTEXTO GUARDADO:',
            contextSize
        );

        return true;

    } catch (error) {
        console.error(
            'ERROR AL GUARDAR TAMAÑO DE CONTEXTO:',
            error
        );

        return false;
    }
});


ipcMain.handle('nova-get-context-size', async () => {
    try {
        const savedContextSize =
            settings.getSetting('context_size');

        console.log(
            'TAMAÑO DE CONTEXTO GUARDADO EN SQLITE:',
            savedContextSize
        );

        return savedContextSize || '8192';

    } catch (error) {
        console.error(
            'ERROR AL CARGAR TAMAÑO DE CONTEXTO:',
            error
        );

        return '8192';
    }
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