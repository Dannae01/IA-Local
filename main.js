const {
    app,
    BrowserWindow,
    screen,
    ipcMain,
    dialog,
    Tray,
    Menu
} = require('electron');

const path = require('path');

const migrations = require('./src/database/migrations');

const {
    registerMemoryHandlers
} = require('./src/ipc/memoryHandlers');

const {
    registerDocumentHandlers
} = require('./src/ipc/documentHandlers');

const {
    registerConversationHandlers
} = require('./src/ipc/conversationHandlers');

const {
    registerSettingsHandlers
} = require('./src/ipc/settingsHandlers');

const {
    registerChatHandlers
} = require('./src/ipc/chatHandlers');

const {
    registerWindowHandlers
} = require('./src/ipc/windowHandlers');

const {
    registerAttachmentHandlers
} = require('./src/ipc/attachmentHandlers');

let mainWindow;
let tray;
let isQuitting = false;


function getBubblePosition() {
    const display =
        screen.getPrimaryDisplay();

    const workArea =
        display.workArea;

    const width = 24;
    const height = 24;
    const margin = 16;

    return {
        x:
            workArea.x +
            workArea.width -
            width -
            margin,

        y:
            workArea.y +
            workArea.height -
            height -
            margin
    };
}


function getChatPosition() {
    const display =
        screen.getPrimaryDisplay();

    const workArea =
        display.workArea;

    const width = 400;
    const height = 600;
    const margin = 20;

    return {
        x:
            workArea.x +
            workArea.width -
            width -
            margin,

        y:
            workArea.y +
            workArea.height -
            height -
            margin
    };
}


function createWindow() {

    const position =
        getBubblePosition();

    mainWindow =
        new BrowserWindow({
            width: 24,
            height: 24,

            x:
                position.x,

            y:
                position.y,

            frame: false,
            transparent: true,
            resizable: false,
            alwaysOnTop: true,

            /*
             * Evita que NOVA aparezca
             * en la barra de tareas.
             */
            skipTaskbar: true,

            webPreferences: {
                preload:
                    path.join(
                        __dirname,
                        'preload.js'
                    ),

                contextIsolation: true,
                nodeIntegration: false
            }
        });


    mainWindow.loadFile(
        path.join(
            __dirname,
            'renderer',
            'index.html'
        )
    );

    mainWindow.on(
        'close',
        (event) => {

            if (!isQuitting) {
                event.preventDefault();

                mainWindow.hide();
            }
        }
    );
}


function showNova() {
    if (!mainWindow) {
        createWindow();
    }

    mainWindow.show();
    mainWindow.focus();
}


function hideNova() {
    if (mainWindow) {
        mainWindow.hide();
    }
}


function toggleNova() {
    if (!mainWindow) {
        showNova();
        return;
    }

    if (
        mainWindow.isVisible()
    ) {
        hideNova();
    } else {
        showNova();
    }
}


function createTray() {

    const trayIcon =
        path.join(
            __dirname,
            'assets',
            'icons',
            'settings.png'
        );


    tray =
        new Tray(
            trayIcon
        );


    const contextMenu =
        Menu.buildFromTemplate([
            {
                label:
                    'Abrir NOVA',

                click: () => {
                    showNova();
                }
            },

            {
                label:
                    'Ocultar NOVA',

                click: () => {
                    hideNova();
                }
            },

            {
                type:
                    'separator'
            },

            {
                label:
                    'Salir',

                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);


    tray.setToolTip(
        'NOVA'
    );


    tray.setContextMenu(
        contextMenu
    );

    tray.on(
        'click',
        () => {
            toggleNova();
        }
    );
}


app.whenReady().then(() => {

    migrations
        .initializeDatabase();


    registerConversationHandlers(
        ipcMain
    );


    registerSettingsHandlers(
        ipcMain
    );


    registerMemoryHandlers(
        ipcMain
    );


    registerDocumentHandlers(
        ipcMain,
        dialog,
        () => mainWindow
    );


    registerAttachmentHandlers(
        ipcMain,
        dialog,
        () => mainWindow
    );


    registerChatHandlers(
        ipcMain
    );


    registerWindowHandlers(
        ipcMain,
        () => mainWindow,
        getBubblePosition,
        getChatPosition
    );


    createWindow();

    createTray();


    app.on(
        'activate',
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {
                createWindow();
            }

            showNova();
        }
    );
});


app.on(
    'before-quit',
    () => {
        isQuitting = true;
    }
);


app.on(
    'window-all-closed',
    () => {

    }
);