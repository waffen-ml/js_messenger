


class ChatSettings {
    constructor(options) {
        this.element = templateManager.createElement('chat-settings')
        this.nameEntry = this.element.querySelector('.name')
        this.avatarImg = this.element.querySelector('.avatar')
        this.isPublicCheckbox = this.element.querySelector('#ispublic')
        this.deleteAvatarButton = this.element.querySelector('.button.delete-avatar')
        this.onchange = () => {}

        this.options = options
        this.defaultName = options.defaultName ?? ''
        this.name = null ?? options.name
        this.avatarBlob = undefined
        this.isPublic = Boolean(options.isPublic)

        if(options.hasAvatar)
            this.toggleDeleteAvatarButton(true)

        if(options.chatId)
            this.avatarImg.src = '/getchatavatar?id=' + options.chatId
        
        this.isPublicCheckbox.checked = this.isPublic
        this.nameEntry.value = options.name ?? this.defaultName

        this.deleteAvatarButton.addEventListener('click', () => {
            this.avatarBlob = null
            this.avatarImg.src = '/public/chatavatar/0.png'
            this.toggleDeleteAvatarButton(false)
            this.onchange()
        })

        if(!options.readOnly) {
            this.avatarImg.addEventListener('click', () => {
                let amaker = new AvatarMaker((blob, src) => {
                    this.avatarImg.src = src
                    this.avatarBlob = blob
                    this.toggleDeleteAvatarButton(true)
                    this.onchange()
                })
                amaker.open()
            }) 
        }

        this.nameEntry.addEventListener('input', () => {
            let s = this.nameEntry.value.trim()
            this.name = s? s : null
            this.onchange()
        })

        this.nameEntry.addEventListener('focusout', () => {
            if(this.name === null)
                this.nameEntry.value = this.defaultName
        })

        this.isPublicCheckbox.addEventListener('change', () => {
            this.isPublic = this.isPublicCheckbox.checked
            this.onchange()
        })

        if(options.readOnly) {
            this.nameEntry.setAttribute('readonly', true)
            this.element.querySelector('.ispublic').style.pointerEvents = 'none'
            this.toggleDeleteAvatarButton(false)
            this.avatarImg.style.cursor = 'default'
        }
    }

    toggleDeleteAvatarButton(state) {
        this.deleteAvatarButton.style.display = state? 'block' : 'none'
    }

    updateDefaultName(name) {
        this.defaultName = name

        if(this.name === null)
            this.nameEntry.value = this.defaultName
    }

    getChanges() {
        let changes = {}

        if(this.avatarBlob || this.avatarBlob === null && this.options.hasAvatar)
            changes.avatarBlob = this.avatarBlob
        else if(this.options.name !== this.name)
            changes.name = this.name
        else if(this.options.isPublic !== this.isPublic)
            changes.isPublic = this.isPublic

        return changes
    }
}