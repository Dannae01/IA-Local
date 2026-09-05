const memoriesRepository =
    require('../database/repositories/memories');

const {
    isDuplicateMemory
} = require('./memoryDetector');

const {
    generateEmbedding
} = require('../rag/embeddings');


/**
 * Busca memorias relacionadas con una consulta.
 *
 * @param {string} query
 * @param {number} limit
 * @returns {Array}
 */

async function createMemoryEmbedding(
    memoryId,
    content
) {

    if (
        !memoryId ||
        !content ||
        !content.trim()
    ) {
        return {
            success: false,
            error: 'ID y contenido de memoria son obligatorios.'
        };
    }


    try {

        const embedding =
            await generateEmbedding(
                content
            );


        const statement =
            require('../database/database').prepare(`
                UPDATE memories
                SET
                    embedding = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);


        const result =
            statement.run(
                JSON.stringify(embedding),
                memoryId
            );


        return {
            success: result.changes > 0,
            changes: result.changes
        };

    } catch (error) {

        console.error(
            'ERROR AL GENERAR EMBEDDING DE MEMORIA:',
            error
        );

        return {
            success: false,
            error: error.message
        };
    }
}

function cosineSimilarity(
    vectorA,
    vectorB
) {

    if (
        !Array.isArray(vectorA) ||
        !Array.isArray(vectorB) ||
        vectorA.length !== vectorB.length ||
        vectorA.length === 0
    ) {
        return 0;
    }


    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;


    for (
        let i = 0;
        i < vectorA.length;
        i++
    ) {

        dotProduct +=
            vectorA[i] *
            vectorB[i];

        magnitudeA +=
            vectorA[i] *
            vectorA[i];

        magnitudeB +=
            vectorB[i] *
            vectorB[i];
    }


    if (
        magnitudeA === 0 ||
        magnitudeB === 0
    ) {
        return 0;
    }


    return (
        dotProduct /
        (
            Math.sqrt(magnitudeA) *
            Math.sqrt(magnitudeB)
        )
    );
}

async function findRelevantMemories(
    query,
    limit = 5,
    minimumScore = 0.45
) {

    if (
        !query ||
        !query.trim()
    ) {
        return [];
    }


    try {

        const queryEmbedding =
            await generateEmbedding(
                query
            );


        const memories =
            memoriesRepository.getAllMemories();


        const results = [];


        for (const memory of memories) {

            if (!memory.embedding) {
                continue;
            }


            let memoryEmbedding;


            try {

                memoryEmbedding =
                    JSON.parse(
                        memory.embedding
                    );

            } catch (error) {

                console.warn(
                    `Embedding inválido para memoria ${memory.id}.`
                );

                continue;
            }


            const score =
                cosineSimilarity(
                    queryEmbedding,
                    memoryEmbedding
                );


            if (
                score >= minimumScore
            ) {

                results.push({
                    ...memory,
                    score
                });
            }
        }


        results.sort(
            (a, b) =>
                b.score - a.score
        );


        return results.slice(
            0,
            limit
        );

    } catch (error) {

        console.error(
            'ERROR AL BUSCAR MEMORIAS SEMÁNTICAMENTE:',
            error
        );

        return [];
    }
}


/**
 * Obtiene todas las memorias importantes.
 *
 * @param {number} minimumImportance
 * @returns {Array}
 */
function getImportantMemories(
    minimumImportance = 2
) {

    const memories =
        memoriesRepository.getAllMemories();


    return memories.filter(
        memory =>
            memory.importance >=
            minimumImportance
    );
}


/**
 * Convierte las memorias en texto
 * para incluirlas posteriormente
 * en el contexto que recibe Ollama.
 *
 * @param {Array} memories
 * @returns {string}
 */
function formatMemoriesForPrompt(
    memories
) {

    if (
        !memories ||
        memories.length === 0
    ) {
        return '';
    }


    return memories
        .map(
            memory =>
                `- ${memory.content}`
        )
        .join('\n');
}

async function saveMemoryIfNew(candidate) {
    if (!candidate) {
        return {
            saved: false,
            reason: 'No hay memoria para guardar.'
        };
    }

    const existingMemories =
        memoriesRepository.getAllMemories();

    const duplicate =
        isDuplicateMemory(
            candidate,
            existingMemories
        );

    if (duplicate) {
        return {
            saved: false,
            reason: 'La memoria ya existe.'
        };
    }

    const memoryId =
        memoriesRepository.createMemory(
            candidate.type,
            candidate.content,
            candidate.source ?? 'conversation',
            candidate.importance ?? 1
        );

    const embeddingResult =
        await createMemoryEmbedding(
            memoryId,
            candidate.content
        );

    if (!embeddingResult.success) {
        return {
            saved: true,
            id: memoryId,
            embedding: false,
            error: embeddingResult.error
        };
    }

    return {
        saved: true,
        id: memoryId,
        embedding: true
    };
}

module.exports = {
    findRelevantMemories,
    getImportantMemories,
    formatMemoriesForPrompt,
    createMemoryEmbedding,
    saveMemoryIfNew
};