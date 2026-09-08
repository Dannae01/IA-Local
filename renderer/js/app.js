console.log("NOVA iniciada");
console.log("APP.JS NUEVO CARGADO");
const bubble = document.getElementById("bubble");
const chatWindow = document.getElementById("chat-window");
const closeButton = document.getElementById("close-button");
const input = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messages = document.getElementById("chat-messages");

const conversationDocuments =
    document.getElementById(
        "conversation-documents"
    );

const importDocumentButton =
    document.getElementById(
        "import-document-button"
    );

const newChatButton = document.getElementById("new-chat-button");
const conversationButton =
    document.getElementById("conversation-button");

const conversationPanel =
    document.getElementById("conversation-panel");

const conversationList =
    document.getElementById("conversation-list");

const conversationNewButton =
    document.getElementById("conversation-new-button");

const settingsButton =
    document.getElementById("settings-button");

const settingsPanel =
    document.getElementById("settings-panel");

const closeSettings =
    document.getElementById("close-settings");

const renameDialog =
    document.getElementById("rename-dialog");

const deleteDialog =
    document.getElementById("delete-dialog");

const deleteCancelButton =
    document.getElementById("delete-cancel-button");

const deleteConfirmButton =
    document.getElementById("delete-confirm-button");

const renameInput =
    document.getElementById("rename-input");

const renameCancelButton =
    document.getElementById(
        "rename-cancel-button"
    );

const renameConfirmButton =
    document.getElementById(
        "rename-confirm-button"
    );

const pendingAttachmentsContainer =
    document.getElementById(
        'pending-attachments'
    );

let selectedConversationForAction = null;

let currentConversationId = null;

let isImporting = false;

let isChangingConversation = false;

let documentLoadVersion = 0;
let conversationListVersion = 0;
let pendingAttachments = [];

async function prepareCurrentConversation(title) {
    const result = await window.nova.ensureConversation(title);

    if (!result?.success || !result.conversationId) {
        throw new Error(
            result?.error || 'No se pudo preparar la conversación.'
        );
    }

    currentConversationId = result.conversationId;

    return currentConversationId;
}

async function loadConversationDocuments() {
    const requestVersion = ++documentLoadVersion;
    const conversationId = currentConversationId;

    conversationDocuments.innerHTML = '';

    if (!conversationId) {
        return;
    }

    try {
        const documents = await window.nova.getConversationDocuments(
            conversationId
        );

        if (
            requestVersion !== documentLoadVersion ||
            conversationId !== currentConversationId
        ) {
            return;
        }

        console.log(
            "DOCUMENTOS DE LA CONVERSACIÓN:",
            documents
        );

        if (!documents || documents.length === 0) {
            return;
        }

        documents.forEach((doc) => {

            const documentItem =
                document.createElement("div");

            documentItem.classList.add(
                "conversation-document"
            );

            const documentName =
                document.createElement("span");

            documentName.textContent =
                doc.name;

            const removeButton =
                document.createElement("button");

            removeButton.textContent = "×";

            removeButton.classList.add(
                "conversation-document-remove"
            );

            removeButton.title =
                "Quitar documento de la conversación";

            removeButton.addEventListener(
                "click",
                async () => {

                    const confirmed = confirm(
                        `¿Eliminar "${doc.name}" de NOVA?\n\n`
                    );

                    if (!confirmed) {
                        return;
                    }

                    const result =
                        await window.nova
                            .deleteDocument(
                                doc.id
                            );

                    if (result.success) {

                        await loadConversationDocuments();

                    } else {

                        console.error(
                            "ERROR AL ELIMINAR DOCUMENTO DE NOVA:",
                            result.error
                        );

                        alert(
                            "No se pudo eliminar el documento de NOVA."
                        );
                    }

                }
            );

            documentItem.appendChild(
                documentName
            );

            documentItem.appendChild(
                removeButton
            );

            conversationDocuments.appendChild(
                documentItem
            );

        });

    } catch (error) {

        console.error(
            "ERROR AL CARGAR DOCUMENTOS DE LA CONVERSACIÓN:",
            error
        );

    }
}

