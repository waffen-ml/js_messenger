
class Call {
    constructor(cfx, id) {
        this.id = id
        this.cfx = cfx
        this.members = {}
    }

    async connectMember(userid, sessionid) {
        if(this.members[userid])
            throw Error('User is already in the call')

        let info = await this.cfx.auth.getUser(userid)
        this.members[userid] = {
            id: userid,
            name: info.name,
            tag: info.tag,
            session: sessionid
        }

        this.cfx.socket.io.to('cl:' + this.id).emit('user_joined_call', this.members[userid])
    }

    disconnectMember(userid) {
        if(!this.members[userid])
            throw Error('There is no such user in the call')
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

    getCall(id) {
        if(!this.calls[id])
            this.calls[id] = new Call(cfx, id)
        return this.calls[id]
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
}