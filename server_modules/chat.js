let notifyTimeout = 750
let maxUnreadPreview = 8

class Chat {
    constructor(cfx, id, name) {
        this.cfx = cfx;
        this.id = id;
        this.name = name;
    }

    async isPublic() {
        let info = await this.getInfo(false)
        return info.is_public
    }

    containsUser(id) {
        return this.cfx.query(`select id from chat_member where user_id=? and chat_id=?`, [id, this.id])
        .then((r) => {
            return r.length > 0;
        })
    }

    containsAdmin(userid) {
        return this.cfx.query(`select * from chat_member where user_id=? and chat_id=? and is_admin=1`, [userid, this.id])
        .then(r => r.length > 0)
    }

    async toggleAdmin(userid, state, exec) {
        let r = await this.cfx.query(`update chat_member set is_admin=? where user_id=? and chat_id=?`,
            [state? 1 : 0, userid, this.id])
        
        if(r.changedRows == 0)
            throw Error('could_not_toggle_admin')

        this.cfx.socket.io.to('c:' + this.id).emit('update_member', {id: userid, is_admin: state? 1 : 0})

        if(!exec)
            return  
        
        let user = await this.cfx.auth.getUser(userid)

        if(state)
            await this.addSystemMessage(`@${exec.tag} сделал @${user.tag} админом`)
        else    
            await this.addSystemMessage(`@${exec.tag} убрал у @${user.tag} права админа`)
    }

    makeAdmin(userid, exec) {
        return this.toggleAdmin(userid, 1, exec)
    }

    removeAdmin(userid, exec) {
        return this.toggleAdmin(userid, 0, exec)
    }

    getMember(userid) {
        return this.cfx.query('select * from chat_member where user_id=? and chat_id=?', [userid, this.id])
        .then(r => r[0])
    }

    async addMessage(type, sender_id, content, files, reply_to) {
        let bundleId = null

        if(files && files.length) {
            bundleId = await this.cfx.files.createBundle(this.id, null)
            await this.cfx.files.saveFiles(files, bundleId)
        }

        await this.cfx.query(`insert into message
            (type, sender_id, chat_id, content, bundle_id, datetime, reply_to)
            values(?, ?, ?, ?, ?, now(), ?)`, [type, sender_id, this.id, content, bundleId, reply_to ?? null])

        let newMsg = await this.getMessage(-1)

        this.cfx.chats.updateBots(newMsg)
        await this.displayMessage(newMsg)
    }
    
    addSystemMessage(content) {
        return this.addMessage('system', null, content, [], null)
    }

    async addPrivateAlert(content) {
        if(!await this.isPublic())
            await this.addSystemMessage(content)
    }

    async addMembers(userids, exec) {

        let lmid = await this.cfx.query('select max(id) as lmid from message where chat_id=?', [this.id])
            .then(r => r[0].lmid ?? 0)

        for(const uid of userids) {
            let existResponse = await this.cfx.query(`select * from chat_member where chat_id=? and user_id=?`, [this.id, uid])
            
            if(existResponse.length > 0)
                continue
    
            await this.cfx.query(`insert into chat_member(chat_id, user_id, last_read, focus) values (?, ?, ?, ?)`,
                [this.id, uid, lmid, lmid + 1])
    
            let user = await this.cfx.auth.getUser(uid)
            user.is_admin = false
            user.is_owner = false

            this.cfx.socket.io.in('c:' + this.id).emit('new_member', user)
            
            if(exec) {
                await this.addMessage('system', null, `@${exec.tag} добавил @${user.tag} в чат`)
            }
        } 
    }

