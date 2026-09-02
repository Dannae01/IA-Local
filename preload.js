const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nova', {

    version: '0.1.0',

    open: () => {
        ipcRenderer.send('nova-open');
    },

    close: () => {
        ipcRenderer.send('nova-close');
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