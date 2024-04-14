const secondsToReconnect = 3

class Call {
    constructor(cfx, id) {
        this.id = id
        this.cfx = cfx
        this.members = {}
        this.leaveTimeouts = {}
    }

    async connectMember(userid, peerid, sessionid) {

        if(this.leaveTimeouts[userid]) {
            clearTimeout(this.leaveTimeouts[userid])
            delete this.leaveTimeouts[userid]
        }

        let info = await this.cfx.auth.getUser(userid)
        this.members[userid] = {
            id: userid,
            name: info.name,
            tag: info.tag,
            session: sessionid,
            peerid: peerid
        }

        this.cfx.socket.io.to('cl:' + this.id).emit('user_joined_call', this.members[userid])
    }

    disconnectMember(userid) {
        if(!this.members[userid])
            return
        delete this.members[userid]
        this.cfx.socket.io.to('cl:' + this.id).emit('user_left_call', {id: userid})
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
        return call.members
    }, true)

    cfx.core.safeGet('/joincall', async (user, req, res) => {
        let call = await cfx.calls.accessCall(user.id, req.query.callid)
        await call.connectMember(user.id, req.query.peerid, req.sessionID)
        return {success: 1}
    }, true)

    cfx.socket.onSocket((socket, userid) => {
        socket.on('join_call', (callid) => {
            let call = cfx.calls.getCall(callid, false)

            if(!call || !call.members[userid])
                return

            socket.join('cl:' + callid)

            socket.on('end_call', () => {
                call.disconnectMember(userid)
            })
            socket.on('disconnect', () => {
                call.leaveTimeouts[userid] = setTimeout(() => {
                    call.disconnectMember(userid)
                }, secondsToReconnect * 1000)
            })

        })
    })

}