    async getMessages(start, count, myid, focus) {
        if(start < 0) {
            start = await this.cfx.query('select max(id) as mid from message where chat_id=?', [this.id])
            .then(r => r[0].mid)
        }

        let messagesRaw = await this.cfx.db.executeFile('getmessages', {
            start: start,
            count: count,
            chatid: this.id,
            focus: focus ?? -1
        })

        let messages = this.cfx.utils.parseArrayOutput(
            messagesRaw, 'files', {
                file_id: 'id',
                file_mimetype: 'mimetype',
                file_name: 'name'
            }, 'id', 'file_id')

        if(myid) {
            let maxlr = await this.cfx.query(`select max(last_read) as lr from chat_member 
                where chat_id=? and user_id!=?`, [this.id, myid]).then(r => r[0].lr ?? 0)
            
            for(let i = 0; i < messages.length; i++) {
                if(messages[i].sender_id != myid)
                    continue
                messages[i].read = parseInt(messages[i].id) <= maxlr
            }
        }
        
        return messages
    }

    getMessage(id, myid, focus) {
        return this.getMessages(id, 1, myid, focus)
        .then(messages => {
            let msg = messages[0]
            if(!msg || msg.id != id && id != -1 || msg.chat_id != this.id)
                return null
            return msg
        })
    }

    async updatePushNotification(userid) {
        return
        let unread = await this.getUnreadCount(userid)

        if(!unread) {
            await this.cfx.notifications.deletePushNotification(userid, 'chat:' + this.id)
        } else {
            let info = await this.getInfo()
            let messages = await this.getMessages(-1, Math.min(unread, maxUnreadPreview))

            let lines = messages.map(msg => this.cfx.clientUtils.getMessagePreview(msg, 100, true))
            let wholePreview = lines.join('\n')
            let chatname = info.name === null? this.cfx.clientUtils.generateChatName(info.members, {id: userid}, 3) : info.name
            
            return this.cfx.notifications.sendPushNotification(userid, {
                icon: '/getchatavatar?id=' + this.id,
                body: wholePreview,
                title: chatname + ` (${unread})`,
                tag: 'chat:' + this.id,
                link: '/chat?id=' + this.id
            })
        }
    }

    updateAllNotifications(userid) {
        return Promise.all([
            this.cfx.chats.updateMenuNotification(userid),
            this.updatePushNotification(userid)
        ])
    }

    notifyAllMembers() {
        return this.forEveryMember(m => this.updateAllNotifications(m.id))
    }

    updateLastRead(userid) {
        return this.cfx.query(`select * from message where chat_id=? order by id desc limit 1`, [this.id])
        .then(r => r[0])
        .then(lm => {
            if(lm.sender_id && lm.sender_id != userid)
                this.cfx.socket.io.in('u:' + lm.sender_id).emit('last_read', {id: lm.id, chatid:this.id, reader: userid})
            return this.cfx.query(`update chat_member set last_read=? where user_id=? and chat_id=?`, [lm.id, userid, this.id])
        })
        .then(() => {
            return this.updateAllNotifications(userid)
        })
    }

    getUnreadCount(userid) {
        return this.cfx.query(`select last_read from chat_member where chat_id=? and user_id=?`, [this.id, userid])
        .then(r => {
            let last_read = r.length? r[0].last_read ?? 0 : 0
            return this.cfx.query(`select count(*) as unread from message where chat_id=? and id > ?`, [this.id, last_read])
        })
        .then(r => {
            return r[0].unread ?? 0
        })
    }

    displayMessage(msg) {
        return this.forEveryMember(m => {
            this.cfx.socket.io.in('u:' + m.id).emit('message', msg)
            setTimeout(() => this.updateAllNotifications(m.id), notifyTimeout)
        })
    
    }

    deleteMessage(msgid, userid) {
        return this.cfx.query(`select * from message where id=?`, [msgid])
        .then(r => r[0])
        .then(msg => {
            if(!msg)
                throw Error('invalid id')
            else if(msg.chat_id != this.id)
                throw Error('That message does not belong to the chat')
            else if(msg.sender_id != userid)
                throw Error('Lacking permissions')
            return this.cfx.query(`delete from message where id=?`, [msgid])
        })
        .then(() => {
            return this.forEveryMember(m => {
                this.cfx.socket.io.in('u:' + m.id).emit('delete_message', {
                    chatid: this.id,
                    msgid: msgid
                })
                setTimeout(() => this.updateAllNotifications(m.id), notifyTimeout)
            })
        })
    }

