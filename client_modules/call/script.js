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

        const onchange = () => {
            this.call.modifyMemberStream(this.info.id, undefined, this.volumeInput.value)
            this.updateVolumeLabel()
        }

        this.volumeInput.onchange = onchange
        this.volumeInput.oninput = onchange

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

        this.isCompact = call.savedData? call.savedData.isCompact : false
        this.areMembersShown = call.savedData? call.savedData.areMembersShown : false

        this.toggleHidden(false)
        this.toggleCompact(this.isCompact)
        this.toggleMemberList(this.areMembersShown)
        this.toggleMuted(call.savedData? call.savedData.isMuted : false)

        this.mainBar.querySelector('.toggle-list').onclick = () => {
            this.areMembersShown = !this.areMembersShown
            this.toggleMemberList(this.areMembersShown)
            this.call.save()
        }

        this.mainBar.querySelector('.toggle-muted').onclick = () => {
            this.call.toggleMyStream(this.call.isMuted)
            this.toggleMuted(this.call.isMuted)
            this.call.save()
        }

        this.mainBar.querySelector('.toggle-interface').onclick = () => {
            this.isCompact = !this.isCompact
            this.toggleCompact(this.isCompact)
            this.call.save()
        }

        this.mainBar.querySelector('.leave').onclick = () => {
            this.chat.leave()
        }

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

    toggleHidden(state) {
        utils.toggleClass(this.interface, 'hidden', state)
    }

    toggleCompact(state) {
        utils.toggleClass(this.interface, 'compact', state)
    }

    toggleMuted(state) {
        utils.toggleClass(this.interface, 'muted', state)
    }

    toggleMemberList(state) {
        utils.toggleClass(this.interface, 'hide-member-list', !state)
    }

}


class Call {
    constructor(callid, myid, savedData) {
        this.id = callid
        this.myid = myid
        this.interface = new CallInterface(this)
        this.members = {}
        this.savedData = savedData
        this.init().catch(err => {
            alert('Не удалось начать звонок: ' + err.message)
            removeCurrentCall()
        })
    }

    async init() {
        await this.accessMyStream()
        await this.loadMembers()

        socket.emit('join_call', this.id)
        this.toggleMyStream(this.savedData? !this.savedData.isMuted : true)

        this.peer = new Peer(undefined, {
            host: '/',
            port: '3001',
            secure: true
        })

        this.peer.on('open', async peerid => {
            this.peer.peerid = peerid

            let r = fetch(`/joincall?callid=${this.id}&peerid=${peerid}`).then(r => r.json())

            if(!r.success) {
                alert('Не удалось подключиться...')
                this.leave()
                return
            }

            this.interface.toggleHidden(false)
        })
    
        this.peer.on('call', call => {
            call.answer(this.myStream)
            call.on('stream', userStream => {
                let member = this.getMemberByPeerId(call.peer)
                member.call = call
                this.setMemberStream(member.id, userStream)
                this.interface.appendMember(member)
            })
        })
    }

    toggleMyStream(state) {
        this.isMuted = !state
        toggleStream(this.myStream, state)
        this.save()
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

        members.forEach(m => this.addMember(m.id, m.tag, m.name, m.peerid))
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
        this.save()
        return this.members[userid]
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

        this.save()
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
    
    destroyPeer() {

    }

    setupSocket() {
        socket.on('user_joined_chat', user => {
            if(user.id == this.myid)
                return

            let call = this.peer.call(user.peerid, this.myStream)
        
            call.on('stream', userStream => {
                if (user.id in this.members) {
                    this.members[user.id].peerid = user.peerid
                    this.members[user.id].call = call
                    this.setMemberStream(user.id, userStream)
                    return
                }
                let member = this.addMember(user.id, user.tag, user.name, user.peerid)
                member.call = call
                this.setMemberStream(user.id, userStream)
                this.interface.appendMember(member)
            })
        })

        socket.on('user_left_call', user => {
            this.removeMember(user.id)
        })
    }
    
    removeMember(userid) {
        if(!this.members[userid])
            return
        this.setMemberStream(userid, null)
        delete this.members[userid]
        this.save()
    }

    leave() {
        Object.keys(this.members).forEach(mid => {
            if(mid != this.myid)
                this.removeMember(mid)
        })
        this.interface.toggleHidden(true)
        socket.emit('end_call')
        removeCurrentCall()
    }

    save() {
        let membersToSave = {}

        Object.values(this.members).forEach(m => {
            membersToSave[m.id] = {
                id: m.id, name: m.name, tag: m.tag,
                volume: m.volume, toggle: m.toggle, peerid: m.peerid
            }
        })

        this.savedData = {
            id: this.id,
            members: membersToSave,
            isCompact: this.interface.isCompact,
            areMembersShown: this.interface.areMembersShown,
            isMuted: this.isMuted
        }
        
        saveCall(this.savedData)
    }


}

function toggleStream(stream, state) {
    stream.getAudioTracks().forEach(t => {
        t.enabled = state
    })
}

// id, members, isCompact, areMembersShown, isMuted
function saveCall(data) {
    localStorage.setItem('currentCall', JSON.stringify(data))
}

function removeCurrentCall() {
    localStorage.removeItem('currentCall')
    call = null
}

const savedCall = localStorage.getItem('currentCall')
let call = null

if(savedCall) {
    authPromise.then(() => {
        call = new Call(savedCall.id, window.me.id, savedCall)
    })
}

function startCall(id) {
    if(!window.me || call) {
        alert('Невозможно начать звонок!')
        return
    }
    call = new Call(id, window.me)
    saveCall(id, {}, false, false, false)
}