const conversations =
    require('../database/repositories/conversations');

const session =
    require('../database/repositories/session');

const messages =
    require('../database/repositories/messages');

const {
    ensureCurrentConversation
} = require('./conversationState');

function registerConversationHandlers(
    ipcMain
) {

    ipcMain.handle(
        'nova-ensure-conversation',
        (event, title) => {

            try {

                return {
                    success: true,
                    conversationId:
                        ensureCurrentConversation(
                            title
                        )
                };

            } catch (error) {

                console.error(
                    'Error al preparar la conversación:',
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
        'nova-new-conversation',
        () => {

            const conversationId =
                conversations.createConversation(
                    'Nueva conversación'
                );

            session.setCurrentConversation(
                conversationId
            );

            console.log(
                'Nueva conversación creada:',
                conversationId
            );

            return {
                success: true,
                conversationId
            };
        }
    );


    ipcMain.handle(
        'nova-get-conversations',
        () => {

            return conversations
                .getAllConversations();

        }
    );


    ipcMain.handle(
        'nova-get-messages',
        (event, conversationId) => {

            return messages.getMessages(
                conversationId
            );

        }
    );


    ipcMain.handle(
        'nova-select-conversation',
        (event, conversationId) => {

            if (
                !conversations.getConversation(
                    conversationId
                )
            ) {
                return {
                    success: false,
                    error:
                        'La conversación ya no existe.'
                };
            }

            session.setCurrentConversation(
                conversationId
            );

            console.log(
                'Conversación seleccionada:',
                conversationId
            );

            return {
                success: true
            };
        }
    );


    ipcMain.handle(
        'nova-delete-conversation',
        (event, conversationId) => {

            conversations.deleteConversation(
                conversationId
            );

            if (
                session.getCurrentConversation() ===
                conversationId
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
        }
    );


    ipcMain.handle(
        'nova-rename-conversation',
        (event, conversationId, title) => {

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
        }
    );
}

module.exports = {
    registerConversationHandlers
};