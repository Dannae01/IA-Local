const fs = require('fs');
const path = require('path');

const attachmentsRoot =
    path.join(
        __dirname,
        '../../data/attachments'
    );

function ensureAttachmentsDirectory() {
    if (
        !fs.existsSync(
            attachmentsRoot
        )
    ) {
        fs.mkdirSync(
            attachmentsRoot,
            {
                recursive: true
            }
        );
    }
}

function storeAttachment(
    sourcePath,
    conversationId
) {
    ensureAttachmentsDirectory();

    const conversationDirectory =
        path.join(
            attachmentsRoot,
            String(conversationId)
        );

    fs.mkdirSync(
        conversationDirectory,
        {
            recursive: true
        }
    );

    const originalName =
        path.basename(sourcePath);

    const safeName =
        originalName.replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
        );

    const storedName =
        `${Date.now()}-${safeName}`;

    const destination =
        path.join(
            conversationDirectory,
            storedName
        );

    fs.copyFileSync(
        sourcePath,
        destination
    );

    return destination;
}

module.exports = {
    storeAttachment
};