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

document.querySelector('.create-chat').addEventListener('click', async () => {
    if(!me) return

    let popup = new Popup({
        closable: true,
        title: 'Создать чат',
        className: 'create-chat',
        html:   templateManager.createHTML('create-chat')
    })

    let friends = await fetch('/getfriends').then(r => r.json())

    let chatSettings = new ChatSettings({})
    let friendList = new UserChecklist(friends)
    let listWrapper = document.createElement('div')
    listWrapper.className = 'block list-wrapper'
    listWrapper.appendChild(friendList.element)

    let friendsToAdd = []

    popup.content.appendChild(chatSettings.element)
    popup.content.appendChild(listWrapper)

    popup.on('hidden', () => updateAllViews())

    friendList.onchange = (checked) => {
        friendsToAdd = friends.filter((f, i) => checked[i])
        chatSettings.updateDefaultName(friendsToAdd.map(f => f.name).join(', '))
    }

    popup.addOption('Создать', () => {
        if(!friendsToAdd.length) {
            alert('Добавьте участников!')
            return
        }

        let data = chatSettings.getState()
        let fd = new FormData()

        if(data.name)
            fd.append('name', data.name)
        else
            fd.append('nullName', 1)
        
        fd.append('avatarBlob', data.avatarBlob)
        fd.append('isPublic', data.isPublic? 1 : 0)
        fd.append('description', data.description ?? '')
        
        friendsToAdd.forEach(m => fd.append('members', m.id))
        fd.append('members', me.id)

        fetch('/createchat', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd
        })
        .then(r => r.json())
        .then(r => {
            if(!r.success)
                alert('Ошибка!')
            else
                popup.close()
        })
    })

    popup.addOption('Отмена', () => true)

    popup.open()
})
