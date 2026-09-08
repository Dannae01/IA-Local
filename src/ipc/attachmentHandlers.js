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
    storeAttachment,
    deleteStoredAttachment
} = require('./attachmentStorage');

const {
    stageAttachment,
    discardAttachment
} = require('./pendingAttachments');

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
                    const mimeType =
                        IMAGE_TYPES[extension];

                    const buffer =
                        fs.readFileSync(
                            filePath
                        );

                    const token =
                        stageAttachment(
                            filePath,
                            path.basename(filePath),
                            mimeType
                        );

                    return {
                        success: true,
                        type: 'image',

                        image: {
                            token,
                            name:
                                path.basename(
                                    filePath
                                ),
                            mimeType,
                            dataUrl:
                                `data:${mimeType};base64,${buffer.toString('base64')}`
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

    ipcMain.handle(
        'nova-delete-attachment',
        async (event, attachmentId) => {
            try {
                const attachment =
                    attachmentsRepository
                        .getAttachmentById(
                            attachmentId
                        );

                if (!attachment) {
                    return {
                        success: false,
                        error:
                            'El adjunto no existe.'
                    };
                }

                deleteStoredAttachment(
                    attachment.path
                );

                const result =
                    attachmentsRepository
                        .deleteAttachment(
                            attachmentId
                        );

                return {
                    success: true,
                    deleted:
                        result.changes > 0
                };

            } catch (error) {
                console.error(
                    'ERROR AL ELIMINAR ADJUNTO:',
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
        'nova-discard-pending-attachment',
        (event, token) => {
            return {
                success:
                    discardAttachment(
                        token
                    )
            };
        }
    );

    ipcMain.handle(
        'nova-stage-clipboard-image',
        async (event, image) => {

            try {

                if (
                    !image ||
                    typeof image.dataUrl !==
                        'string'
                ) {
                    throw new Error(
                        'La imagen del portapapeles no es válida.'
                    );
                }


                const allowedMimeTypes =
                    new Set([
                        'image/png',
                        'image/jpeg',
                        'image/webp',
                        'image/gif'
                    ]);


                if (
                    !allowedMimeTypes.has(
                        image.mimeType
                    )
                ) {
                    throw new Error(
                        'El formato de imagen no está soportado.'
                    );
                }

                const match =
                    image.dataUrl.match(
                        /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/
                    );


                if (!match) {
                    throw new Error(
                        'El contenido de la imagen no es válido.'
                    );
                }


                const mimeType =
                    match[1];

                const buffer =
                    Buffer.from(
                        match[2],
                        'base64'
                    );

                const MAX_IMAGE_SIZE =
                    10 * 1024 * 1024;


                if (
                    buffer.length >
                    MAX_IMAGE_SIZE
                ) {
                    throw new Error(
                        'La imagen supera el límite de 10 MB.'
                    );
                }


                const extensionMap = {
                    'image/png':
                        '.png',

                    'image/jpeg':
                        '.jpg',

                    'image/webp':
                        '.webp',

                    'image/gif':
                        '.gif'
                };


                const extension =
                    extensionMap[
                        mimeType
                    ];

                const pendingDirectory =
                    path.join(
                        __dirname,
                        '../../data/pending'
                    );


                fs.mkdirSync(
                    pendingDirectory,
                    {
                        recursive: true
                    }
                );


                const fileName =
                    `clipboard-${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 8)}${extension}`;


                const temporaryPath =
                    path.join(
                        pendingDirectory,
                        fileName
                    );


                fs.writeFileSync(
                    temporaryPath,
                    buffer
                );


                const token =
                    stageAttachment(
                        temporaryPath,
                        image.name ||
                            fileName,
                        mimeType,
                        {
                            temporary: true
                        }
                    );


                return {
                    success: true,

                    image: {
                        token,

                        name:
                            image.name ||
                            fileName,

                        mimeType,

                        dataUrl:
                            image.dataUrl
                    }
                };

            } catch (error) {

                console.error(
                    'ERROR AL PREPARAR IMAGEN DEL PORTAPAPELES:',
                    error
                );


                return {
                    success: false,
                    error:
                        error.message
                };
            }
        }
    );

}

module.exports = {
    registerAttachmentHandlers
};