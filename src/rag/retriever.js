const {
    generateEmbedding
} = require('./embeddings');

const documentsRepository =
    require('../database/repositories/documents');

const conversationDocumentsRepository =
    require('../database/repositories/conversationDocuments');

function cosineSimilarity(
    vectorA,
    vectorB
) {
    if (
        !Array.isArray(vectorA) ||
        !Array.isArray(vectorB)
    ) {
        return 0;
    }

    if (
        vectorA.length === 0 ||
        vectorA.length !== vectorB.length
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
            vectorA[i] * vectorB[i];

        magnitudeA +=
            vectorA[i] * vectorA[i];

        magnitudeB +=
            vectorB[i] * vectorB[i];
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


async function searchSimilarChunks(
    query,
    conversationId,
    limit = 5
) {
    if (!query || !query.trim()) {
        return [];
    }

    const queryEmbedding =
        await generateEmbedding(query);

    const documents =
        conversationDocumentsRepository
            .getDocumentsByConversationId(
                conversationId
            );

    const results = [];

    for (
        const document of documents
    ) {
        const chunks =
            documentsRepository
                .getChunksByDocumentId(
                    document.id
                );

        for (
            const chunk of chunks
        ) {
            if (!chunk.embedding) {
                continue;
            }

            let embedding;

            try {
                embedding =
                    JSON.parse(
                        chunk.embedding
                    );
            } catch (error) {
                continue;
            }

            const score =
                cosineSimilarity(
                    queryEmbedding,
                    embedding
                );

            results.push({
                documentId:
                    document.id,

                documentName:
                    document.name,

                chunkId:
                    chunk.id,

                chunkIndex:
                    chunk.chunk_index,

                content:
                    chunk.content,

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
}


module.exports = {
    cosineSimilarity,
    searchSimilarChunks
};