const utils = require('./utils');

class Chat {
    constructor(cfx, id, name) {
        this.cfx = cfx;
        this.id = id;
        this.name = name;
    }

    addUser(id) {
        return this.cfx.query(`insert into chat_member(user_id, chat_id) values (${id}, ${this.id})`);
    }

    removeUser(id) {
        return this.cfx.query(`delete from chat_member where user_id=${id} and chat_id=${this.id}`);
    }

    containsUser(id) {
        return Promise.resolve(true);
        return this.cfx.query(`select id from chat_member where user_id=${id} and chat_id=${this.id}`)
        .then((r) => {
            return r.length > 0;
        })
    }

    addMessage(sender_id, text) {
        return this.cfx.query(`insert into message(sender_id, chat_id, text, datetime) values(${sender_id}, ${this.id}, "${text}", now())`)
        .then(() => {
            return this.getLastMessages(1);
        })
        .then(msg => {
            this.displayMessage(msg[0]);
        })
    }

    getLastMessages(n) {
        return this.cfx.query(`select m.id as message_id, m.sender_id, m.text, m.datetime, ` +
            `u.name as sender_name, u.tag as sender_tag from message m join user u on m.sender_id = u.id ` +
            `where m.chat_id=${this.id} order by m.id desc limit ${n}`)
    }

    displayMessage(msg) {
        this.cfx.chats.displayMessage(msg, this.id);
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
    constructor(cfx) {
        this.cfx = cfx;
        this.chats = {};
    }

    getChat(id) {
        if(id in this.chats)
            return Promise.resolve(this.chats[id]);
        return this.cfx.query(`select * from chat where id=${id}`)
        .then(data => {
            if(!data.length)
                return null;
            this.chats[id] = new Chat(this.cfx, data[0].id, data[0].name)
            return this.chats[id];
        })
    }

    createChat(name) {
        return this.cfx.query(`insert into chat(name) values("${name}")`)
        .then((p) => {
            this.chats[p.insertId] = new Chat(this.cfx, p.insertId, name);
            return this.chats[p.insertId];
        })
    }

    removeChat(id) {
        delete this.chats[id];
        return this.cfx.query(`delete from chat where id=${id}`);
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
        if (msg.system || msg.sender.id == this.userid) return;
        setTimeout(() => {
            this.eventHandler.fire('message', msg, sendf)
        }, 1000);
    }
}

const init = (cfx) => {
    cfx.chats = new ChatSystem(cfx);
}

module.exports = { Chat, init };

