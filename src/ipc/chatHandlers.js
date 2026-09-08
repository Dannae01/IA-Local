const fs = require('fs');

const attachmentsRepository =
    require('../database/repositories/attachments');

const {
    storeAttachment
} = require('./attachmentStorage');

const {
    consumeAttachment
} = require('./pendingAttachments');

const novaCore =
    require('../core/app');

const conversations =
    require('../database/repositories/conversations');

const messages =
    require('../database/repositories/messages');

const settings =
    require('../database/repositories/settings');

const {
    ensureCurrentConversation
} = require('./conversationState');

function registerChatHandlers(
    ipcMain
) {
    let currentAbortController = null;

    ipcMain.handle(
        'nova-message',
        async (event, payload) => {

            const message =
                typeof payload === 'string'
                    ? payload
                    : payload?.message;

            const requestedAttachments =
                Array.isArray(
                    payload?.attachments
                )
                    ? payload.attachments
                    : [];

            if (currentAbortController) {
                return {
                    success: false,
                    busy: true,
                    error:
                        'Espera a que termine la generación actual.'
                };
            }

            if (
                (
                    typeof message !== 'string' ||
                    !message.trim()
                ) &&
                requestedAttachments.length === 0
            ) {
                return {
                    success: false,
                    error:
                        'El mensaje está vacío.'
                };
            }

            const controller =
                new AbortController();

            currentAbortController =
                controller;

            let conversationId = null;
            let userMessageSaved = false;
            let partialResponse = '';

            const streamId =
                Date.now().toString();

            try {

            const selectedModel =
                settings.getSetting(
                    'selected_model'
                ) ||
                'qwen2.5:14b';

                const temperature =
                    parseFloat(
                        settings.getSetting(
                            'temperature'
                        ) ||
                        '0.7'
                    );

                const contextSize =
                    parseInt(
                        settings.getSetting(
                            'context_size'
                        ) ||
                        '8192',
                        10
                    );

                conversationId =
                    ensureCurrentConversation(
                        message?.trim() ||
                        'Imagen adjunta'
                    );

                const userMessageId =
                    messages.createMessage(
                        conversationId,
                        'user',
                        message
                    );

                userMessageSaved = true;

                const visionImages = [];

                for (
                    const requestedAttachment
                    of requestedAttachments
                ) {
                    if (
                        requestedAttachment.type !==
                        'image' ||
                        !requestedAttachment.token
                    ) {
                        continue;
                    }

                    const pendingAttachment =
                        consumeAttachment(
                            requestedAttachment.token
                        );

                    if (!pendingAttachment) {
                        continue;
                    }

                    const storedPath =
                        storeAttachment(
                            pendingAttachment.filePath,
                            conversationId
                        );

                    attachmentsRepository
                        .createAttachment(
                            userMessageId,
                            conversationId,
                            'image',
                            pendingAttachment.name,
                            storedPath,
                            pendingAttachment.mimeType
                        );

                    if (
                        pendingAttachment.temporary
                    ) {
                        try {
                            if (
                                fs.existsSync(
                                    pendingAttachment.filePath
                                )
                            ) {
                                fs.unlinkSync(
                                    pendingAttachment.filePath
                                );
                            }

                        } catch (error) {

                            console.error(
                                'ERROR AL LIMPIAR IMAGEN TEMPORAL:',
                                error
                            );
                        }
                    }

                    const buffer =
                        fs.readFileSync(
                            storedPath
                        );

                    visionImages.push(
                        buffer.toString(
                            'base64'
                        )
                    );
                }

                const model =
                    visionImages.length > 0
                        ? 'qwen3-vl:8b'
                        : selectedModel;

                const response =
                    await novaCore.processMessage(
                        message,
                        model,
                        (chunk) => {

                            if (
                                controller
                                    .signal
                                    .aborted
                            ) {
                                return;
                            }

                            partialResponse +=
                                chunk;

                            if (
                                !event.sender
                                    .isDestroyed()
                            ) {
                                event.sender.send(
                                    'nova-stream',
                                    {
                                        id:
                                            streamId,
                                        chunk
                                    }
                                );
                            }
                        },
                        controller.signal,
                        conversationId,
                        temperature,
                        contextSize,
                        visionImages
                    );

                controller
                    .signal
                    .throwIfAborted();

                messages.createMessage(
                    conversationId,
                    'assistant',
                    response
                );

                conversations
                    .updateConversationTimestamp(
                        conversationId
                    );

                return {
                    success: true,
                    response,
                    id: streamId,
                    conversationId
                };

            } catch (error) {

                if (
                    controller.signal.aborted ||
                    error.name ===
                        'AbortError'
                ) {

                    const stoppedResponse =
                        partialResponse +
                        '\n\n[Generación detenida por el usuario; esta solicitud fue cancelada.]';

                    try {

                        if (userMessageSaved) {

                            messages
                                .createMessage(
                                    conversationId,
                                    'assistant',
                                    stoppedResponse
                                );

                            conversations
                                .updateConversationTimestamp(
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
                            error:
                                'La generación se detuvo, pero no se pudo guardar la respuesta parcial.'
                        };
                    }

                    return {
                        success: false,
                        stopped: true,
                        response:
                            stoppedResponse,
                        id: streamId,
                        conversationId
                    };
                }

                console.error(
                    'Error de NOVA:',
                    error
                );

                return {
                    success: false,
                    error: error.message
                };

            } finally {

                if (
                    currentAbortController ===
                    controller
                ) {
                    currentAbortController =
                        null;
                }
            }
        }
    );


    ipcMain.on(
        'nova-stop',
        () => {

            if (
                currentAbortController
            ) {
                currentAbortController
                    .abort();

                console.log(
                    'Cancelación solicitada.'
                );
            }
        }
    );
}

module.exports = {
    registerChatHandlers
};