function renderPendingAttachments() {
    pendingAttachmentsContainer.innerHTML = '';

    pendingAttachments.forEach(
        (attachment, index) => {

            if (
                attachment.type !== 'image'
            ) {
                return;
            }

            const item =
                document.createElement('div');

            item.className =
                'pending-attachment';

            const img =
                document.createElement('img');

            img.src =
                attachment.dataUrl;

            img.alt =
                attachment.name ||
                'Imagen adjunta';

            const removeButton =
                document.createElement('button');

            removeButton.className =
                'pending-attachment-remove';

            removeButton.textContent =
                '×';

            removeButton.title =
                'Quitar imagen';

            removeButton.addEventListener(
                'click',
                async () => {

                    const attachment =
                        pendingAttachments[
                            index
                        ];

                    if (attachment?.token) {
                        await window.nova
                            .discardPendingAttachment(
                                attachment.token
                            );
                    }

                    pendingAttachments.splice(
                        index,
                        1
                    );

                    renderPendingAttachments();
                }
            );

            item.appendChild(img);
            item.appendChild(removeButton);

            pendingAttachmentsContainer
                .appendChild(item);
        }
    );
}

/* Abrir NOVA */

bubble.addEventListener("click", () => {

    console.log("NOVA presionada");

    bubble.style.display = "none";
    chatWindow.style.display = "flex";

    window.nova.open();

    input.focus();

});


/* Cerrar NOVA */

closeButton.addEventListener("click", () => {

    settingsPanel.classList.add("hidden");

    chatWindow.style.display = "none";
    bubble.style.display = "flex";

    window.nova.close();
});


/* Enviar mensaje */

let isGenerating = false;

async function sendMessage() {
    if (
        isGenerating ||
        isImporting ||
        isChangingConversation
    ) {
        return;
    }

    const text =
        input.value.trim();

    if (
        text === '' &&
        pendingAttachments.length === 0
    ) {
        return;
    }

    const attachmentsToSend =
        pendingAttachments.map(
            (attachment) => ({
                type:
                    attachment.type,
                token:
                    attachment.token
            })
        );

    const attachmentsForMessage =
        pendingAttachments.map(
            (attachment) => ({
                ...attachment
            })
        );

    isGenerating = true;

    let acceptingChunks = true;
    let streamedContent = '';
    let renderTimer = null;

    try {

        const userMessage =
            document.createElement(
                'div'
            );

        userMessage.classList.add(
            'message',
            'user-message'
        );

        if (text) {
            const textElement =
                document.createElement(
                    'div'
                );

            textElement.textContent =
                text;

            userMessage.appendChild(
                textElement
            );
        }

        for (
            const attachment
            of attachmentsForMessage
        ) {
            if (
                attachment.type ===
                'image'
            ) {
                window
                    .novaResponseRenderer
                    .renderImage(
                        userMessage,
                        attachment
                    );
            }
        }

        messages.appendChild(
            userMessage
        );

        input.value = '';

        pendingAttachments = [];

        renderPendingAttachments();

        const novaMessage =
            document.createElement(
                'div'
            );

        novaMessage.classList.add(
            'message',
            'nova-message'
        );

        messages.appendChild(
            novaMessage
        );

        sendButton.textContent = '…';

        sendButton.classList.add(
            'stop-button'
        );

        sendButton.disabled = true;


        messages.scrollTop =
            messages.scrollHeight;

        window.nova.onStream(
            (data) => {

                if (!acceptingChunks) {
                    return;
                }

                streamedContent +=
                    data.chunk;

                if (renderTimer) {
                    return;
                }

                renderTimer =
                    setTimeout(
                        () => {

                            renderTimer =
                                null;

                            window
                                .novaResponseRenderer
                                .renderAssistantMessage(
                                    novaMessage,
                                    streamedContent
                                );

                            messages.scrollTop =
                                messages.scrollHeight;

                        },
                        80
                    );
            }
        );

        await prepareCurrentConversation(
            text ||
            'Imagen adjunta'
        );

        await loadConversationDocuments();

        sendButton.textContent = '■';

        sendButton.disabled = false;

        const result =
            await window.nova
                .sendMessage(
                    text,
                    attachmentsToSend
                );

        if (
            result.success ||
            result.stopped
        ) {
            window
                .novaResponseRenderer
                .renderAssistantMessage(
                    novaMessage,
                    result.response
                );

        } else {

            novaMessage.textContent =
                result.error ||
                'No se pudo procesar el mensaje.';
        }

    } catch (error) {

        console.error(
            'ERROR AL ENVIAR MENSAJE:',
            error
        );

        const novaMessages =
            messages.querySelectorAll(
                '.nova-message'
            );

        const lastNovaMessage =
            novaMessages[
                novaMessages.length - 1
            ];

        if (lastNovaMessage) {
            lastNovaMessage.textContent =
                'Ocurrió un error al procesar el mensaje.';
        }

    } finally {

        if (renderTimer) {
            clearTimeout(
                renderTimer
            );

            renderTimer = null;
        }

        acceptingChunks = false;

        isGenerating = false;

        sendButton.textContent = '↑';

        sendButton.classList.remove(
            'stop-button'
        );

        sendButton.disabled = false;

        messages.scrollTop =
            messages.scrollHeight;

        input.focus();
    }
}

