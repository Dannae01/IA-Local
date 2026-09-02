console.log("NOVA iniciada");

const bubble = document.getElementById("bubble");
const chatWindow = document.getElementById("chat-window");
const closeButton = document.getElementById("close-button");
const input = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messages = document.getElementById("chat-messages");


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