    getInfo(members=true) {
        if(!members) {
            return this.cfx.query(`select * from chat where id=?`, [this.id])
            .then(r => r[0])
        }

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

    async getView(userid) {
        let memberDetails = await this.getMemberDetails(userid)
        let info = await this.getInfo()
        let messages = await this.getMessages(-1, 1, userid, memberDetails.focus)

        info.lm = messages[0]

        info.unread = await this.getUnreadCount(userid)
        info.focus = memberDetails.focus
        info.last_read = memberDetails.last_read

        return info
    }

    forEveryMember(cb) {
        return this.getInfo()
        .then(info => {
            return Promise.all(info.members.map(cb))
        })
    }

    async getDistanceBetweenMessages(id1, id2) {
        // id1 exists, checking for id2
        let r = await this.cfx.query('select * from message where id=?', [id2])
        
        if(!r.length)
            return -1

        let a = Math.min(parseInt(id1), parseInt(id2))
        let b = Math.max(parseInt(id1), parseInt(id2))

        r = await this.cfx.query('select count(*) as count from message where id > ? and id <= ? and chat_id=?', [a, b, this.id])

        return r[0].count
    }

    async changeInfo(changes) {
        if(changes.name !== undefined) {
            this.name = changes.name
            await this.cfx.query(`update chat set name=? where id=?`, [changes.name, this.id])
        }
        if (changes.avatarId !== undefined) {
            await this.cfx.query(`update chat set avatar_id=? where id=?`, [changes.avatarId, this.id])
        }
        if(changes.description) {
            await this.cfx.query(`update chat set description=? where id=?`, [changes.description, this.id])
        }
        if(changes.isPublic !== undefined) {
            await this.cfx.query(`update chat set is_public=? where id=?`, [changes.isPublic? 1 : 0, this.id])
        }

        this.cfx.socket.io.to('c:' + this.id).emit('update_info', {})
    }

    getFilesWithMimetype(...mt) {
        let k = mt.map(w => `"${w}"`).join(',')
        return this.cfx.query(`select f.id, f.name, f.mimetype, m.id as message_id from bundle b join file f on b.id=f.bundle_id
            join message m on m.bundle_id=b.id where b.chat_id=? and f.mimetype in (${k})`, [this.id])
    }

    async prepareToBeDeleted() {
        await this.cfx.socket.io.to('c:' + this.id).emit('eject_the_fuck_out')

        // removing all notifications by reading all remaining messages
        await this.cfx.query(`update chat_member set last_read=(select max(id) from message) where chat_id=?`, [this.id])
        await this.notifyAllMembers()
    }

    async clearHistory(userid) {
        let mxid = await this.cfx.query(`select max(id) as mxid from message where chat_id=?`, [this.id]).then(r => r[0].mxid)
        await this.cfx.query(`update chat_member set focus=? where chat_id=? and user_id=?`, [mxid + 1, this.id, userid])
        return this.deleteUnreachableMessages()
    }

    getMemberDetails(userid) {
        return this.cfx.query(`select * from chat_member where user_id=? and chat_id=?`, [userid, this.id])
        .then(r => {
            let d = r[0] ?? {}
            d.focus ??= 0
            d.last_read ??= 0
            return d
        })
    }

    async deleteUnreachableMessages() {
        let earliestFocusedMsgId = await this.cfx.query(`select min(focus) as mf from chat_member where chat_id=?`, [this.id])
            .then(r => r[0].mf ?? 0)
        return this.cfx.query(`delete from message where chat_id=? and id < ?`, [this.id, earliestFocusedMsgId])
    }

    transferOwnership(userid) {
        return this.cfx.query(`update chat set owner_id=? where id=?`, [userid, this.id])
    }

    async isOwner(userid) {
        let info = await this.getInfo(false)
        return userid == info.owner_id
    }

    async removeMember(userid, exec) {
        let info = await this.getInfo(false)

        //ownership transferring

        if(info.owner_id == userid) {
            let otherAdmins = await this.cfx.query(`select * from chat_member where chat_id=? and user_id!=? and is_admin=1`, [this.id, userid])
            
            if(!otherAdmins.length)
                throw Error('no_possible_owner')
            
            await this.transferOwnership(otherAdmins[0].user_id)
        }

        // member deletion

        let r = await this.cfx.query(`delete from chat_member where chat_id=? and user_id=?`, [this.id, userid])
        
        if(r.affectedRows == 0)
            throw Error('could_not_delete')

        let hasMembers = this.cfx.query(`select * from chat_member where chat_id=? and user_id=? limit 1`, [this.id, userid])
            .then(r => r.length > 0)

        this.cfx.socket.io.to('c:' + this.id).emit('member_left', {id: userid})

        // chat deletion
        if(!hasMembers) {
            await this.cfx.chats.deleteChat(this.id)
            return
        }

        // msg
        if(exec && exec.id == userid) {
            await this.addSystemMessage(`@${exec.tag} покинул чат`)
        } else if(exec) {
            let target = await this.cfx.auth.getUser(userid)
            await this.addSystemMessage(`@${exec.tag} выгнал @${target.tag}`)
        }

        // msg deletion
        await this.deleteUnreachableMessages()
    }

}

class Stickerpacks {
    constructor(cfx) {
        this.cfx = cfx
    }

