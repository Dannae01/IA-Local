const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');

const novaCore = require('./src/core/app');
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

const memoriesRepository =
    require('./src/database/repositories/memories');

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

            const conversationId =
                ensureCurrentConversation('Nueva conversación');

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

            conversationDocumentsRepository
                .addDocumentToConversation(
                    conversationId,
                    documentId
                );

            console.log(
                'DOCUMENTO ASOCIADO A CONVERSACIÓN:',
                conversationId,
                documentId
            );

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
                conversationId,
                document: {
                    id: documentId,
                    name: document.name,
                    extension: document.extension,
                    characters: document.characters,
                    chunks: chunks.length
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

ipcMain.on('nova-stop', () => {
    if (currentAbortController) {
        currentAbortController.abort();

        console.log('Cancelación solicitada.');
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

// ================================
// MEMORIAS DE NOVA
// ================================

ipcMain.handle(
    'nova-create-memory',
    async (event, memory) => {

        try {

            const id =
                memoriesRepository.createMemory(
                    memory.type,
                    memory.content,
                    memory.source ?? null,
                    memory.importance ?? 1
                );

            return {
                success: true,
                id
            };

        } catch (error) {

            console.error(
                'ERROR AL CREAR MEMORIA:',
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
    'nova-get-memories',
    async () => {

        try {

            const memories =
                memoriesRepository.getAllMemories();

            return {
                success: true,
                memories
            };

        } catch (error) {

            console.error(
                'ERROR AL OBTENER MEMORIAS:',
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
    'nova-search-memories',
    async (event, query) => {

        try {

            const memories =
                memoriesRepository.searchMemories(
                    query
                );

            return {
                success: true,
                memories
            };

        } catch (error) {

            console.error(
                'ERROR AL BUSCAR MEMORIAS:',
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
    'nova-update-memory',
    async (event, memory) => {

        try {

            const result =
                memoriesRepository.updateMemory(
                    memory.id,
                    memory.content,
                    memory.type ?? null,
                    memory.source ?? null,
                    memory.importance ?? null
                );

            return result;

        } catch (error) {

            console.error(
                'ERROR AL ACTUALIZAR MEMORIA:',
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
    'nova-delete-memory',
    async (event, memoryId) => {

        try {

            const result =
                memoriesRepository.deleteMemory(
                    memoryId
                );

            return {
                success: true,
                deleted: result.changes > 0
            };

        } catch (error) {

            console.error(
                'ERROR AL ELIMINAR MEMORIA:',
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

    registerConversationHandlers(
        ipcMain
    );

    registerSettingsHandlers(
        ipcMain
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