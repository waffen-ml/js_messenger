const utils = require('./cfx-utils');

class Chat {
    messages = new utils.IndexedDict();
    users = new Set();
    bots = {};
    lastMessage = null;

    constructor(cfx, id, name, ispublic) {
        this.cfx = cfx;
        this.id = id;
        this.name = name;
        this.ispublic = ispublic ?? true;
    }

    displayMessage(msg) { 
        this.cfx.chats.displayMessage(msg, this.id);
    }

    addUser(userid) {
        this.users.add(userid);
        const user = this.cfx.auth.getUser(userid);
        if (user.isBot())
            this.bots[userid] = user.botscript;
    }

    removeUser(userid) {
        this.users.delete(userid);
        delete this.bots[userid];
    }

    containsUser(userid) {
        return this.ispublic || this.users.has(userid);
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

    updateBots(msg) {
        Object.keys(this.bots).forEach(botid => {
            const botscript = this.bots[botid];
            botscript.onMessage(msg, (text, files) => this.sendMessage(botid, text, files));
        })
    }

    appendMessage(msg) {
        this.displayMessage(msg);
        this.updateBots(msg);
        this.lastMessage = msg;
        return this.messages.add(msg);
    }

    system(text) {
        const msg = {
            system: true,
            text: text
        };
        return this.appendMessage(msg);
    }

    sendMessage(senderid, text, files) {
        const content = utils.createContent(text, files);
        let sended = [];

        utils.splitContent(content).forEach(contPiece => {

            const msg = {
                sender: this.cfx.auth.getUser(senderid),
                content: contPiece,
                date: new Date()
            };
    
            if (!this.lastMessage || !this.lastMessage.system &&
                this.lastMessage.date.getDay() != msg.date.getDay())
            {
                this.system(utils.getDayAndMonth(msg.date, 'ru'));
            }
            else if (!this.lastMessage.system) {
                const sameSender = this.lastMessage.sender.id == senderid;
                const diffMinutes = (msg.date - this.lastMessage.date) / 1000 / 60;
                msg.minor = sameSender && (diffMinutes < 5);
            }
            sended.push(this.appendMessage(msg));

        });

        return sended;
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

    addUserToChat(userid, chatid, privateName) {
        const chat = this.getChat(chatid);
        const user = this.cfx.auth.getUser(userid);
        if (!chat || !user) return;
        else chat.addUser(userid);
        user.addChat(chatid, privateName);
    }

    removeUserFromChat(userid, chatid) {
        const chat = this.getChat(chatid);
        if (chat) chat.removeUser(userid);
        const user = this.cfx.auth.getUser(userid);
        if (user) user.removeChat(chatid); 
    }

    createChatbot(botname, botid, events) {
        const bot = new Chatbot(botid, events);
        this.cfx.auth.addUser(botid, botname, null, bot);
        return bot;
    }
}

class Chatbot {
    eventHandler = new utils.EventHandler()

    constructor(userid, events) {
        this.userid = userid;
        this.eventHandler.addListeners(events);
    }

    addListener(name, f) {
        this.eventHandler.addListener(name, f);
    }

    onMessage(msg, sendf) {
        if (msg.sender.id == this.userid) return;
        setTimeout(() => {
            this.eventHandler.fire('message', msg, sendf)
        }, 1000);
    }
}

const init = (cfx) => {
    cfx.chats = new ChatSystem(cfx);
}

module.exports = { Chat, init };

