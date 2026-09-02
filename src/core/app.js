const ollama = require('../ai/ollama');

const SYSTEM_PROMPT = `
Eres NOVA, un asistente virtual de escritorio local.

Tu función es ayudar al usuario de forma clara, útil y natural.

Responde directamente a lo que el usuario necesita.

Actualmente estás funcionando de forma local mediante Ollama.
`;

async function processMessage(userMessage, model) {

    const messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT
        },
        {
            role: 'user',
            content: userMessage
        }
    ];

    const response = await ollama.chat(
        model,
        messages
    );

    return response;
}

module.exports = {
    processMessage
};