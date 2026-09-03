console.log("NOVA iniciada");

const bubble = document.getElementById("bubble");
const chatWindow = document.getElementById("chat-window");
const closeButton = document.getElementById("close-button");
const input = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messages = document.getElementById("chat-messages");

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

let selectedConversationForAction = null;

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

async function sendMessage() {

    const text = input.value.trim();

    if (text === "") {
        return;
    }

    // Mostrar mensaje del usuario
    const userMessage = document.createElement("div");

    userMessage.classList.add("message");
    userMessage.textContent = text;

    messages.appendChild(userMessage);

    input.value = "";

    messages.scrollTop = messages.scrollHeight;


    // Crear mensaje de NOVA
    const novaMessage = document.createElement("div");

    novaMessage.classList.add(
        "message",
        "nova-message"
    );

    novaMessage.textContent = "";

    messages.appendChild(novaMessage);

    messages.scrollTop = messages.scrollHeight;


    // Cambiar botón a "Detener"
    sendButton.textContent = "■";
    sendButton.classList.add("stop-button");


    // Recibir streaming de NOVA
    window.nova.onStream((data) => {

        novaMessage.textContent += data.chunk;

        messages.scrollTop = messages.scrollHeight;

    });


    try {

        const result = await window.nova.sendMessage(text);

        if (!result.success) {

            if (result.stopped) {

                novaMessage.textContent +=
                    "\n\n[Generación detenida]";

            } else {

                novaMessage.textContent =
                    "No pude conectarme con Ollama.\n\n" +
                    result.error;

            }

        }

    } catch (error) {

        novaMessage.textContent =
            "Ocurrió un error al procesar el mensaje.";

        console.error(error);

    }


    // Restaurar botón
    sendButton.textContent = "↑";
    sendButton.classList.remove("stop-button");

    messages.scrollTop = messages.scrollHeight;
}

/* Botón enviar */

sendButton.addEventListener("click", () => {

    if (sendButton.classList.contains("stop-button")) {

        window.nova.stop();

        return;

    }

    sendMessage();

});


/* Enter para enviar */

input.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        sendMessage();
    }

});

/* Nueva conversación */
async function createNewConversation() {

    try {

        const result =
            await window.nova.newConversation();

        if (!result.success) {

            console.error(
                "No se pudo crear la conversación."
            );

            return;

        }

        messages.innerHTML = "";

        const novaMessage =
            document.createElement("div");

        novaMessage.classList.add(
            "message",
            "nova-message"
        );

        novaMessage.innerHTML =
            "Nueva conversación iniciada.<br>" +
            "¿En qué puedo ayudarte?";

        messages.appendChild(
            novaMessage
        );

        input.value = "";
        input.focus();

        // Actualizar la lista de conversaciones
        await loadConversations();

        // Cerrar el panel
        conversationPanel.classList.remove(
            "conversation-panel-open"
        );

    } catch (error) {

        console.error(
            "ERROR AL CREAR CONVERSACIÓN:",
            error
        );

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

async function loadConversations() {

    try {

        const conversations =
            await window.nova.getConversations();

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

            title.addEventListener(
                "click",
                async () => {

                    try {

                        await window.nova.selectConversation(
                            conversation.id
                        );

                        const selectedConversation =
                            await window.nova.getMessages(
                                conversation.id
                            );

                        messages.innerHTML = "";

                        selectedConversation.forEach(
                            (message) => {

                                const messageElement =
                                    document.createElement("div");

                                messageElement.classList.add(
                                    "message"
                                );

                                if (
                                    message.role === "user"
                                ) {

                                    messageElement.classList.add(
                                        "user-message"
                                    );

                                } else {

                                    messageElement.classList.add(
                                        "nova-message"
                                    );

                                }

                                messageElement.textContent =
                                    message.content;

                                messages.appendChild(
                                    messageElement
                                );

                            }
                        );

                        conversationPanel.classList.remove(
                            "conversation-panel-open"
                        );

                        messages.scrollTop =
                            messages.scrollHeight;

                        input.focus();

                    } catch (error) {

                        console.error(
                            "ERROR AL CARGAR CONVERSACIÓN:",
                            error
                        );

                    }

                }
            );

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

deleteConfirmButton.addEventListener(
    "click",
    async () => {

        if (!selectedConversationForAction) {
            return;
        }

        try {

            const result =
                await window.nova.deleteConversation(
                    selectedConversationForAction.id
                );

            if (result.success) {

                messages.innerHTML = "";

                deleteDialog.classList.remove(
                    "delete-dialog-open"
                );

                selectedConversationForAction = null;

                await loadConversations();
            }

        } catch (error) {

            console.error(
                "ERROR AL ELIMINAR:",
                error
            );

        }

    }
);

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