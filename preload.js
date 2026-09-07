const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nova', {

    version: '0.1.0',

    open: () => {
        ipcRenderer.send('nova-open');
    },

    close: () => {
        ipcRenderer.send('nova-close');
    },

    stop: () => {
        ipcRenderer.send('nova-stop');
    },

    newConversation: () => {
        return ipcRenderer.invoke('nova-new-conversation');
    },

    ensureConversation: (title) => {
        return ipcRenderer.invoke('nova-ensure-conversation', title);
    },

    getConversationDocuments: (conversationId) =>
        ipcRenderer.invoke(
            'nova-get-conversation-documents',
            conversationId
        ),

    removeDocumentFromConversation: (
        conversationId,
        documentId
    ) =>
        ipcRenderer.invoke(
            'nova-remove-document-from-conversation',
            {
                conversationId,
                documentId
            }
        ),

    deleteDocument: (documentId) =>
        ipcRenderer.invoke(
            'nova-delete-document',
            documentId
        ),

    // ================================
    // MEMORIAS DE NOVA
    // ================================

    createMemory: (memory) =>
        ipcRenderer.invoke(
            'nova-create-memory',
            memory
        ),

    getMemories: () =>
        ipcRenderer.invoke(
            'nova-get-memories'
        ),

    searchMemories: (query) =>
        ipcRenderer.invoke(
            'nova-search-memories',
            query
        ),

    updateMemory: (memory) =>
        ipcRenderer.invoke(
            'nova-update-memory',
            memory
        ),

    deleteMemory: (memoryId) =>
        ipcRenderer.invoke(
            'nova-delete-memory',
            memoryId
        ),

    getConversations: () => {
        return ipcRenderer.invoke('nova-get-conversations');
    },

    getMessages: (conversationId) => {
        return ipcRenderer.invoke(
            'nova-get-messages',
            conversationId
        );
    },    

    selectConversation: (conversationId) => {
        return ipcRenderer.invoke(
            'nova-select-conversation',
            conversationId
        );
    },    

    deleteConversation: (conversationId) => {
        return ipcRenderer.invoke(
            'nova-delete-conversation',
            conversationId
        );
    },

    renameConversation: (conversationId, title) => {
        return ipcRenderer.invoke(
            'nova-rename-conversation',
            conversationId,
            title
        );
    },

    sendMessage: (message) => {
        return ipcRenderer.invoke('nova-message', message);
    },

    getModels: () => {
        return ipcRenderer.invoke('nova-get-models');
    },

    setModel: (model) => {
        return ipcRenderer.invoke(
            'nova-set-model',
            model
        );
    },

    getSelectedModel: () => {
        return ipcRenderer.invoke(
            'nova-get-selected-model'
        );
    },

    getTemperature: () => {
        return ipcRenderer.invoke(
            'nova-get-temperature'
        );
    },

    setTemperature: (value) => {
        return ipcRenderer.invoke(
            'nova-set-temperature',
            value
        );
    },

    getContextSize: () => {
        return ipcRenderer.invoke(
            'nova-get-context-size'
        );
    },

    setContextSize: (value) => {
        return ipcRenderer.invoke(
            'nova-set-context-size',
            value
        );
    },

    importDocument: () => {
        return ipcRenderer.invoke(
            'nova-import-document'
        );
    },

    importAttachment: () => {
        return ipcRenderer.invoke(
            'nova-import-attachment'
        );
    },

    getConversationDocuments: (conversationId) =>
        ipcRenderer.invoke(
            'nova-get-conversation-documents',
            conversationId
        ),

    removeDocumentFromConversation: (
        conversationId,
        documentId
    ) =>
        ipcRenderer.invoke(
            'nova-remove-document-from-conversation',
            {
                conversationId,
                documentId
            }
        ),

    onDocumentProgress: (callback) => {

        ipcRenderer.removeAllListeners(
            'nova-document-progress'
        );

        ipcRenderer.on(
            'nova-document-progress',
            (event, data) => {
                callback(data);
            }
        );
    },

    onStream: (callback) => {

        ipcRenderer.removeAllListeners('nova-stream');

        ipcRenderer.on('nova-stream', (event, chunk) => {

            callback(chunk);

        });

    }

});