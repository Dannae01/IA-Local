const OLLAMA_URL = 'http://localhost:11434';

async function checkConnection() {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function getModels() {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);

    if (!response.ok) {
        throw new Error('No se pudieron obtener los modelos de Ollama.');
    }

    const data = await response.json();
    return data.models || [];
}

async function chat(
    model,
    messages,
    onChunk,
    signal,
    temperature,
    contextSize
) {
    console.log('PETICIÓN A OLLAMA:', {
        model,
        temperature,
        contextSize,
        messageCount: messages.length,
        hasImages: messages.some(
            (message) =>
                Array.isArray(message.images) &&
                message.images.length > 0
        )
    });

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: {
                temperature,
                num_ctx: contextSize
            }
        }),

        signal

    });

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `Ollama respondió con un error: ${errorText}`
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = '';

    let buffer = '';

    function processLine(line) {
        if (!line.trim()) {
            return;
        }

        const data = JSON.parse(line);

        if (data.error) {
            throw new Error(
                `Ollama respondió con un error: ${data.error}`
            );
        }

        const content = data.message?.content || '';

        if (content) {
            fullResponse += content;

            if (onChunk) {
                onChunk(content);
            }
        }
    }

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            // Conservar el texto incompleto entre lecturas.
            buffer += decoder.decode(value, { stream: true });

            let newlineIndex;

            // Procesar únicamente las líneas completas.
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                processLine(line);
            }
        }

        // Procesar la última línea aunque no tenga salto de línea.
        buffer += decoder.decode();
        processLine(buffer);
    } finally {
        reader.releaseLock();
    }

    return fullResponse;
}


module.exports = {
    checkConnection,
    getModels,
    chat
};