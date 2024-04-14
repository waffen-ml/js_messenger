function toggleStream(stream, state) {
    stream.getAudioTracks().forEach(t => {
        t.enabled = state
    })
}

class CallMemberControls {
    constructor(info, call) {
        this.call = call
        this.info = info
        this.element = templateManager.createElement('call-member', info)
        this.muteButton = this.element.querySelector('.button.toggle-muted')
        this.volumeLabel = this.element.querySelector('.volume .perc')
        this.volumeInput = this.element.querySelector('.volume input')

        this.muteButton.addEventListener('click', () => {
            this.call.modifyMemberStream(this.info.id, !this.info.toggle)
            this.updateMuted()
        })

        this.volumeInput.addEventListener('change', () => {
            this.call.modifyMemberStream(this.info.id, undefined, this.volumeInput.value)
            this.updateVolumeLabel()
        })

        this.updateVolumeLabel()
        this.updateMuted()
    }


    updateVolumeLabel() {
        this.volumeLabel.textContent = (this.info.volume ?? 100) + '%'
    }

    updateMuted() {
        if(!this.info.toggle)
            this.element.classList.add('muted')
        else
            this.element.classList.remove('muted')
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
        
        let controls = new CallMemberControls(member, this.call)
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

        this.interface.appendMember(window.me)
        //this.init()
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

        members.forEach(m => {

        })
    }

    addMember(userid, tag, name, peerid) {
        if(this.members[userid])
            return
        this.members[userid] = {
            id: userid,
            tag: tag,
            name: name,
            peerid: peerid
        }   
    }

    modifyMemberStream(userid, toggle, volume) {
        let member = this.members[userid]
        if(!member || !member.stream)
            return

        member.volume = volume ?? member.volume
        member.toggle = toggle ?? member.toggle

        if(!member.toggle)
            member.audio.volume = 0
        else
            member.audio.volume = member.volume / 100
    }

    setMemberStream(userid, stream) {
        let member = this.members[userid]
        if(!member)
            return
        if(member.stream) {
            toggleStream(member.stream, false)
            member.audio.remove()
        }
        member.stream = stream
        member.audio = document.createElement('audio')
        member.audio.autoplay = true
        member.audio.srcObject = stream
        this.modifyMemberStream(userid, member.toggle ?? true, member.volume ?? 100)
    }

    getMemberByPeerId(peerid) {
        return Object.values(this.members).find(m => m.peerid == peerid)
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


    updateMemberStream(userid, toggle, volume) {

    }

    replaceMemberStream(userid, newStream) {

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