/* Botón enviar / detener */

sendButton.addEventListener('click', () => {
    if (isGenerating) {
        sendButton.disabled = true;
        sendButton.textContent = '…';

        window.nova.stop();
        return;
    }

    sendMessage();
});

/* Enter para enviar */

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        sendMessage();
    }
});

/* Nueva conversación */
async function createNewConversation() {
    if (isGenerating || isImporting || isChangingConversation) {
        return;
    }

    isChangingConversation = true;

    try {
        const result = await window.nova.newConversation();

        if (!result?.success || !result.conversationId) {
            throw new Error(
                result?.error || 'No se pudo crear la conversación.'
            );
        }

        currentConversationId = result.conversationId;
        messages.innerHTML = '';
        input.value = '';
        pendingAttachments = [];
        renderPendingAttachments();

        const notice = document.createElement('div');
        notice.classList.add('message', 'nova-message');
        notice.textContent =
            'Nueva conversación iniciada. ¿En qué puedo ayudarte?';

        messages.appendChild(notice);

        await loadConversationDocuments();
        await loadConversations();

        conversationPanel.classList.remove('conversation-panel-open');
        input.focus();
    } catch (error) {
        console.error('ERROR AL CREAR CONVERSACIÓN:', error);
        alert(error.message);
    } finally {
        isChangingConversation = false;
    }
}

/* Botón + de la barra superior */
newChatButton.addEventListener(
    "click",
    createNewConversation
);


/* Botón + Nueva conversación del panel */
conversationNewButton.addEventListener(
    "click",
    createNewConversation
);

/* Panel de conversaciones */

