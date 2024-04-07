class Call {
    async constructor(callid, myid) {
        this.id = callid
        this.callInterface = document.querySelector('.call-interface')
        this.mainBar = this.callInterface.querySelector('.main-bar')
        this.memberList = this.callInterface.querySelector('.member-list')

        this.members = await fetch('/getcallmembers?id=' + this.id).then(r => r.json())

        if(this.members.error)
            throw Error('Cannot get members')
        else if(myid in this.members)
            throw Error('The user is already in the call')

        this.members.forEach(m => {
            m.muted = false
            m.volume = 100
        })

        socket.emit('join_call', this.id)

        



        this.isCompact = true

        this.toggleCompact(true)

        this.mainBar.querySelector('.toggle-interface').onclick = () => {
            this.isCompact = !this.isCompact
            this.toggleCompact(this.isCompact)
        }

    }

    toggleCompact(state) {
        if(state)
            this.callInterface.classList.add('compact')
        else
            this.callInterface.classList.remove('compact')
    }


}

const call = new Call()