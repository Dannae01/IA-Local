function registerWindowHandlers(
    ipcMain,
    getMainWindow,
    getBubblePosition,
    getChatPosition
) {

    ipcMain.on(
        'nova-open',
        () => {

            const mainWindow =
                getMainWindow();

            const position =
                getChatPosition();

            mainWindow.setBounds({
                x: position.x,
                y: position.y,
                width: 400,
                height: 600
            });
        }
    );


    ipcMain.on(
        'nova-close',
        () => {

            const mainWindow =
                getMainWindow();

            const position =
                getBubblePosition();

            mainWindow.setBounds({
                x: position.x,
                y: position.y,
                width: 24,
                height: 24
            });
        }
    );
}

module.exports = {
    registerWindowHandlers
};