async function openConversation(
    conversationId
) {
    if (
        isGenerating ||
        isImporting ||
        isChangingConversation
    ) {
        return;
    }

    isChangingConversation = true;

    try {

        const history =
            await window.nova
                .getMessages(
                    conversationId
                );

        if (
            !Array.isArray(
                history
            )
        ) {
            throw new Error(
                'No se pudo cargar el historial.'
            );
        }


        const result =
            await window.nova
                .selectConversation(
                    conversationId
                );

        if (!result?.success) {
            throw new Error(
                result?.error ||
                'No se pudo seleccionar la conversación.'
            );
        }


        currentConversationId =
            conversationId;

        messages.innerHTML = '';

        input.value = '';

        pendingAttachments = [];

        renderPendingAttachments();


        /*
         * =========================
         * HISTORIAL
         * =========================
         */

        for (
            const message
            of history
        ) {

            const element =
                document.createElement(
                    'div'
                );

            element.classList.add(
                'message',
                message.role === 'user'
                    ? 'user-message'
                    : 'nova-message'
            );


            /*
             * TEXTO
             */
            if (
                message.role ===
                'user'
            ) {

                if (message.content) {

                    const textElement =
                        document.createElement(
                            'div'
                        );

                    textElement.textContent =
                        message.content;

                    element.appendChild(
                        textElement
                    );
                }

            } else {

                window
                    .novaResponseRenderer
                    .renderAssistantMessage(
                        element,
                        message.content
                    );
            }


            /*
             * ADJUNTOS
             */
            if (
                Array.isArray(
                    message.attachments
                )
            ) {

                for (
                    const attachment
                    of message.attachments
                ) {

                    if (
                        attachment.type ===
                        'image'
                    ) {

                        window
                            .novaResponseRenderer
                            .renderImage(
                                element,
                                attachment
                            );
                    }
                }
            }


            messages.appendChild(
                element
            );
        }


        await loadConversationDocuments();


        conversationPanel
            .classList
            .remove(
                'conversation-panel-open'
            );


        messages.scrollTop =
            messages.scrollHeight;

        input.focus();

    } catch (error) {

        console.error(
            'ERROR AL CARGAR CONVERSACIÓN:',
            error
        );

        alert(
            error.message
        );

    } finally {

        isChangingConversation =
            false;
    }
}

async function loadConversations() {
    const requestVersion = ++conversationListVersion;

    try {
        const conversations = await window.nova.getConversations();

        if (requestVersion !== conversationListVersion) {
            return;
        }

        console.log(
            "CONVERSACIONES RECIBIDAS:",
            conversations
        );

        conversationList.innerHTML = "";

        conversations.forEach((conversation) => {

            const item =
                document.createElement("div");

            item.classList.add(
                "conversation-item"
            );

            const title =
                document.createElement("button");

            title.classList.add(
                "conversation-title"
            );

            title.textContent =
                conversation.title;

            title.addEventListener('click', () => {
                openConversation(conversation.id);
            });

            const menuButton =
                document.createElement("button");

            menuButton.classList.add(
                "conversation-rename-button"
            );

            menuButton.textContent = "⋮";

            const menu =
                document.createElement("div");

            menu.classList.add(
                "conversation-menu"
            );

            const renameOption =
                document.createElement("button");

            renameOption.textContent = "Renombrar";

            renameOption.addEventListener(
                "click",
                () => {

                    menu.classList.remove(
                        "conversation-menu-open"
                    );

                    selectedConversationForAction = conversation;

                    renameInput.value =
                        conversation.title;

                    renameDialog.classList.add(
                        "rename-dialog-open"
                    );

                    renameInput.focus();

                    renameInput.select();
                }
            );

            const deleteOption =
                document.createElement("button");

            deleteOption.textContent = "Eliminar";

            deleteOption.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    menu.classList.remove(
                        "conversation-menu-open"
                    );

                    selectedConversationForAction = conversation;

                    deleteDialog.classList.add(
                        "delete-dialog-open"
                    );
                }
            );

            menu.appendChild(renameOption);
            menu.appendChild(deleteOption);

            menuButton.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    document
                        .querySelectorAll(".conversation-menu")
                        .forEach((otherMenu) => {

                            if (otherMenu !== menu) {
                                otherMenu.classList.remove(
                                    "conversation-menu-open"
                                );
                            }

                        });

                    menu.classList.toggle(
                        "conversation-menu-open"
                    );

                }
            );

            item.appendChild(title);
            item.appendChild(menuButton);
            item.appendChild(menu);
            conversationList.appendChild(item);

        });

    } catch (error) {

        console.error(
            "ERROR AL CARGAR CONVERSACIONES:",
            error
        );

    }

}

/* Renombrar conversación */

renameCancelButton.addEventListener(
    "click",
    () => {

        renameDialog.classList.remove(
            "rename-dialog-open"
        );

        selectedConversationForAction = null;

    }
);


