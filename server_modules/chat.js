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
        return this.cfx.query(`select id from chat_member where user_id=${id} and chat_id=${this.id}`)
        .then((r) => {
            return r.length > 0;
        })
    }

    addMessage(sender_id, text, bundle) {
        return this.cfx.db.executeFile('addmessage', {
            sender_id: sender_id,
            chat_id: this.id,
            text: this.cfx.utils.mysql_escape(text),
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
                arr, 'files', {
                    file_id: 'id',
                    file_mimetype: 'mimetype',
                    file_name: 'name'
                }, 'id', 'file_id')
            return messages
        })
    }

    makeMessageRead(ids) {
        if (!ids.length)
            return
        return this.cfx.db.executeFile('readmessages', {
            ids: ids.join(','), chat_id: this.id})
    }

    displayMessage(msg) {
        this.cfx.socket.io.in('c:' + this.id).emit('message', msg)

        return this.cfx.socket.getSocketsInRoom('c:' + this.id)
        .then((sockets) => {
            let ids = sockets.map(s => (s.request.session.user ?? {}).id).filter(id => id)
            return this.makeMessageRead(ids)
        })
        .then(() => {
            return this.getInfo()
        })
        .then(info => {
            return Promise.all(info.members.map(member => {
                return this.cfx.notifications.sendSpecificUnread(member.id, 'messages')
            }))
        })

        
    }

    getInfo() {
        return this.cfx.db.executeFile('getchatinfo', {chatid: this.id})
        .then(info => {
            return this.cfx.utils.parseArrayOutput(info, 'members', {
                is_admin: null,
                member_name: 'name',
                member_tag: 'tag',
                member_id: 'id',
                member_avatar: 'avatar_id'
            }, 'id')[0]
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
        .then((views_raw) => {
            return this.cfx.utils.parseArrayOutput(views_raw, 'members', {
                member_id: 'id',
                member_name: 'name',
                member_tag: 'tag'
            }, 'id')
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

    createChat(name, isPublic, avatarId, members) {
        return this.cfx.query('insert into chat(name, is_public, avatar_id) values(?, ?, ?)',
        [name, isPublic, avatarId])
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

    fuck() {
        throw Error('wewewe')
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
    if(!cfx.socket || !cfx.files || !cfx.notifications)
        return true

    cfx.chats = new ChatSystem(cfx);
    let temp = new CallTemp(cfx)

    cfx.notifications.addUnreadChecker('messages', userid => {
        return cfx.db.executeFile('unreadchats', {userid: userid})
        .then(r => {
            return r.length? r[0].count ?? 0 : 0
        })
    })

    cfx.core.safePost('/sendmsg', (sender, req, res) => {
        return cfx.chats.getChat(req.query.id)
        .then(chat => {
            if(!chat)
                throw Error('Invalid chat')
            return cfx.files.saveFiles(req.files, -1)
            .then(r => {
                chat.addMessage(sender.id, req.body.text,
                    r? r.bundle: null)
                return {success: 1}
            })
        })
    }, cfx.core.upload.array('files'), true)

    cfx.core.app.post('/createchat', cfx.core.upload.single('avatar'), (req, res) => {
        let creator = cfx.core.login(req, res, false)

        if(!creator) {
            res.send({success:false})
            return
        }

        new Promise((resolve) => {
            if (!req.avatar)
                resolve(null)
            else {
                return cfx.files.saveFiles([req.file], null)
                .then(r => r.ids[0])
            }
        }).then(avatarId => {
            req.body.members ??= []
            let members = Array.isArray(req.body.members)? req.body.members : [req.body.members]
            return cfx.chats.createChat(req.body.name || null, parseInt(req.body.ispublic), avatarId, members)
        }).then(chat => {
            chat.addMessage(null, creator.name + ' создал этот чат', null)
        })
        .then(() => {
            res.send({success: true})
        })
        .catch(err => {
            console.log(err)
        })
    })

    cfx.core.safeGet('/getchatavatar', (observer, req, res) => {
        return cfx.chats.accessChat(observer, req.query.id)
        .then(chat => {
            return chat.getInfo()
        })
        .then(info => {
            if (info.is_direct) {
                let other = info.members[0].id == observer.id?
                    info.members[1] : info.members[0]
                res.redirect('/getuseravatar?id=' + other.id)
            }
            else if (info.avatar_id) {
                res.redirect('/file?id=' + info.avatar_id)
            }
            else {
                res.redirect('/public/chatavatar.jpg')
            }
        })
        .catch((err) => {
            console.log(err)
            console.log('LOX')
        })
    }, false)

    cfx.core.safeGet('/getchatlist', (user, req, res) => {
        if(!user)
            return []
        return cfx.chats.getChatViews(user.id)
    }, false)

    cfx.core.safeRender('/chatlist', (user, req, res) => {
        return {
            render: 'chatlist'
        }
    }, true)

    cfx.core.safeRender('/chat', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            chat.makeMessageRead([user.id])
            return {
                render: 'chat'
            }
        })
    }, true)

    cfx.core.safeGet('/getchatinfo', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            return chat.getInfo()
        })
    }, false)

    cfx.core.safeGet('/getmessages', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            let start = parseInt(req.query.start)
            let count = parseInt(req.query.count)
            return chat.getMessages(start, count)
        })
    }, true)

    cfx.core.safeRender('/direct', (user, req, res) => {
        return cfx.chats.getDirectChat(user.id, req.query.with)
        .then(chat => {
            res.redirect('/chat?id=' + chat.id)
        })
    }, true)

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

