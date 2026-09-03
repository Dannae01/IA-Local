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

    onStream: (callback) => {

        ipcRenderer.removeAllListeners('nova-stream');

        ipcRenderer.on('nova-stream', (event, chunk) => {

            callback(chunk);

        });

    }

});