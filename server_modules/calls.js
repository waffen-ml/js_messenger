const secondsToReconnect = 3

class Call {
    constructor(cfx, id) {
        this.id = id
        this.cfx = cfx
        this.members = {}
    }

    getMemberInfo(userid) {
        if(!this.members[userid])
            return null
        return {  
            id: this.members[userid].id,
            name: this.members[userid].name,
            tag: this.members[userid].tag,
            peerid: this.members[userid].peerid
        }
    }
    
    getAllMembersInfo() {
        let result = {}
        Object.keys(this.members).forEach(mid => {
            result[mid] = this.getMemberInfo(mid)
        })
        return result
    }

    setSocket(userid, socket) {
        if(!this.members[userid])
            this.members[userid].socket = socket
    }

    async connectMember(userid, peerid, sessionid, socket) {
        let member = this.members[userid]

        if(member) {
            if(member.sessionid != sessionid || !member.leaveTimeout) 
                throw Error('unable to connect')

            if(member.leaveTimeout) {
                clearTimeout(member.leaveTimeout)
                member.leaveTimeout = null
            }
        }

        let info = await this.cfx.auth.getUser(userid)

        if(Object.keys(this.members).length == 0) {
            let chat = await this.cfx.chats.accessChat({id: userid}, this.id)
            chat.addSystemMessage(`@${info.tag} начал звонок`)
        }

        this.members[userid] = {
            id: userid,
            name: info.name,
            tag: info.tag,
            peerid: peerid,
            socket: socket,
            leaveTimeout: null,
            sessionid: sessionid
        }
        this.cfx.socket.io.to('cl:' + this.id).emit('user_joined_call', this.getMemberInfo(userid))
    }

    disconnectMember(userid) {
        let member = this.members[userid]
        if(!member)
            return
        if(member.socket)
            member.socket.leave('cl:' + this.id)
        this.cfx.socket.io.to('cl:' + this.id).emit('user_left_call', {id: userid})
        delete this.members[userid]
    }

    end() {
        Object.keys(this.members).forEach(mid => this.disconnectMember(mid))
    }
}

class CallSystem {
    constructor(cfx) {
        this.cfx = cfx
        this.calls = {}
    }

    getCall(id, create=true) {
        if(!this.calls[id] && create)
            this.calls[id] = new Call(this.cfx, id)
        return this.calls[id] ?? null
    }

    terminateCall(id) {
        this.getCall(id).end()
        delete this.calls[id]
    }

    accessCall(userid, callid) {
        return this.cfx.chats.accessChat({id: userid}, callid)
        .then(() => {
            return this.getCall(callid)
        })
        .catch(() => {
            throw Error('User cannot join the call')
        })
    }

}

exports.init = (cfx) => {
    cfx.calls = new CallSystem(cfx)

    cfx.core.safeGet('/getcallmembers', async (user, req, res) => {
        let call = await cfx.calls.accessCall(user.id, req.query.id)
        return call.getAllMembersInfo()
    }, true)

    cfx.core.safeGet('/joincall', async (user, req, res) => {
        let call = await cfx.calls.accessCall(user.id, req.query.callid)
        await call.connectMember(user.id, req.query.peerid, req.sessionID)
        return {success: 1}
    }, true)

    cfx.socket.onSocket((socket, userid) => {
        socket.on('join_call', (callid) => {
            let call = cfx.calls.getCall(callid, false)

            if(!call || !call.members[userid] || call.members[userid].socket)
                return

            call.setSocket(userid, socket)
            socket.join('cl:' + callid)

            socket.on('end_call', () => {
                call.disconnectMember(userid)
            })
            socket.on('disconnect', () => {
                if(!call.members[userid])
                    return
                call.members[userid].leaveTimeout = setTimeout(() => {
                    call.disconnectMember(userid)
                }, secondsToReconnect * 1000)
            })

        })
    })

}