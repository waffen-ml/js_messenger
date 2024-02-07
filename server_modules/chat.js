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
        return this.cfx.db.executeFile('addmessage', {
            sender_id: sender_id,
            chat_id: this.id,
            text: text,
            bundle: bundle ?? null
        })
        .then(() => {
            return this.getMessages(-1, 1);
        })
        .then(msgs => {
            this.displayMessage(msgs[0]);
        })
    }

    addMembers(users) {
        return this.cfx.query('select max(local_id) as lmlid from message where chat_id=' + this.id)
        .then((w) => {
            let lmlid = w[0].lmlid ?? 0
            users.forEach(u => this.cfx.query(
                `insert into chat_member(chat_id, user_id, last_read, focus) 
                values(${this.id}, ${u}, ${lmlid}, ${lmlid + 1})`))
        })
    }

    getMessages(start, count) {
        return new Promise((resolve) => {
            if (start > -1)
                resolve()
            this.cfx.query('select max(local_id) as mlid from message where chat_id=' + this.id)
            .then(r => {
                start = r[0].mlid
                resolve()
            })
        }).then(() => {
            return this.cfx.db.executeFile('getmessages', {
                start: start,
                count: count,
                chatid: this.id
            })
        })
        .then(arr => {
            let messages = this.cfx.utils.parseArrayOutput(
                arr, 'files', ['file_id', 'file_name', 'file_mimetype'], 'id', 'file_id')
            return messages
        })
    }

    makeMessageRead(ids) {
        return this.cfx.db.executeFile('readmessages', {
            ids: ids.join(','), chat_id: this.id})
    }

    displayMessage(msg) {
        this.cfx.socket.io.in('c:' + this.id).emit('message', msg)

        this.cfx.socket.getSocketsInRoom('c:' + this.id)
        .then((sockets) => {
            let ids = sockets.map(s => (s.request.session.user ?? {}).id).filter(id => id)
            return this.makeMessageRead(ids)
        })
    }

    getInfo() {
        return this.cfx.db.executeFile('getchatinfo', {chatid: this.id})
        .then(info => {
            return this.cfx.utils.parseArrayOutput(info, 'members', {
                'is_admin': null,
                'member_name': 'name',
                'member_tag': 'tag',
                'member_id': 'id'
            }, 'id', 'member_id')
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

    removeChat(id) {
        delete this.chats[id];
        return this.cfx.query(`delete from chat where id=${id}`);
    }

    getChatViews(userid) {
        return this.cfx.db.executeFile('views', {id: userid, max_members: 4})
        .then((views) => {
            let result = []
            let current = {id:-1}
                
            views.forEach(view => {
                let view_member = {
                    id: view.member_id,
                    name: view.member_name,
                    tag: view.member_tag
                }

                if (view.id != current.id) {
                    result.push(current)
                    current = view
                    view.members = [view_member]
                    delete view.member_id
                    delete view.member_name
                    delete view.member_tag
                    return
                }
                current.members.push(view_member)
            })

            result.push(current)
            result.shift()

            return result
        })
        .then(views => {
            views.forEach(view => {

                if (!view.lm_id || view.lm_local_id < view.focus) {
                    view.visible = false;
                    return;
                } else
                    view.visible = true;

                view.unread = view.lm_local_id - view.last_read;

                if (!view.chat_name) {
                    let names = view.members.filter(m => m.id != view.owner_id).map(m => m.name)
                    view.chat_name = names.join(', ')
                }

                view.lm_preview = view.lm_text? view.lm_text.substr(0, 100) + ' ' : '';
                if (view.lm_file_count > 0)
                    view.lm_preview += `[${view.lm_file_count} файлов]`

                view.datetime_label = view.lm_datetime && this.cfx.utils.getMessageDatetimeLabel(view.lm_datetime)

            })
            return views
        })
    }

    getDirectChat(userid1, userid2) {
        return this.cfx.db.executeFile('getdirectchat', {
            user1: userid1,
            user2: userid2
        }).then(r => {
            if (r.length > 0)
                return new Chat(this.cfx, r[0].chat_id, null)
            return this.cfx.query('insert into chat(is_direct) values(1)')
            .then(r => {
                return new Chat(this.cfx, r.insertId, null)
            }).then(chat => {
                return chat.addMembers([userid1, userid2])
                .then(() => chat)
            })
        })
    }

    createGroup(name, is_public, members) {
        return this.cfx.query(`insert into chat(name, is_public) values("${name}", ${is_public})`)
        .then((r) => {
            let chat = new Chat(this.cfx, r.insertId, name)
            chat.addMembers(members??[])
            return chat
        })
    }

    accessChat(user, chatid) {
        return this.getChat(chatid)
        .then(chat => {
            if (!chat)
                throw new Error('Chat was not found')
            return chat.containsUser(user.id)
            .then(r => {
                if (!r) throw new Error('User is not in the chat')
                return chat
            })
        })
    }
}

class CallTemp {
    constructor(cfx) {
        this.cfx = cfx
        this.temp = {}
    }

    add(chatid, user, peer) {
        if (!this.temp[chatid])
            this.temp[chatid] = {}
        user.peer = peer
        this.temp[chatid][peer] = user
        return this.temp[chatid]
    }

    getTable(chatid) {
        return this.temp[chatid] ?? {}
    }

    removeByPeer(chatid, peer) {
        if (this.temp[chatid])
            delete this.temp[chatid][peer]
    }

    removeById(chatid, userid) {
        let conn = this.getById(chatid, userid)
        this.removeByPeer(chatid, conn.peer)
    }

    getByPeer(chatid, peer) {
        if (!this.temp[chatid])
            return null
        return null || this.temp[chatid][peer]
    }

    getById(chatid, userid) {
        if(!this.temp[chatid])
            return null
        let members = Object.values(this.temp[chatid])
        for (let i = 0; i < members.length; i++)
            if(members[i].id == userid)
                return members[i]
        return null
    }
}

exports.init = (cfx) => {
    if(!cfx.socket || !cfx.files)
        return true

    cfx.chats = new ChatSystem(cfx);
    let temp = new CallTemp(cfx)

    cfx.core.app.post('/sendmsg', cfx.core.upload.array('files'), (req, res) => {
        let sender = cfx.core.login(req, res, true);
        if(!sender) return;

        cfx.chats.getChat(req.query.id)
        .then(chat => {
            if(!chat)
                return;
            cfx.files.saveFiles(req.files, -1)
            .then(r => {
                chat.addMessage(sender.id, req.body.text,
                    r? r.bundle: null)
                res.send({success: true});
            })
        })
    });
    

    cfx.core.app.get('/chatlist', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then((user) => {
            return cfx.chats.getChatViews(user.id)
        })
        .then((views) => {
            cfx.core.render(req, res, 'chatlist', {views: views})
        })
        .catch(() => {})
    })

    cfx.core.app.get('/chat', (req, res, next) => {
        let user = cfx.core.login(req, res, true)
        if(!user) return

        cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            chat.makeMessageRead([user.id])
            cfx.core.render(req, res, 'chat', {})
        })
        .catch(err => {
            next(err)
        })
    })

    cfx.core.app.get('/getchatinfo', (req, res) => {
        cfx.core.plogin(req, res, false)
        .then(user => {
            cfx.chats.accessChat(user, req.query.id)
            .then(chat => {
                return chat.getInfo()
            })
            .then(info => {
                res.send(info)
            })
        })
        .catch(err => {
            console.log(err)
        })
    })

    cfx.core.app.get('/getmessages', (req, res) => {
        let user = cfx.core.login(req, res, false)
        if(!user) return
        cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            let start = parseInt(req.query.start)
            let count = parseInt(req.query.count)
            return chat.getMessages(start, count)
        })
        .then(messages => {
            res.send(messages)
        })
        .catch(err => {
            console.log(err)
        })
    })

    cfx.core.app.get('/direct', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then(user => {
            return cfx.chats.getDirectChat(user.id, req.query.with)
        })
        .then(chat => {
            res.redirect('/chat?id=' + chat.id)
        })
        .catch(err => {
            console.log(err)
        })
    })

    cfx.core.app.get('/getcalltable', (req, res) => {
        cfx.core.plogin(req, res, false)
        .then(user => {
            if(!user)
                throw Error('unauthorized user')
            res.send({
                table: temp.getTable(req.query.chatid)
            })
        })
        .catch(err => {
            console.log('Error:' + err)
        })
    })

    function setVCFlag(chatid, state) {
        state = state? 1 : 0
        return cfx.query(`update chat set voice=${state} where id=${chatid}`)
    }

    cfx.core.app.get('/joincall', (req, res) => {
        let peerid = req.query.peerid
        let chatid = req.query.chatid

        cfx.core.plogin(req, res, false)
        .then(user => {
            if(!user)
                throw Error('unauthorized user')

            if (temp.getById(chatid, user.id)) {
                res.send({success:false})
                return
            }

            res.send({success: true})
            let table = temp.add(chatid, user, peerid)

            cfx.socket.io.to('c:' + chatid).emit('new-call-member', table[peerid])

            if (Object.keys(table).length == 1)
                return setVCFlag(chatid, 1)
        })
        .catch(err => {
            console.log('Joincall err:' + err)
        })
    })

    function vcDisconnect(socket, chatid, userid) {
        let call = temp.getById(chatid, userid)
        if (!call)
            return
        cfx.socket.io.to('c:' + chatid).emit('call-member-disconnected', call.peer)
        temp.removeByPeer(chatid, call.peer)

        if (!Object.keys(temp.getTable(chatid)).length)
            setVCFlag(chatid, 0)
    }

    cfx.socket.onSocket((socket, userid) => {
        socket.on('join-chat', chatid => {
            socket.join('c:' + chatid)

            socket.on('end-call', () => {
                vcDisconnect(socket, chatid, userid)
            })
            socket.on('disconnect', () => {
                vcDisconnect(socket, chatid, userid)
            })
        })
    })


}

