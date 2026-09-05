function isTemporaryRequest(message) {
    const temporaryPatterns = [
        /mañana/i,
        /hoy/i,
        /ahora/i,
        /esta vez/i,
        /para este momento/i,
        /en este momento/i,
        /ayúdame con/i,
        /ayudame con/i,
        /hazme/i,
        /dame/i,
        /muéstrame/i,
        /muestrame/i
    ];

    return temporaryPatterns.some(
        (pattern) => pattern.test(message)
    );
}

function normalizeMemoryContent(
    message,
    type
) {
    const content =
        message
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[{}[\]]/g, '')
            .trim();

    if (type === 'preference') {

        if (/^prefiero que\s+/i.test(content)) {
            return `El usuario prefiere que ${content.replace(
                /^prefiero que\s+/i,
                ''
            )}`;
        }

        if (/^prefiero\s+/i.test(content)) {
            return `El usuario prefiere ${content.replace(
                /^prefiero\s+/i,
                ''
            )}`;
        }

        if (/^me gusta\s+/i.test(content)) {
            return `Al usuario le gusta ${content.replace(
                /^me gusta\s+/i,
                ''
            )}`;
        }

        if (/^no me gusta\s+/i.test(content)) {
            return `Al usuario no le gusta ${content.replace(
                /^no me gusta\s+/i,
                ''
            )}`;
        }
    }

    if (type === 'project') {
        return content;
    }

    if (type === 'goal') {
        return content;
    }

    return content;
}

function detectMemoryCandidate(userMessage) {
    if (
        !userMessage ||
        !userMessage.trim()
    ) {
        return null;
    }

    const message = userMessage.trim();

    if (isTemporaryRequest(message)) {
        return null;
    }

    const patterns = [
        {
            type: 'preference',
            regex: /prefiero|me gusta|no me gusta|quiero que|prefiero que/i
        },
        {
            type: 'project',
            regex: /mi proyecto|estoy trabajando en|estoy haciendo|mi trabajo/i
        },
        {
            type: 'goal',
            regex: /mi objetivo|quiero aprender|quiero lograr|mi meta/i
        }
    ];

    for (const pattern of patterns) {
        if (pattern.regex.test(message)) {
            return {
                type: pattern.type,
                content: normalizeMemoryContent(
                    message,
                    pattern.type
                ),
                source: 'conversation',
                importance: 2
            };
        }
    }

    return null;
}

function isDuplicateMemory(candidate, existingMemories) {
    if (
        !candidate ||
        !Array.isArray(existingMemories)
    ) {
        return false;
    }

    const normalizeForComparison = (text) => {
        return text
            .trim()
            .toLowerCase()
            .replace(/^el usuario (prefiere|le gusta|no le gusta)\s+/i, '')
            .replace(/^prefiero\s+/i, '')
            .replace(/^me gusta\s+/i, '')
            .replace(/^no me gusta\s+/i, '')
            .replace(/[.,!?¿¡]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const candidateContent =
        normalizeForComparison(
            candidate.content
        );

    return existingMemories.some(
        (memory) => {
            const memoryContent =
                normalizeForComparison(
                    memory.content
                );

            return (
                memoryContent ===
                candidateContent
            );
        }
    );
}


module.exports = {
    detectMemoryCandidate,
    isDuplicateMemory
};