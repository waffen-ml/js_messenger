class CallMemberControls {
    constructor(info, call) {
        this.call = call
        this.info = info
        this.element = templateManager.createElement('call-member', info)
        this.muteButton = this.element.querySelector('.button.toggle-muted')
        this.volumeLabel = this.element.querySelector('.volume .perc')
        this.volumeInput = this.element.querySelector('.volume input')

        if(info.id == this.call.myid) {
            this.element.classList.add('me')
            return
        }

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
        utils.toggleClass(this.element, 'muted', !this.info.toggle)
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

        this.mainBar.querySelector('.chat-info').href = '/chat?id=' + this.call.id

        this.mainBar.querySelector('.toggle-list').onclick = () => {
            this.areMembersShown = !this.areMembersShown
            this.toggleMemberList(this.areMembersShown)
            this.call.save()
        }

        this.mainBar.querySelector('.toggle-muted').onclick = () => {
            console.log(this.call.isMuted)
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
            this.call.leave()
        }

        this.loadTitle().then(() => {
            this.mainBar.querySelector('.chat-info .chat-name').textContent = this.title
        })

        this.mainBar.querySelector('.chat-info .chat-avatar').src = '/getchatavatar?id=' + this.call.id

        this.memberList.innerHTML = ''
    }

    async loadTitle() {
        if(this.call.savedData) {
            this.title = this.call.savedData.title
            return
        }

        let chatInfo = await fetch('/getchatinfo?id=' + this.call.id).then(r => r.json())
        this.title = utils.generateChatName(chatInfo.members, {id: this.call.myid}, 5)
    }

    updateMemberCount() {
        let mcount = Object.keys(this.call.members).length
        this.interface.querySelector('.chat-info .member-count').textContent =
            utils.nItemsLabel(mcount, 'участник', 'участника', 'участников')
    }

    addMember(member) {
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
        utils.toggleClass(this.mainBar, 'muted', state)
    }

    toggleMemberList(state) {
        utils.toggleClass(this.interface, 'hide-member-list', !state)
    }

}

class Call {
    constructor(callid, me, savedData) {
        this.id = callid
        this.me = me
        this.myid = me.id
        this.interface = new CallInterface(this)
        this.members = []

        this.updateMember(this.myid, me.tag, me.name, null)

        this.savedData = savedData
        this.init().catch(err => {
            alert('Не удалось начать звонок: ' + err.message)
            removeCurrentCall()
            this.leave()
        })
    }

    async init() {
        await this.accessMyStream()
        await this.loadMembers()
        this.setupSocket()
        
        this.toggleMyStream(this.savedData? !this.savedData.isMuted : true)

        this.peer = new Peer(undefined, {
            host: '/',
            port: 3004,
            secure: true
        })

        this.peer.on('open', async peerid => {
            this.peer.peerid = peerid

            let r = await fetch(`/joincall?callid=${this.id}&peerid=${peerid}`).then(r => r.json())

            if(!r.success) {
                alert('Не удалось подключиться...')
                this.leave()
                return
            }
            socket.emit('join_call', this.id)
            this.interface.toggleHidden(false)
        })
    
        this.peer.on('call', call => {
            call.answer(this.myStream)
            call.on('stream', userStream => {
                let member = this.getMemberByPeerId(call.peer)
                this.fullyUpdateMember(member, userStream, call)
            })
        })

        this.save()
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

        Object.values(members).forEach(m => {
            this.updateMember(m.id, m.tag, m.name, m.peerid)
        })
    }

    getSavedMember(userid) {
        if(this.savedData && this.savedData.members[userid])
            return this.savedData.members[userid]
    }

    updateMember(userid, tag, name, peerid) {
        if(this.members[userid]) {
            this.members[userid].peerid = peerid
        }
        else {
            this.members[userid] = {
                id: userid,
                tag: tag,
                name: name,
                peerid: peerid,
                toggle: true,
                volume: 100
            }

            let sm = this.getSavedMember(userid)

            if(sm)
                this.modifyMemberStream(userid, sm.toggle, sm.volume)
            
            this.interface.addMember(this.members[userid])
        }
        this.interface.updateMemberCount()
        this.save()
        return this.members[userid]
    }

    fullyUpdateMember(member, stream, call) {
        this.updateMember(member.id, member.tag, member.name, member.peerid)
        this.setMemberCall(member.id, call)
        this.setMemberStream(member.id, stream)
    }

    setMemberCall(userid, call) {
        if(this.members[userid])
            this.members[userid].call = call
    }

    modifyMemberStream(userid, toggle, volume) {
        let member = this.members[userid]

        if(!member)
            return

        member.volume = volume ?? member.volume
        member.toggle = toggle ?? member.toggle

        this.save()

        if(!member.stream)
            return

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

    setupSocket() {
        socket.on('user_joined_call', user => {
            if(user.id == this.myid)
                return

            let call = this.peer.call(user.peerid, this.myStream)
        
            call.on('stream', userStream => {
                this.fullyUpdateMember(user, userStream, call)
            })
        })

        socket.on('user_left_call', user => {
            this.removeMember(user.id)
        })
    }

    destroyPeer() {

    }
    
    removeMember(userid) {
        if(!this.members[userid])
            return
        this.setMemberStream(userid, null)
        this.interface.removeMember(userid)
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
                id: m.id, volume: m.volume, toggle: m.toggle
            }
        })

        this.savedData = {
            id: this.id,
            members: membersToSave,
            isCompact: this.interface.isCompact,
            areMembersShown: this.interface.areMembersShown,
            isMuted: this.isMuted,
            title: this.interface.title,
            datetime: new Date()
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
    let lastDatetime = Date.parse(savedCall.datetime)

    if(!lastDatetime || utils.differenceInSeconds(lastDatetime, new Date()) > 30) {
        removeCurrentCall()
    } else {
        authPromise.then(() => {
            call = new Call(savedCall.id, window.me, savedCall)
        })
    }
}

function startCall(id) {
    if(!window.me || call) {
        alert('Невозможно начать звонок!')
        return
    }
    call = new Call(id, window.me)
    saveCall(id, {}, false, false, false)
}

console.log('HEY')