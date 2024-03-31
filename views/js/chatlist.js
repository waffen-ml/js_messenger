const holder = document.querySelector('.chatlist')
let chatViews = []
let me = {}

function renderViews() {
    holder.innerHTML = ''
    chatViews.forEach(cv => {
        let element = templateManager.createElement('chat-view', {view: cv})
        holder.appendChild(element)
    })      
    holder.querySelectorAll('[chatid]').forEach(chat => {
        chat.addEventListener('click', (e) => {
            window.location = '/chat?id=' + chat.getAttribute('chatid')
        })
    })
}

function sortViews() {
    chatViews.sort((a, b) => {
        if (!a.lm.datetime && !b.lm.datetime)
            return 0
        else if(!a.lm.datetime)
            return 1
        else if(!b.lm.datetime)
            return -1
        else
            return - a.lm.datetime.getTime() + b.lm.datetime.getTime()
    })
}

function isVisible(view) {
    return !view.is_direct || view.lm && view.lm.id >= view.focus
}

function prepareView(view) {
    if(!isVisible(view))
        return

    view.lm ??= {
        type: 'system',
        content: '*Нет сообщений*',
        files: []
    }

    view.lm.mine = view.lm.sender_id == me.id
    view.lm.datetime = view.lm.datetime? new Date(view.lm.datetime) : null

    view.lm.preview = utils.getMessagePreview(view.lm, me.id, true, !view.lm.mine && !view.is_direct)

    if(!view.name)
        view.name = utils.generateChatName(view.members, me, 5)

}

function updateView(chatid) {
    return fetch('/getchatview?id=' + chatid)
    .then(r => r.json())
    .then(view => {
        let index = chatViews.findIndex(v => v.id == chatid)

        if(!isVisible(view) && index >= 0) {
            chatViews.splice(index, 1)
        } else if(isVisible(view)) {
            prepareView(view)
            if(index < 0)
                chatViews.push(view)
            else
                chatViews[index] = view
        }

        sortViews()
        renderViews()
    })
}

function updateAllViews() {
    return fetch('/getchatviews')
    .then(r => r.json())
    .then(views => {
        chatViews = views.filter(v => isVisible(v))
        chatViews.forEach(view => prepareView(view))
        console.log(chatViews)
        sortViews()
        renderViews()
    })
}


socket.on('message', msg => {
    updateView(msg.chat_id)
})

socket.on('delete_message', msg => {
    updateView(msg.chatid)
})

socket.on('last_read', msg => {
    updateView(msg.chatid)
})

fetch('/auth')
.then((r) => r.json())
.then(user => {
    me = user
    updateAllViews()
})

document.querySelector('.create-chat').addEventListener('click', () => {
    if(!me) return

    let popup = new Popup({
        closable: true,
        title: 'Создать чат',
        html:   templateManager.createHTML('create-chat')
    })
    let members = []
    let friendlist = popup.content.querySelector('.friendlist')
    let namefield = popup.content.querySelector('input.name')
    let ispublic = popup.content.querySelector('input.is-public')
    let avatar = popup.content.querySelector('.avatar')
    let deleteAvatarButton = popup.content.querySelector('.button.delete-avatar')
    let autoName = true
    let avatarBlob = null

    popup.on('hidden', () => updateAllViews())

    deleteAvatarButton.addEventListener('click', () => {
        avatarBlob = null
        avatar.src = '/public/chatavatar/0.png'
        deleteAvatarButton.style.display = 'none'
    })
    
    avatar.addEventListener('click', () => {
        let amaker = new AvatarMaker((blob, src) => {
            avatar.src = src
            avatarBlob = blob
            deleteAvatarButton.style.display = 'block'
        })
        amaker.open()
    })

    namefield.addEventListener('change', () => {
        if(!utils.strweight(namefield.value))
            autoName = true
        else
            autoName = false
    })

    popup.addOption('OK', () => {
        let fd = new FormData()
        members.forEach(m => fd.append('members', m.id))
        fd.append('name', autoName? '' : namefield.value)
        fd.append('avatar', avatarBlob)
        fd.append('ispublic', ispublic.checked? 1 : 0)

        fetch('/createchat', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd
        })
        .then((r) => r.json())
        .then((r) => {
            if (!r.success)
                alert('Ошибка...')
            popup.close()
        })
    })

    popup.addOption('Отмена', () => {
        return true
    })

    fetch('/getfriends')
    .then(r => r.json())
    .then(friends => {
        function updateMembers() {
            members = [me]
            friends.forEach(f => {
                if (f.checked)
                    members.push(f)
            })
        }

        function updateAutoName() {
            if(!autoName)
                return
            updateMembers()
            namefield.value = members.slice(1, 11).map(m => m.name).join(', ')
        }

        namefield.addEventListener('focusout', () => {
            updateAutoName()
        })
    
        updateAutoName()
    
        friends.forEach((f, i) => {
            let element = templateManager.createElement('friend', {name: f.name, id: f.id})
            let checkbox = element.querySelector('input')
            
            element.addEventListener('click', () => {
                checkbox.checked = !friends[i].checked
                friends[i].checked = !friends[i].checked
                if (friends[i].checked)
                    element.classList.add('checked')
                else
                    element.classList.remove('checked')
                updateAutoName()
            })
    
            friendlist.appendChild(element)
        })

        popup.open()
    })
})