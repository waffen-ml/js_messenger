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

    addMessage(sender_id, text, bundle) {
        bundle ??= null;
        return this.cfx.query(`insert into message (sender_id, chat_id, text, datetime, bundle_id) values (${sender_id}, ${this.id}, "${text}", now(), ${bundle})`)
        .then(() => {
            return this.getLastFormattedMessages(1);
        })
        .then(msgs => {
            this.displayMessages(msgs);
        })
    }

    getLastRawMessages(n) {
        return this.cfx.query('select m.id as message_id, m.sender_id, m.text, m.datetime,'
            + 'u.name as sender_name, u.tag as sender_tag, f.name as file_name, f.mimetype'
            + ` as file_mimetype from (select * from message order by id desc limit ${n}) m`
            + ' left join file f on m.bundle_id = f.bundle_id left join user u on m.sender_id = u.id');
    }

    getLastFormattedMessages(n) {
        return this.getLastRawMessages(n + 1)
        .then((arr) => {
            let result = [];
            let message = utils.createMessage(arr[arr.length - 1], false);
            let current_id = message.message_id;

            for(let i = arr.length - 1; i >= 0; i--) {
                if (arr[i].message_id != current_id) {
                    result.push(message);
                    
                    let minor = message.sender_id === arr[i].sender_id
                        && (arr[i].datetime - message.datetime) / 1000 / 60 < 5

                    if(!message.datetime || arr[i].datetime.getDay() != message.datetime.getDay()
                        || arr[i].datetime.getMonth() != message.datetime.getMonth())
                        result.push({
                            sender_id: null,
                            text: utils.getDateLabel(arr[i].datetime, 'ru')
                        })

                    current_id = arr[i].message_id;
                    message = utils.createMessage(arr[i], minor);
                }
                if(arr[i].file_name) {
                    message.content[arr[i].file_mimetype].push(arr[i].file_name);
                }
            }
            result.push(message);
            if (result.length > n)
                result.shift();

            return result;
        })
    }

    displayMessages(msgs) {
        msgs.forEach(msg => {
            this.cfx.chats.displayMessage(msg, this.id);
        })
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

exports.init = (cfx) => {
    cfx.chats = new ChatSystem(cfx);

}

