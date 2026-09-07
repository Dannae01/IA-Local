const path = require('path');
const fs = require('fs');

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

const messagesRepository =
    require('../database/repositories/messages');

const attachmentsRepository =
    require('../database/repositories/attachments');

const {
    storeAttachment
} = require('./attachmentStorage');

const IMAGE_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
};

const DOCUMENT_TYPES = new Set([
    '.txt',
    '.md',
    '.csv',
    '.pdf',
    '.docx',
    '.pptx',
    '.xlsx'
]);

function registerAttachmentHandlers(
    ipcMain,
    dialog,
    getMainWindow
) {
    ipcMain.handle(
        'nova-import-attachment',
        async (event) => {
            try {
                const result =
                    await dialog.showOpenDialog(
                        getMainWindow(),
                        {
                            title:
                                'Adjuntar archivo',

                            properties: [
                                'openFile'
                            ],

                            filters: [
                                {
                                    name:
                                        'Archivos compatibles',
                                    extensions: [
                                        'png',
                                        'jpg',
                                        'jpeg',
                                        'webp',
                                        'gif',
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

                const extension =
                    path.extname(filePath)
                        .toLowerCase();

                if (IMAGE_TYPES[extension]) {
                    const conversationId =
                        ensureCurrentConversation(
                            'Nueva conversación'
                        );

                    const mimeType =
                        IMAGE_TYPES[extension];

                    const storedPath =
                        storeAttachment(
                            filePath,
                            conversationId
                        );

                    const messageId =
                        messagesRepository
                            .createMessage(
                                conversationId,
                                'user',
                                ''
                            );

                    const attachmentId =
                        attachmentsRepository
                            .createAttachment(
                                messageId,
                                conversationId,
                                'image',
                                path.basename(filePath),
                                storedPath,
                                mimeType
                            );

                    const buffer =
                        fs.readFileSync(
                            storedPath
                        );

                    const dataUrl =
                        `data:${mimeType};base64,${buffer.toString('base64')}`;

                    return {
                        success: true,
                        type: 'image',
                        conversationId,
                        messageId,

                        image: {
                            id: attachmentId,
                            name:
                                path.basename(
                                    filePath
                                ),
                            mimeType,
                            dataUrl
                        }
                    };
                }

                if (
                    DOCUMENT_TYPES.has(
                        extension
                    )
                ) {
                    const conversationId =
                        ensureCurrentConversation(
                            'Nueva conversación'
                        );

                    event.sender.send(
                        'nova-document-progress',
                        {
                            stage:
                                'processing',
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
                            stage:
                                'embedding',

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
                                stage:
                                    'embedding',

                                message:
                                    `Generando embeddings (${i + 1}/${chunks.length})...`
                            }
                        );
                    }

                    event.sender.send(
                        'nova-document-progress',
                        {
                            stage:
                                'complete',
                            message:
                                'Documento listo.'
                        }
                    );

                    return {
                        success: true,
                        type: 'document',
                        conversationId,

                        document: {
                            id:
                                documentId,
                            name:
                                document.name,
                            extension:
                                document.extension,
                            characters:
                                document.characters,
                            chunks:
                                chunks.length
                        }
                    };
                }

                return {
                    success: false,
                    error:
                        'Tipo de archivo no compatible.'
                };

            } catch (error) {
                console.error(
                    'ERROR AL ADJUNTAR ARCHIVO:',
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
    registerAttachmentHandlers
};