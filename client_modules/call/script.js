class Call {
    async constructor(callid, myid) {
        this.id = callid
        this.myid = myid
        this.callInterface = document.querySelector('.call-interface')
        this.mainBar = this.callInterface.querySelector('.main-bar')
        this.memberList = this.callInterface.querySelector('.member-list')

        await this.getMyStream()
        await this.getMembers()


        socket.emit('join_call', this.id)

        



        this.isCompact = true

        this.toggleCompact(true)

        this.mainBar.querySelector('.toggle-interface').onclick = () => {
            this.isCompact = !this.isCompact
            this.toggleCompact(this.isCompact)
        }

    }

    async getMyStream() {
        this.myStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false}).catch(() => null)

        if(!this.myStream)
            throw Error('CANNOT_GET_STREAM')
    }

    async getMembers() {
        this.members = await fetch('/getcallmembers?id=' + this.id).then(r => r.json())

        if(this.members.error)
            throw Error('CANNOT_GET_MEMBERS')
        else if(myid in this.members)
            throw Error('USER_IN_THE_CALL')

        this.members.forEach(m => {
            m.muted = false
            m.volume = 100
        })
    }

    setupPeer() {
        this.peer = new Peer(undefined, {
            host: '/',
            port: '3001',
            secure: true
        })

        this.peer.on('open', peerid => {
            this.peer.peerid = peerid
            fetch('/joincall?chatid=' + this.chatid + '&peerid=' + peerid)
            .then(r => r.json())
            .then(r => {
                if (!r.success) {
                    alert('Не удалось подключиться.')
                    this.destroyPeer()
                    return
                }
                this.interface.updateHeaderCallButtons(true)
                this.interface.showControls()
            })
        })
    
        this.peer.on('call', call => {
            call.answer(this.stream)
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

    toggleCompact(state) {
        if(state)
            this.callInterface.classList.add('compact')
        else
            this.callInterface.classList.remove('compact')
    }


}

const call = new Call()