renameConfirmButton.addEventListener(
    "click",
    async () => {

        if (!selectedConversationForAction) {
            return;
        }

        const newTitle =
            renameInput.value.trim();

        if (newTitle === "") {
            return;
        }

        try {

            const result =
                await window.nova.renameConversation(
                    selectedConversationForAction.id,
                    newTitle
                );

            if (result.success) {

                renameDialog.classList.remove(
                    "rename-dialog-open"
                );

                selectedConversationForAction = null;

                await loadConversations();

            }

        } catch (error) {

            console.error(
                "ERROR AL RENOMBRAR:",
                error
            );

        }

    }
);

renameInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            renameConfirmButton.click();
        }

        if (event.key === "Escape") {
            renameCancelButton.click();
        }

    }
);

/* Eliminar conversación */

deleteCancelButton.addEventListener(
    "click",
    () => {

        deleteDialog.classList.remove(
            "delete-dialog-open"
        );

        selectedConversationForAction = null;
    }
);

deleteConfirmButton.addEventListener('click', async () => {
    if (isGenerating || isImporting || isChangingConversation) {
        return;
    }

    if (!selectedConversationForAction) {
        return;
    }

    const conversationIdToDelete = selectedConversationForAction.id;

    isChangingConversation = true;
    deleteConfirmButton.disabled = true;
    deleteCancelButton.disabled = true;

    try {
        const result = await window.nova.deleteConversation(
            conversationIdToDelete
        );

        if (!result?.success) {
            throw new Error(
                result?.error || 'No se pudo eliminar la conversación.'
            );
        }

        // Limpiar la pantalla solo si eliminamos el chat abierto.
        if (currentConversationId === conversationIdToDelete) {
            currentConversationId = null;
            messages.innerHTML = '';
            input.value = '';

            pendingAttachments = [];
            renderPendingAttachments();

            await loadConversationDocuments();

            const notice = document.createElement('div');

            notice.classList.add('message', 'nova-message');
            notice.textContent =
                'Conversación eliminada. Puedes iniciar una nueva.';

            messages.appendChild(notice);
        }

        deleteDialog.classList.remove('delete-dialog-open');
        selectedConversationForAction = null;

        await loadConversations();
    } catch (error) {
        console.error('ERROR AL ELIMINAR CONVERSACIÓN:', error);
        alert(error.message);
    } finally {
        isChangingConversation = false;
        deleteConfirmButton.disabled = false;
        deleteCancelButton.disabled = false;
    }
});

/* Abrir / cerrar panel */

conversationButton.addEventListener(
    "click",
    async () => {

        console.log("EL BOTÓN DE CONVERSACIONES FUNCIONA");

        conversationPanel.classList.toggle(
            "conversation-panel-open"
        );

        if (
            conversationPanel.classList.contains(
                "conversation-panel-open"
            )
        ) {

            await loadConversations();

        }

    }
);

// =============================
// CONFIGURACIÓN
// =============================

settingsButton.addEventListener('click', () => {

    settingsPanel.classList.remove('hidden');

});

closeSettings.addEventListener('click', () => {

    settingsPanel.classList.add('hidden');

});

// =============================
// CARGAR MODELOS DE OLLAMA
// =============================

async function loadModels() {

    const modelSelect = document.getElementById('model-select');

    try {

        const models = await window.nova.getModels();

        modelSelect.innerHTML = '';

        if (!models || models.length === 0) {

            const option = document.createElement('option');

            option.value = '';
            option.textContent = 'No hay modelos instalados';

            modelSelect.appendChild(option);

            return;
        }

        models.forEach((model) => {

            const option = document.createElement('option');

            option.value = model.name;
            option.textContent = model.name;

            modelSelect.appendChild(option);

        });

    } catch (error) {

        console.error(
            'ERROR AL CARGAR MODELOS:',
            error
        );

        modelSelect.innerHTML = '';

        const option = document.createElement('option');

        option.value = '';
        option.textContent = 'Error al cargar modelos';

        modelSelect.appendChild(option);

    }

}

