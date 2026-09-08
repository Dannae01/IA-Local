const fs = require('fs');
const crypto = require('crypto');

const pendingAttachments =
    new Map();

function stageAttachment(
    filePath,
    name,
    mimeType,
    options = {}
) {
    const token =
        crypto.randomUUID();

    pendingAttachments.set(
        token,
        {
            filePath,
            name,
            mimeType,
            temporary:
                options.temporary === true
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
    const attachment =
        pendingAttachments.get(
            token
        );

    if (!attachment) {
        return false;
    }

    if (
        attachment.temporary &&
        attachment.filePath
    ) {
        try {
            if (
                fs.existsSync(
                    attachment.filePath
                )
            ) {
                fs.unlinkSync(
                    attachment.filePath
                );
            }
        } catch (error) {
            console.error(
                'ERROR AL ELIMINAR ADJUNTO TEMPORAL:',
                error
            );
        }
    }

    return pendingAttachments.delete(
        token
    );
}

module.exports = {
    stageAttachment,
    consumeAttachment,
    discardAttachment
};