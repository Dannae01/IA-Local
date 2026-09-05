const OLLAMA_URL =
    'http://localhost:11434';

const EMBEDDING_MODEL =
    'nomic-embed-text';


async function generateEmbedding(text) {

    if (!text || !text.trim()) {
        throw new Error(
            'No se puede generar un embedding para un texto vacío.'
        );
    }

    const response = await fetch(
        `${OLLAMA_URL}/api/embeddings`,
        {
            method: 'POST',

            headers: {
                'Content-Type':
                    'application/json'
            },

            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                prompt: text
            })
        }
    );


    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Ollama respondió con un error al generar el embedding: ${errorText}`
        );
    }


    const data =
        await response.json();


    if (
        !data.embedding ||
        !Array.isArray(data.embedding)
    ) {
        throw new Error(
            'Ollama no devolvió un embedding válido.'
        );
    }


    return data.embedding;
}


module.exports = {
    generateEmbedding
};