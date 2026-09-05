const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');
const ollama = require('./src/ai/ollama');
const migrations = require('./src/database/migrations');
const conversations = require('./src/database/repositories/conversations');
const session = require('./src/database/repositories/session');
const messages = require('./src/database/repositories/messages');
const settings = require('./src/database/repositories/settings');

const {
    processDocument
} = require('./src/rag/documentManager');

const {
    chunkText
} = require('./src/rag/chunker');

const {
    generateEmbedding
} = require('./src/rag/embeddings');

const documentsRepository =
    require('./src/database/repositories/documents');

const conversationDocumentsRepository =
    require('./src/database/repositories/conversationDocuments');

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

/* Importar documento */

ipcMain.handle(
    'nova-import-document',
    async (event) => {

        console.log('IPC IMPORTAR DOCUMENTO RECIBIDO');

        try {

            const result =
                await dialog.showOpenDialog(
                    mainWindow,
                    {
                        title: 'Seleccionar documento',
                        properties: [
                            'openFile'
                        ],
                        filters: [
                            {
                                name: 'Documentos compatibles',
                                extensions: [
                                    'txt',
                                    'md',
                                    'csv',
                                    'pdf',
                                    'docx',
                                    'pptx',
                                    'xlsx'
                                ]
                            }
                        ]
                    }
                );

            if (
                result.canceled ||
                result.filePaths.length === 0
            ) {
                return {
                    success: false,
                    canceled: true
                };
            }

            const filePath = result.filePaths[0];

            console.log(
                'ARCHIVO SELECCIONADO:',
                filePath
            );

            event.sender.send(
                'nova-document-progress',
                {
                    stage: 'processing',
                    message:
                        'Procesando documento...'
                }
            );

            console.log('INICIANDO PROCESAMIENTO DEL DOCUMENTO');

            const document =
                await processDocument(filePath);

            console.log(
                'DOCUMENTO PROCESADO:',
                document.name,
                document.characters
            );


            // Comprobar si ya existe
            const existingDocument =
                documentsRepository
                    .getDocumentByPath(
                        filePath
                    );

            if (existingDocument) {

                documentsRepository
                    .deleteDocument(
                        existingDocument.id
                    );
            }


            // Crear documento
            const documentId =
                documentsRepository
                    .createDocument(
                        document
                    );

            const currentConversationId =
                session.getCurrentConversation();

            if (currentConversationId) {

                conversationDocumentsRepository
                    .addDocumentToConversation(
                        currentConversationId,
                        documentId
                    );

                console.log(
                    'DOCUMENTO ASOCIADO A CONVERSACIÓN:',
                    currentConversationId,
                    documentId
                );
            }

            // Crear chunks
            const chunks =
                chunkText(
                    document.text,
                    4000,
                    500
                );

            console.log(
                'CHUNKS GENERADOS:',
                chunks.length
            );


            event.sender.send(
                'nova-document-progress',
                {
                    stage: 'embedding',
                    message:
                        `Generando embeddings (0/${chunks.length})...`
                }
            );


            // Generar embeddings
            for (
                let i = 0;
                i < chunks.length;
                i++
            ) {

                console.log(
                    `GENERANDO EMBEDDING ${i + 1}/${chunks.length}`
                );

                const embedding =
                    await generateEmbedding(
                        chunks[i]
                    );

                console.log(
                    `EMBEDDING GENERADO ${i + 1}/${chunks.length}`
                );

                documentsRepository
                    .createChunk(
                        documentId,
                        i,
                        chunks[i],
                        embedding
                    );

                console.log(
                    `CHUNK GUARDADO EN SQLITE: ${i + 1}/${chunks.length}`
                );

                event.sender.send(
                    'nova-document-progress',
                    {
                        stage: 'embedding',
                        message:
                            `Generando embeddings (${i + 1}/${chunks.length})...`
                    }
                );
            }

            console.log(
                'DOCUMENTO COMPLETAMENTE INDEXADO'
            );

            event.sender.send(
                'nova-document-progress',
                {
                    stage: 'complete',
                    message:
                        'Documento listo.'
                }
            );


            return {
                success: true,

                document: {
                    id: documentId,
                    name: document.name,
                    extension:
                        document.extension,
                    characters:
                        document.characters,
                    chunks:
                        chunks.length
                }
            };


        } catch (error) {

            console.error(
                'ERROR AL IMPORTAR DOCUMENTO:',
                error
            );

            event.sender.send(
                'nova-document-progress',
                {
                    stage: 'error',
                    message:
                        error.message
                }
            );

            return {
                success: false,
                error: error.message
            };
        }
    }
);

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

ipcMain.handle(
    'nova-get-conversation-documents',
    async (event, conversationId) => {
        try {
            if (!conversationId) {
                return [];
            }

            const documents =
                conversationDocumentsRepository
                    .getDocumentsByConversationId(
                        conversationId
                    );

            return documents;
        } catch (error) {
            console.error(
                'ERROR AL OBTENER DOCUMENTOS DE LA CONVERSACIÓN:',
                error
            );

            throw error;
        }
    }
);

ipcMain.handle(
    'nova-remove-document-from-conversation',
    async (event, data) => {
        try {
            const {
                conversationId,
                documentId
            } = data;

            if (!conversationId || !documentId) {
                throw new Error(
                    'conversationId y documentId son obligatorios.'
                );
            }

            const result =
                conversationDocumentsRepository
                    .removeDocumentFromConversation(
                        conversationId,
                        documentId
                    );

            console.log(
                'DOCUMENTO QUITADO DE LA CONVERSACIÓN:',
                conversationId,
                documentId
            );

            return {
                success: true,
                changes: result.changes
            };
        } catch (error) {
            console.error(
                'ERROR AL QUITAR DOCUMENTO:',
                error
            );

            return {
                success: false,
                error: error.message
            };
        }
    }
);

ipcMain.handle(
    'nova-delete-document',
    (event, documentId) => {

        try {

            const result =
                documentsRepository
                    .deleteDocumentCompletely(
                        documentId
                    );

            console.log(
                'DOCUMENTO ELIMINADO DE NOVA:',
                documentId
            );

            return {
                success: true,
                deleted: result.changes > 0
            };

        } catch (error) {

            console.error(
                'ERROR AL ELIMINAR DOCUMENTO DE NOVA:',
                error
            );

            return {
                success: false,
                error: error.message
            };
        }
    }
);

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