


class ChatSettings {
    constructor(options) {
        this.element = templateManager.createElement('chat-settings')
        this.nameEntry = this.element.querySelector('.name')
        this.descrEntry = this.element.querySelector('.description textarea')
        this.avatarImg = this.element.querySelector('.avatar')
        this.isPublicCheckbox = this.element.querySelector('#ispublic')
        this.deleteAvatarButton = this.element.querySelector('.button.delete-avatar')
        this.onchange = () => {}

        this.options = options
        this.defaultName = options.defaultName ?? ''
        this.name = null ?? options.name
        this.avatarBlob = undefined
        this.isPublic = Boolean(options.isPublic)
        this.description = options.description

        if(options.hasAvatar)
            this.toggleDeleteAvatarButton(true)

        if(options.chatId)
            this.avatarImg.src = '/getchatavatar?id=' + options.chatId
        
        this.isPublicCheckbox.checked = this.isPublic
        this.nameEntry.value = options.name ?? this.defaultName
        this.descrEntry.value = this.description
        
        if(options.readOnly)
            this.setupReading()
        else
            this.setupEditing()
    }

    updateDescriptionEditing(readOnly) {
        let p = this.element.querySelector('.description p')
        p.style.display = readOnly? 'block' : 'none'
        p.innerHTML = contentCompiler.compile(this.description, {disableYT: true})

        if(!p.innerHTML) {
            p.style.fontStyle = 'italic'
            p.textContent = 'Нет описания'
        } else
            p.style.fontStyle =''

        this.descrEntry.style.display = readOnly? 'none' : 'block'
        this.descrEntry.value = this.description
    }

    setupReading() {
        this.nameEntry.setAttribute('readonly', true)
        this.element.querySelector('.ispublic').style.pointerEvents = 'none'
        this.toggleDeleteAvatarButton(false)
        this.avatarImg.style.cursor = 'default'
        this.updateDescriptionEditing(true)
        this.element.querySelector('.description .preview').style.display = 'none'
    }

    setDefaultAvatar() {
        let avatarId = (parseInt(this.options.chatId) || 0) % 10
        this.avatarImg.src = `/public/chatavatar/${avatarId}.png`
    }

    setupEditing() {
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
            console.log('hey:' + this.isPublicCheckbox.checked)
            this.onchange()
        })

        this.avatarImg.addEventListener('click', () => {
            let amaker = new AvatarMaker((blob, src) => {
                this.avatarImg.src = src
                this.avatarBlob = blob
                this.toggleDeleteAvatarButton(true)
                this.onchange()
            })
            amaker.open()
        }) 

        this.deleteAvatarButton.addEventListener('click', () => {
            this.avatarBlob = null
            this.setDefaultAvatar()
            this.toggleDeleteAvatarButton(false)
            this.onchange()
        })
        
        this.updateDescriptionEditing(false)

        this.descrEntry.addEventListener('input', () => {
            this.description = this.descrEntry.value.trim()
            this.onchange()
        })

        let readOnly = false

        this.element.querySelector('.description .preview').addEventListener('click', () => {
            readOnly = !readOnly
            this.updateDescriptionEditing(readOnly)
        })


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
        if(this.options.name !== this.name)
            changes.name = this.name
        if(this.options.isPublic !== this.isPublic)
            changes.isPublic = this.isPublic
        if(this.options.description !== this.description)
            changes.description = this.description

        return changes
    }
}