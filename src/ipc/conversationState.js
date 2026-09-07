const conversations =
    require('../database/repositories/conversations');

const session =
    require('../database/repositories/session');

function ensureCurrentConversation(
    title = 'Nueva conversación'
) {
    const currentId =
        session.getCurrentConversation();

    if (
        currentId &&
        conversations.getConversation(currentId)
    ) {
        return currentId;
    }

    const safeTitle =
        typeof title === 'string' &&
        title.trim()
            ? title.trim().slice(0, 40)
            : 'Nueva conversación';

    const conversationId =
        conversations.createConversation(
            safeTitle
        );

    session.setCurrentConversation(
        conversationId
    );

    return conversationId;
}

module.exports = {
    ensureCurrentConversation
};