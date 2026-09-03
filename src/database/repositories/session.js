let currentConversationId = null;


function setCurrentConversation(id) {

    currentConversationId = id;

}


function getCurrentConversation() {

    return currentConversationId;

}


function clearCurrentConversation() {

    currentConversationId = null;

}


module.exports = {
    setCurrentConversation,
    getCurrentConversation,
    clearCurrentConversation
};