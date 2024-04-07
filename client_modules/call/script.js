const Call {
    constructor() {
        this.callInterface = document.querySelector('.call-interface')
        this.mainBar = this.callInterface.querySelector('.main-bar')
        this.memberList = this.callInterface.querySelector('.member-list')
        this.isCompact = true

        this.toggleCompact(true)

        this.mainBar.querySelector('.toggle-interface').onclick = () => {
            this.isCompact = !this.isCompact
            this.toggleCompact(this.isCompact)
        }

    }

    toggleCompact(state) {
        
    }


}


const call = new Call()