    getAvailableStickerpacks(userid) {
        return this.getAllStickerpacks(userid)
        .then(stickerpacks => {
            return stickerpacks.filter(s => s.available)
        })
    }

    getAllStickerpacks(userid) {
        return this.cfx.query(`select sp.*, (sp.price=0 or ow.id is not null) as available
        from stickerpack sp left join (select * from stickerpack_ownership where user_id=?) ow
        on sp.id=ow.stickerpack_id`, [userid ?? null])
    }

    hasStickerpack(userid, spid) {
        return this.getAvailableStickerpacks(userid)
        .then(spacks => {
            return spacks.some(w => w.id == spid)
        })
    }

    getStickerpack(spid) {
        return this.cfx.query(`select * from stickerpack where id=?`, [spid])
        .then(r => r[0])
    }

    addStickerpack(userid, spid) {
        return this.hasStickerpack(userid, spid)
        .then(w => {
            if(w)
                throw Error('User already has the stickerpack')
            return this.cfx.query(`insert into stickerpack_ownership(user_id, stickerpack_id) values(?, ?)`, [userid, spid])
        })
    }

    buyStickerpack(userid, spid) {
        if(!userid)
            throw Error('User must be authorized')
        return this.hasStickerpack(userid)
        .then(w => {
            if(w)
                throw Error('User already has the stickerpack')
            return this.getStickerpack(spid)
        })
        .then(spack => {
            if (!spack)
                throw Error('Unknown stickerpack')
            else if(spack.price == 0)
                throw Error('The stickerpack is free')
            return this.cfx.ebank.purchase(userid, spack.price, 'Стикерпак')
        })
        .then(() => {
            // Success
            return this.addStickerpack(userid, spid)
        })
    }

}

class ChatSystem {
    constructor(cfx) {
        this.cfx = cfx
        this.chats = {}
        this.bots = {}
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

    getChatsOfUser(userid) {
        return this.cfx.query(`select c.id, c.name from chat_member cm join chat c on cm.chat_id=c.id where cm.user_id=?`, [userid])
        .then(r => r.map(w => new Chat(this.cfx, w.id, w.name)))
    }

    getChatViews(userid) {
        return this.getChatsOfUser(userid)
        .then(chats => Promise.all(chats.map(c => c.getView(userid))))
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
        return this.createChat(null, '', false, true, null, [u1, u2], null)
    }

    createGroupChat(name, description, isPublic, avatarId, members, exec) {
        return this.createChat(name, description, isPublic, false, avatarId, members, exec)
    }

    async createChat(name, description, isPublic, isDirect, avatarId, members, exec) {
        let ownerId = exec && !isDirect? exec.id : null
        let r = await this.cfx.query('insert into chat(name, description, is_public, is_direct, avatar_id, owner_id) values(?, ?, ?, ?, ?, ?)',
            [name, description, isPublic, isDirect, avatarId, ownerId])
        
        let chat = new Chat(this.cfx, r.insertId, name)
        await chat.addMembers(members??[])
        
        if(exec && !isDirect) {
            await chat.makeAdmin(exec.id)
            await chat.addSystemMessage(`@${exec.tag} создал этот чат`)
        }

        return chat
    }

    async accessChat(user, chatid, admin=false) {
        let chat = await this.getChat(chatid)

        if(!chat)
            throw new Error('Chat was not found')

        if(admin && await chat.containsAdmin(user.id))
            return chat
        else if (admin)
            throw new Error('The user is not an admin in the chat')

        if(await chat.containsUser(user.id))
            return chat
        else if(await chat.isPublic()) {
            await chat.addMembers([user.id])
            return chat
        }
        else
            throw new Error('User is not in the chat')

    }
    
    updateMenuNotification(userid) {
        return this.cfx.notifications.sendSpecificUnread(userid, 'messages')
    }

    getPublicChats() {
        return this.cfx.query(`select * from chat where is_public=1`)
        .then(r => r.map(ri => new Chat(this.cfx, ri.id, ri.name)))
    }

    async deleteChat(id) {
        let chat = await this.getChat(id)
        await chat.prepareToBeDeleted()
        await this.cfx.query(`delete from chat where id=?`, chat.id)
    }

    addBot(id, socket) {
        this.bots[id] = socket
    }
    
    async updateBots(msg) {
        let chat = await this.getChat(msg.chat_id)

        Object.keys(this.bots).forEach(async botid => {
            if(botid == msg.sender_id || !await chat.containsUser(botid))
                return
            this.bots[botid].emit('message', msg)
            chat.updateLastRead(botid)
        })
    }

    removeBot(id) {
        delete this.bots[id]
    }
}

exports.init = (cfx) => {
    if(!cfx.socket || !cfx.files || !cfx.notifications)
        return true

    cfx.chats = new ChatSystem(cfx);
    cfx.stickerpacks = new Stickerpacks(cfx)

    cfx.notifications.addUnreadChecker('messages', userid => {
        return cfx.db.executeFile('unreadchats', {userid: userid})
        .then(r => {
            return r.length? r[0].count ?? 0 : 0
        })
    })

    cfx.socket.onSocket(socket => {
        socket.on('join-chat', chatid => {
            socket.join('c:' + chatid)
        })

        socket.on('activate_bot_api', async (auth) => {

            let user = await cfx.auth.getUser(null, auth.tag)
            
            if(!user || !await cfx.auth.comparePassword(user.id, auth.password)) {
                cfx.socket.disconnectWithError(socket, 'Wrong credentials')
                return
            }

            console.log('BOT CONNECTED: ' + user.tag)

            cfx.chats.addBot(user.id, socket)

            socket.on('disconnect', () => {
                cfx.chats.removeBot(user.id)
            })
        })
    })

    cfx.core.safePost('/sendmsgapi', async (_, req, res) => {
        let user = await cfx.auth.getUser(null, req.body.tag)
        if(!user && !await cfx.auth.comparePassword(user.id, req.body.password))
            throw Error('Wrong credentials')
        let chat = await cfx.chats.accessChat(user, req.body.chat_id)
        if(!chat)
            throw Error('Invalid chat')
        await chat.addMessage(req.body.type ?? 'default', user.id, req.body.content, 
            [], req.body.reply_to) 
        return {success: 1}
    })

    cfx.core.safePost('/sendmsg', async (sender, req, res) => {
        let chat = await cfx.chats.accessChat(sender, req.query.id)
        if(!chat)
            throw Error('Invalid chat')
        await chat.addMessage(req.body.type, sender.id, req.body.content, 
            req.files, req.body.reply_to)
        return {success: 1}
    }, cfx.core.upload.array('files'), true)



    cfx.core.safeGet('/makeadmin', (exec, req, res) => {
        return cfx.chats.accessChat(exec, req.query.chatid, true)
        .then(chat => {
            return chat.makeAdmin(req.query.userid, exec)
        })
        .then(() => {
            return {success: 1}
        })
    })

    cfx.core.safeGet('/removemember', async (exec, req, res) => {
        let chat = await cfx.chats.accessChat(exec, req.query.chatid, true)

        if(await chat.isOwner(req.query.userid))
            throw Error('cannot_edit_owner')

        await chat.removeMember(req.query.userid, exec)
        return {success: 1}
    }, true)

    cfx.core.safeGet('/removeadmin', async (exec, req, res) => {
        let chat = await cfx.chats.accessChat(exec, req.query.chatid, true)

        if(await chat.isOwner(req.query.userid))
            throw Error('cannot_edit_owner')

        await chat.removeAdmin(req.query.userid, exec)
        return {success: 1}
    })

    cfx.core.safeGet('/leavechat', (exec, req, res) => {
        return cfx.chats.accessChat(exec, req.query.id)
        .then(chat => {
            return chat.removeMember(exec.id, exec)
        })
        .then(() => {
            return {success: 1}
        })
    }, true)

    cfx.core.safeGet('/addmembers', (exec, req, res) => {
        return cfx.chats.accessChat(exec, req.query.chatid, true)
        .then(chat => {
            let ids = req.query.ids.split(',').map(w => parseInt(w))
            return chat.addMembers(ids, exec)
        })
        .then(() => {
            return {success: 1}
        })
    }, true)

    cfx.core.safeGet('/getmemberdetails', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            return chat.getMemberDetails(req.query.userid)
        })
    }, true)

    cfx.core.safeGet('/clearhistory', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            return chat.clearHistory(user.id)
        })
        .then(() => {
            return {success: 1}
        })
    }, true)

    cfx.core.safePost('/changechatinfo', async (user, req, res) => {
        let chat = await cfx.chats.accessChat(user, req.query.chatid, true)
        let avatarBlob = req.file
        let changes = {}

        if(req.body.deleteAvatar)
            changes.avatarId = null
        else if (avatarBlob) {
            changes.avatarId = await cfx.files.saveFiles([avatarBlob], null)
                .then(r => r[0])
        }

        changes.name = req.body.deleteName? null: req.body.name
        changes.description = req.body.description
        changes.isPublic = req.body.isPublic === undefined?
            undefined : parseInt(req.body.isPublic)

        await chat.changeInfo(changes)

        return {success: 1}
    }, cfx.core.upload.single('avatar'), true)

    cfx.core.safeGet('/deletechat', async (user, req, res) => {
        let chat = await cfx.chats.accessChat(user, req.query.id)
        let info = await chat.getInfo()
        let isAdmin = await chat.containsAdmin(user.id)

        if (!info.is_direct && !isAdmin)
            throw Error('The user cannot delete the chat')

        await cfx.chats.deleteChat(chat.id)
        return {success: 1}
    })

    cfx.core.safeGet('/getfilesmt', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            let mt = req.query.mt.split(',')
            return chat.getFilesWithMimetype(...mt)
        })
    }, true)

    cfx.core.safeRender('/publicchatlist', (user, req, res) => {
        return cfx.chats.getPublicChats()
        .then(chats => {
            return Promise.all(chats.map(c => c.getInfo()))
        })
        .then(infoArr => {
            return {
                render: 'public_chat_list',
                chats: infoArr,
                observer: user
            }
        })
    }, false)

    cfx.core.safeGet('/deletemessage', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            return chat.deleteMessage(parseInt(req.query.msgid), user.id)
        })
        .then(() => {
            return {success:1}
        })
    }, true)

    cfx.core.safeGet('/getreadersofmessage', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then((chat) => {
            return cfx.query(`select u.id, u.tag, u.name from chat_member cm 
            join user u on cm.user_id=u.id where cm.chat_id=? and cm.last_read >= ?`, [chat.id, parseInt(req.query.msgid)])
        })
    }, true)

    cfx.core.safeGet('/settypingstatus', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            cfx.socket.io.in('c:' + chat.id).emit('typing_status', {
                id: user.id, 
                status: parseInt(req.query.status)
            })
            return {success:1}
        })
    }, true)

    cfx.core.safeGet('/readmessages', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            return chat.updateLastRead(user.id)
        })
        .then(() => {
            return {success:1}
        })
    }, true)

    cfx.core.safePost('/createchat', async (creator, req, res) => { 
        let avatarId = req.file? await cfx.files.saveFiles([req.file], null).then(r => r[0]) : null
        let members = Array.isArray(req.body.members)? req.body.members : [req.body.members]

        let chat = await cfx.chats.createGroupChat(
            req.body.nullName? null : req.body.name,
            req.body.description,
            parseInt(req.body.isPublic),
            avatarId, members, creator
        )
        return {success: 1}
    }, cfx.core.upload.single('avatarBlob'), true)

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
                let chatid = parseInt(req.query.id) || 0
                let capyGroupId = chatid % 10
                res.redirect(`/public/chatavatar/${capyGroupId}.png`)
            }
        })
    }, false)

    cfx.core.safeGet('/getchatviews', (user, req, res) => {
        return cfx.chats.getChatViews(user.id)
    }, true)

    cfx.core.safeGet('/getchatview', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => chat.getView(user.id))
    })

    cfx.core.safeRender('/chatlist', (user, req, res) => {
        return {
            render: 'chatlist'
        }
    }, true)

    cfx.core.safeRender('/chat', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            return {
                render: 'chat'
            }
        })
    }, true)

    cfx.core.safeGet('/getchatinfo', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.id)
        .then(chat => {
            return chat.getInfo(req.query.members === '0'? false : true)
        })
    }, false)

    cfx.core.safeGet('/getmessage', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            return chat.getMessage(req.query.msgid, user.id)
        })
    }, true)

    cfx.core.safeGet('/getdistancebetweenmsgs', (user, req, res) => {
        return cfx.chats.accessChat(user, req.query.chatid)
        .then(chat => {
            return chat.getDistanceBetweenMessages(
                parseInt(req.query.id1), 
                parseInt(req.query.id2))
        })
        .then(d => {
            return {
                distance: d
            }
        })
    }, true)

    cfx.core.safeGet('/getmessages', async (user, req, res) => {
        let chat = await cfx.chats.accessChat(user, req.query.chatid)
        let member = await chat.getMember(user.id)
        let start = parseInt(req.query.start)
        let count = parseInt(req.query.count)

        return chat.getMessages(start, count, user.id, member.focus)
    }, true)

    cfx.core.safeRender('/direct', (user, req, res) => {
        return cfx.chats.getDirectChat(user.id, req.query.with)
        .then(chat => {
            res.redirect('/chat?id=' + chat.id)
        })
    }, true)

    cfx.core.safeGet('/getallstickerpacks', (user, req, res) => {
        return cfx.stickerpacks.getAllStickerpacks(user? user.id : null)
    }, false)

    cfx.core.safeGet('/getavailablestickerpacks', (user, req, res) => {
        return cfx.stickerpacks.getAvailableStickerpacks(user? user.id : null)
    }, false)

    cfx.core.safeRender('/stickerpacks', (user, req, res) => {
        return {
            render: 'stickerpacks'
        }
    }, true)

    cfx.core.safeGet('/buystickerpack', (user, req, res) => {
        return cfx.stickerpacks.buyStickerpack(user.id, req.query.id)
        .then(() => {
            return {success:1}
        })
    }, true)

}

