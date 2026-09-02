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


async function chat(model, messages) {

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            model,
            messages,
            stream: false
        })

    });

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `Ollama respondió con un error: ${errorText}`
        );
    }

    const data = await response.json();

    return data.message?.content || '';
}


module.exports = {
    checkConnection,
    getModels,
    chat
};