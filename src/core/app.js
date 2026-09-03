const ollama = require('../ai/ollama');
const messagesRepository = require('../database/repositories/messages');

const SYSTEM_PROMPT = `
Eres NOVA, un asistente virtual de escritorio local.

Tu función es ayudar al usuario de forma clara, útil y natural.

Responde directamente a lo que el usuario necesita.

Actualmente estás funcionando de forma local mediante Ollama.
`;


async function processMessage(
    userMessage,
    model,
    onChunk,
    signal,
    conversationId,
    temperature,
    contextSize
) {

    const history = conversationId
        ? messagesRepository.getMessages(conversationId)
        : [];

    console.log(
        'HISTORIAL RECUPERADO:',
        history
    );


    const messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT
        },

        ...history.map((message) => ({
            role: message.role,
            content: message.content
        }))
    ];


    console.log(
        'MENSAJES ENVIADOS A OLLAMA:',
        messages
    );

    console.log(
        'CONTEXTO RECIBIDO EN APP:',
        contextSize
    );

    const response = await ollama.chat(
        model,
        messages,
        onChunk,
        signal,
        temperature,
        contextSize
    );


    return response;
}


module.exports = {
    processMessage
};