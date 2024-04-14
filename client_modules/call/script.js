class CallMemberControls {
    constructor(info) {
        this.info = info
        this.element = templateManager.createElement('call-member', info)

    }


    destroy() {
        this.element.remove()
    }
}



class CallInterface {
    constructor(call) {
        this.call = call
        this.interface = document.querySelector('.call-interface')
        this.mainBar = this.interface.querySelector('.main-bar')
        this.memberList = this.interface.querySelector('.member-list')
        this.memberControls = {}
    }

    appendMember(member) {
        //if(member.id == this.call.myid)
        //    return
        
        let controls = new CallMemberControls(member)
        this.memberControls[member.id] = controls
        this.memberList.appendChild(controls.element)
    }

    removeMember(userid) {
        this.memberControls[userid].destroy()
        delete this.memberControls[userid]
    }

    toggleCompact(state) {
        if(state)
            this.interface.classList.add('compact')
        else
            this.interface.classList.remove('compact')
    }

}


class Call {
    constructor(callid, myid) {
        this.id = callid
        this.myid = myid
        this.interface = new CallInterface(this)
        this.members = {}

        this.init()
    }

    async init() {
        await this.accessMyStream()
        await this.loadMembers()

        socket.emit('join_call', this.id)

        this.interface.appendMember(window.me)


        this.isCompact = true

        this.toggleCompact(true)

        this.mainBar.querySelector('.toggle-interface').onclick = () => {
            this.isCompact = !this.isCompact
            this.toggleCompact(this.isCompact)
        }
    }

    async accessMyStream() {
        this.myStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false}).catch(() => null)

        if(!this.myStream)
            throw Error('CANNOT_GET_STREAM')
    }

    async loadMembers() {
        let members = await fetch('/getcallmembers?id=' + this.id).then(r => r.json())

        if(members.error)
            throw Error('CANNOT_GET_MEMBERS')
        else if(myid in members)
            throw Error('USER_IN_THE_CALL')

        members.forEach(m => {
            this.
            m.muted = false
            m.volume = 100
        })
    }

    getMemberByPeerId(peerid) {
        return Object.values(this.members).find(m => m.peerid == peerid)
    }

    addMember(userid, tag, name) {
        if(this.members[userid])
            return
        this.members[userid] = {
            id: userid,
            tag: tag,
            name: name
        }
    }

    setMemberStream(userid, stream) {

    }

    setupPeer() {
        this.peer = new Peer(undefined, {
            host: '/',
            port: '3001',
            secure: true
        })

        this.peer.on('open', peerid => {
            this.peer.peerid = peerid
            fetch(`/joincall?callid=${this.id}&peerid=${peerid}`)
            .then(r => r.json())
            .then(r => {
                if (!r.success) {
                    this.destroyPeer()
                    throw Error('CANNOT_CONNECT')
                    return
                }
                this.interface.updateHeaderCallButtons(true)
                this.interface.showControls()
            })
        })
    
        this.peer.on('call', call => {
            call.answer(this.myStream)
            call.on('stream', userStream => {
                console.log('connected to me: ' + call.peer)
                this.connectToMember(call, userStream)
            })
        })
    }


    updateMemberStream(toggle, volume) {


    }

    setupSocket() {
        socket.on('user_joined_chat', user => {

        })

        socket.on('user_left_chat', user => {

        })
    }

    disconnectFromMember(userid) {

    }

    leave() {

    }


}

authPromise.then(user => {
    const call = new Call(0, window.me.id)
})
