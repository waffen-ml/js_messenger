const utils = require('./cfx-utils');

class Chat {
    constructor(cfx, id, name, ispublic) {
        this.cfx = cfx;
        this.id = id;
        this.name = name;
        this.ispublic = ispublic ?? true;
        this.users = {};
        this.messages = new utils.IndexedDict();
        this.listeners = {};
    }

    displayMessage(msg) { 
        this.cfx.chats.displayMessage(msg, this.id);
    }

    addUser(userid) {
        this.users[userid] = false;
        const user = this.cfx.auth.getUser(userid);
        if (user.onMessage)
            this.listeners[user.id] = user.onMessage;
    }

    removeUser(userid) {
        delete this.users[userid];
    }

    addAdmin(userid) {
        this.users[userid] = true;
    }

    removeAdmin(userid) {
        if (!this.containsAdmin(userid)) return;
        this.users[userid] = false;
    }

    containsUser(userid) {
        return this.ispublic || userid in this.users;
    }

    containsAdmin(userid) {
        return Boolean(this.users[userid]);
    }

    _normIndex(i) {
        return utils.clamp(i, 0, this.messages.length() - 1);
    }

    getMessage(id) {
        return this.messages.get(id);
    }

    getMessages(start, dir) {
        let a = this._normIndex(this.messages.length() - start - 1);
        let b = this._normIndex(a + dir);
        if (a > b) [a, b] = [b, a];
        return this.messages.values().slice(a, b + 1);
    }

    updateListeners(msg) {
        Object.keys(this.listeners).forEach(k => {
            if (msg.sender && msg.sender.id == k) return;
            this.listeners[k](msg, this);
        })
    }

    addMessage(msg) {
        const id = this.messages.add(msg);
        this.displayMessage(msg);
        this.updateListeners(msg);
        return id;
    }

    system(msg) {
        return this.addMessage({text: msg});
    }
}

class ChatSystem {
    chats = new utils.IndexedDict();

    constructor(cfx) {
        this.cfx = cfx;
    }

    createChat(name, ispublic) {
        return this.chats.add((id) => 
            new Chat(this.cfx, id, name, ispublic), true);
    }

    removeChat(id) {
        this.chats.remove(id);
    }

    getChat(id) {
        return this.chats.get(id);
    }

    addUserToChat(userid, chatid, isadmin, privateName) {
        const chat = this.getChat(chatid);
        const user = this.cfx.auth.getUser(userid);
        if (!chat || !user) return;
        if (isadmin) chat.addAdmin(userid);
        else chat.addUser(userid);
        user.addChat(chatid, privateName);
    }

    removeUserFromChat(userid, chatid) {
        const chat = this.getChat(chatid);
        if (chat) chat.removeUser(userid);
        const user = this.cfx.auth.getUser(userid);
        if (user) user.removeChat(chatid); 
    }
}

const init = (cfx) => {
    cfx.chats = new ChatSystem(cfx);
}

module.exports = { Chat, init };

