const {
    processDocument
} = require('../rag/documentManager');

const {
    chunkText
} = require('../rag/chunker');

const {
    generateEmbedding
} = require('../rag/embeddings');

const documentsRepository =
    require('../database/repositories/documents');

const conversationDocumentsRepository =
    require('../database/repositories/conversationDocuments');

const {
    ensureCurrentConversation
} = require('./conversationState');

function registerDocumentHandlers(
    ipcMain,
    dialog,
    getMainWindow
) {

    ipcMain.handle(
        'nova-import-document',
        async (event) => {

            console.log(
                'IPC IMPORTAR DOCUMENTO RECIBIDO'
            );

            try {

                const mainWindow =
                    getMainWindow();

                const result =
                    await dialog.showOpenDialog(
                        mainWindow,
                        {
                            title:
                                'Seleccionar documento',

                            properties: [
                                'openFile'
                            ],

                            filters: [
                                {
                                    name:
                                        'Documentos compatibles',

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

                const filePath =
                    result.filePaths[0];

                const conversationId =
                    ensureCurrentConversation(
                        'Nueva conversación'
                    );

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

                const document =
                    await processDocument(
                        filePath
                    );

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

                const chunks =
                    chunkText(
                        document.text,
                        4000,
                        500
                    );

                event.sender.send(
                    'nova-document-progress',
                    {
                        stage: 'embedding',
                        message:
                            `Generando embeddings (0/${chunks.length})...`
                    }
                );

                for (
                    let i = 0;
                    i < chunks.length;
                    i++
                ) {

                    const embedding =
                        await generateEmbedding(
                            chunks[i]
                        );

                    documentsRepository
                        .createChunk(
                            documentId,
                            i,
                            chunks[i],
                            embedding
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


    ipcMain.handle(
        'nova-get-conversation-documents',
        async (
            event,
            conversationId
        ) => {

            try {

                if (!conversationId) {
                    return [];
                }

                return conversationDocumentsRepository
                    .getDocumentsByConversationId(
                        conversationId
                    );

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

                if (
                    !conversationId ||
                    !documentId
                ) {
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

                return {
                    success: true,
                    changes:
                        result.changes
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

                return {
                    success: true,
                    deleted:
                        result.changes > 0
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
}

module.exports = {
    registerDocumentHandlers
};
