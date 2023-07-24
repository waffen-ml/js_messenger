const utils = require('./cfx-utils');

class Chat {
    constructor(name) {
        this.name = name;
        this.users = {};
        this.messages = new utils.IndexedDict();
    }

    addUser(userid) {
        this.users[userid] = false;
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
        return userid in this.users;
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

    addMessage(msg) {
        //if (!msg.system && !this.containsUser(msg.sender)) return false;
        return this.messages.add(msg);
    }

    system(msg) {
        return this.addMessage({text: msg, system: true});
    }
}

class ChatSystem {
    chats = new utils.IndexedDict();

    createChat(name) {
        return this.chats.add(new Chat(name));
    }

    removeChat(id) {
        this.chats.remove(id);
    }

    getChat(id) {
        return this.chats.get(id);
    }
}

const init = (cfx) => {
    cfx.chats = new ChatSystem();
}

module.exports = { Chat, init };

