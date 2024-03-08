class Chat {
    constructor(cfx, id, name) {
        this.cfx = cfx;
        this.id = id;
        this.name = name;
    }

    addUser(id) {
        return this.cfx.query(`insert into chat_member(user_id, chat_id) values (?, ?)`, [id, this.id]);
    }

    removeUser(id) {
        return this.cfx.query(`delete from chat_member where user_id=? and chat_id=?`, [id, this.id]);
    }

    containsUser(id) {
        return this.cfx.query(`select id from chat_member where user_id=? and chat_id=?`, [id, this.id])
        .then((r) => {
            return r.length > 0;
        })
    }

    addMessage(type, sender_id, content, files) {
        return new Promise((resolve) => {
            if(!files || !files.length) {
                resolve(null)
                return
            }
            this.cfx.files.createBundle(this.id, null)
            .then(bundleid => {
                this.cfx.files.saveFiles(files, id)
                resolve(bundleid)
            })
        })
        .then(bundle => {
            content = this.cfx.utils.mysql_escape(content)

            return this.cfx.query(`insert into message
            (type, sender_id, chat_id, content, bundle_id, datetime)
            values(?, ?, ?, ?, ?, now())`, [type, sender_id, this.id, content, bundle])
        })
        .then(() => {
            return this.getMessages(-1, 1);
        })
        .then(msgs => {
            this.displayMessage(msgs[0]);
        })
    }

    addMembers(userIds) {
        return this.cfx.query('select max(id) as lmid from message where chat_id=?', [this.id])
        .then((w) => {
            let lmid = w[0].lmid ?? 0
            userIds.forEach(uid => this.cfx.query(
                `insert into chat_member(chat_id, user_id, last_read, focus) 
                values(?, ?, ?, ?)`, [this.id, uid, lmid, lmid + 1]))
        })
    }

    getMessages(start, count) {
        return new Promise((resolve) => {
            if (start > -1)
                resolve()
            this.cfx.query('select max(id) as mid from message where chat_id=?', [this.id])
            .then(r => {
                start = r[0].mid
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
        return this.cfx.query(`select v.id, v.user_id as owner_id, v.chat_id,
        v.focus, v.last_read, c.is_direct as is_chat_direct, c.voice
        from chat_member v join chat c on v.chat_id=c.id where user_id=?`, [userid])
        .then(r => {
            return Promise.all(r.map(view => {
                return this.cfx.query(`select u.id, u.name, u.tag from chat_member v join user u on v.user_id=u.id where v.chat_id=? limit ?`, [view.chat_id, 4])
                .then(members => {
                    view.members = members
                    return this.cfx.query(`select m.id, m.type, m.content, m.datetime, m.sender_id, 
                    u.name as sender_name, u.tag as sender_tag,
                    (select count(*) from file f where f.bundle_id=m.bundle_id) as file_count
                    from message m left join user u on m.sender_id=u.id 
                    where chat_id=? order by id desc limit 1`, [view.chat_id])
                })
                .then(lm => {
                    lm = lm[0]
                    if (lm)
                        Object.keys(lm).forEach(k => view['lm_' + k] = lm[k])
                    return this.cfx.query(`select count(*) as unread from message where chat_id=? and id > ?`, 
                    [view.chat_id, view.last_read ?? 0])
                })
                .then(c => {
                    view.unread = c[0].unread
                })
            }))
            .then(() => {
                return r
            })
        })
    }

    getDirectChat(userid1, userid2) {
        if(userid1 == userid2)
            return Promise.resolve(null)
        return this.cfx.db.executeFile('getdirectchat', {
            user1: userid1,
            user2: userid2
        }).then(r => {
            if (r.length > 0)
                return new Chat(this.cfx, r[0].chat_id, null)
            return this.createDirectChat(userid1, userid2)
        })
    }

    createDirectChat(u1, u2) {
        return this.createChat(null, false, true, null, [u1, u2])
    }

    createGroupChat(name, isPublic, avatarId, members) {
        return this.createChat(name, isPublic, false, avatarId, members)
    }

    createChat(name, isPublic, isDirect, avatarId, members) {
        return this.cfx.query('insert into chat(name, is_public, is_direct, avatar_id) values(?, ?, ?, ?)',
        [name, isPublic, isDirect, avatarId])
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
            chat.addMessage(req.body.type, sender.id, req.body.content, req.files)
            return {success: 1}
        })
    }, cfx.core.upload.array('files'), true)

    cfx.core.safeGet('/getstickerpacks', (_, req, res) => {

        return [
            {
                name: 'coffee',
                count: 21
            }
        ]

    }, false)


    cfx.core.safePost('/createchat', (creator, req, res) => {
        return new Promise((resolve) => {
            if (!req.avatar)
                resolve(null)
            else {
                return cfx.files.saveFiles([req.file], null)
                .then(r => r.ids[0])
            }
        }).then(avatarId => {
            req.body.members ??= []
            let members = Array.isArray(req.body.members)? req.body.members : [req.body.members]
            return cfx.chats.createGroupChat(req.body.name || null, parseInt(req.body.ispublic), avatarId, members)
        }).then(chat => {
            chat.addMessage(null, creator.name + ' создал этот чат', null)
        })
        .then(() => {
            return {
                success: 1
            }
        })
    }, cfx.core.upload.single('avatar'), true)

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

    cfx.core.safeGet('/getcalltable', (user, req, res) => {
        return {
            table: temp.getTable(req.query.chatid)
        }
    }, true)

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