async function loadSelectedModel() {

    const modelSelect = document.getElementById('model-select');

    try {

        const selectedModel =
            await window.nova.getSelectedModel();

        if (selectedModel) {
            modelSelect.value = selectedModel;
        }

    } catch (error) {

        console.error(
            'ERROR AL CARGAR MODELO SELECCIONADO:',
            error
        );

    }

}

document.getElementById('model-select').addEventListener(
    'change',
    async (event) => {

        const model = event.target.value;

        if (!model) return;

        const saved =
            await window.nova.setModel(model);

        if (saved) {
            console.log(
                'MODELO SELECCIONADO:',
                model
            );
        }

    }
);

// =============================
// TEMPERATURA
// =============================

const temperature = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');

temperature.addEventListener('input', () => {

    temperatureValue.textContent = temperature.value;

});

const contextSize =
    document.getElementById('context-size');


async function loadContextSize() {

    try {

        const value =
            await window.nova.getContextSize();

        if (
            value !== null &&
            value !== undefined
        ) {
            contextSize.value = value;
        }

    } catch (error) {

        console.error(
            'ERROR AL CARGAR TAMAÑO DE CONTEXTO:',
            error
        );

    }

}


contextSize.addEventListener('change', async () => {

    console.log(
        'TAMAÑO DE CONTEXTO CAMBIADO:',
        contextSize.value
    );

    const saved =
        await window.nova.setContextSize(
            contextSize.value
        );

    console.log(
        'TAMAÑO DE CONTEXTO GUARDADO:',
        saved
    );

});

async function loadTemperature() {

    try {

        const value = await window.nova.getTemperature();

        if (value !== null && value !== undefined) {

            temperature.value = value;
            temperatureValue.textContent = value;

        }

    } catch (error) {

        console.error(
            'ERROR AL CARGAR TEMPERATURA:',
            error
        );

    }

}

temperature.addEventListener('change', async () => {

    console.log(
        'TEMPERATURA CAMBIADA:',
        temperature.value
    );

    const saved = await window.nova.setTemperature(
        temperature.value
    );

    console.log(
        'TEMPERATURA GUARDADA:',
        saved
    );

});

// =============================
// CARGAR CONFIGURACIÓN INICIAL
// =============================

loadModels().then(() => {

    loadSelectedModel();
    loadTemperature();
    loadContextSize();

});

// =============================
// IMPORTAR DOCUMENTOS
// =============================

importDocumentButton.addEventListener(
    'click',
    async () => {

        if (
            isGenerating ||
            isImporting ||
            isChangingConversation
        ) {
            return;
        }

        isImporting = true;

        importDocumentButton.disabled =
            true;

        sendButton.disabled =
            true;

        try {
            const result =
                await window.nova
                    .importAttachment();

            if (result.canceled) {
                return;
            }

            if (!result.success) {
                throw new Error(
                    result.error ||
                    'No se pudo adjuntar el archivo.'
                );
            }

            if (
                result.type ===
                'document'
            ) {
                currentConversationId =
                    result.conversationId;

                await loadConversationDocuments();
                await loadConversations();

                return;
            }

            if (
                result.type === 'image'
            ) {
                pendingAttachments = [
                    {
                        type: 'image',
                        token: result.image.token,
                        id: result.image.id,
                        name: result.image.name,
                        mimeType: result.image.mimeType,
                        dataUrl: result.image.dataUrl
                    }
                ];

                renderPendingAttachments();

                input.focus();

                return;
            }

        } catch (error) {
            console.error(
                'ERROR AL ADJUNTAR ARCHIVO:',
                error
            );

            alert(error.message);

        } finally {
            isImporting = false;

            importDocumentButton.disabled =
                false;

            sendButton.disabled =
                false;
        }
    }
);


// Progreso de importación

window.nova.onDocumentProgress(
    (data) => {

        console.log(
            "PROGRESO DOCUMENTO:",
            data
        );



    }
);

