const OLLAMA_URL = 'http://localhost:11434';

async function checkConnection() {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);

        if (!response.ok) {
            return false;
        }

        return true;

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


async function chat(model, messages, onChunk, signal, temperature, contextSize) {

    console.log('TEMPERATURA ENVIADA A OLLAMA:', temperature);

    console.log(
        'PARÁMETROS ENVIADOS A OLLAMA:',
        {
            temperature,
            contextSize
        }
    );

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

    while (true) {

        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        const chunk = decoder.decode(value, {
            stream: true
        });

        const lines = chunk
            .split('\n')
            .filter(line => line.trim() !== '');

        for (const line of lines) {

            const data = JSON.parse(line);

            const content = data.message?.content || '';

            if (content) {

                fullResponse += content;

                if (onChunk) {
                    onChunk(content);
                }

            }
        }
    }

    return fullResponse;
}


module.exports = {
    checkConnection,
    getModels,
    chat
};