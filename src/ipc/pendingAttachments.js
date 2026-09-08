const crypto = require('crypto');

const pendingAttachments =
    new Map();

function stageAttachment(
    filePath,
    name,
    mimeType
) {
    const token =
        crypto.randomUUID();

    pendingAttachments.set(
        token,
        {
            filePath,
            name,
            mimeType
        }
    );

    return token;
}

function consumeAttachment(
    token
) {
    const attachment =
        pendingAttachments.get(
            token
        );

    if (!attachment) {
        return null;
    }

    pendingAttachments.delete(
        token
    );

    return attachment;
}

function discardAttachment(
    token
) {
    return pendingAttachments.delete(
        token
    );
}

module.exports = {
    stageAttachment,
    consumeAttachment,
    discardAttachment
};