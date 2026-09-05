const ollama = require('../ai/ollama');
const messagesRepository = require('../database/repositories/messages');

const {
    searchSimilarChunks
} = require('../rag/retriever');

const {
    findRelevantMemories,
    formatMemoriesForPrompt,
    saveMemoryIfNew
} = require('../memory/memoryManager');

const {
    detectMemoryCandidate
} = require('../memory/memoryDetector');

const SYSTEM_PROMPT = `
Eres NOVA, un asistente virtual de escritorio local.

Tu función es ayudar al usuario de forma clara, útil y natural.

Responde directamente a lo que el usuario necesita.

Actualmente estás funcionando de forma local mediante Ollama.

Las MEMORIAS RELEVANTES DEL USUARIO contienen información previamente guardada que puede ayudarte a personalizar tus respuestas.

Utiliza esas memorias cuando sean relevantes para la solicitud actual.

No menciones las memorias ni su sistema interno al usuario, a menos que te pregunte explícitamente sobre ellas.

Cuando recibas CONTEXTO DE DOCUMENTOS, utilízalo para responder las preguntas relacionadas con esos documentos.

No inventes información que no aparezca en el contexto proporcionado.

Si la información solicitada no está en los documentos proporcionados, indícalo claramente.
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
        ? messagesRepository
            .getMessages(conversationId)
            .slice(0, -1)
        : [];

    const relevantChunks =
        await searchSimilarChunks(
            userMessage,
            conversationId,
            5
        );

    console.log('CHUNKS RELEVANTES:', relevantChunks);

    const memoryCandidate =
        detectMemoryCandidate(
            userMessage
        );

    if (memoryCandidate) {
        try {
            const memoryResult =
                await saveMemoryIfNew(
                    memoryCandidate
                );

            if (memoryResult.saved) {
                console.log(
                    `Nueva memoria guardada: ${memoryResult.id}`
                );
            }
        } catch (error) {
            console.error(
                'ERROR AL GUARDAR MEMORIA AUTOMÁTICA:',
                error
            );
        }
    }

const relevantMemories =
    await findRelevantMemories(
        userMessage,
        5
    );

    console.log(
        `Memorias relevantes encontradas: ${relevantMemories.length}`
    );

    const memoryContext =
        relevantMemories.length > 0
            ? `
    MEMORIAS RELEVANTES DEL USUARIO:

    ${formatMemoriesForPrompt(
        relevantMemories
    )}
    `
            : '';

    const ragContext =
        relevantChunks.length > 0
            ? `
CONTEXTO DE DOCUMENTOS:

${relevantChunks
    .map(
        (chunk) =>
            `[Documento: ${chunk.documentName} | Fragmento: ${chunk.chunkIndex}]

${chunk.content}`
    )
    .join('\n\n')}
`
            : '';

    const messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT + memoryContext + ragContext
        },
        ...history.map((message) => ({
            role: message.role,
            content: message.content
        })),
        {
            role: 'user',
            content: userMessage
        }
    ];

    console.log('HISTORIAL RECUPERADO:', history);
    console.log('MENSAJES ENVIADOS A OLLAMA:', messages);

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