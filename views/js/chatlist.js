fetch('/getchatlist')
.then(r => r.json())
.then(views => {

    console.log(views)

    views.forEach(view => {
        view.lm_datetime = view.lm_datetime? new Date(view.lm_datetime) : null
        view.visible = view.lm_id && view.lm_id >= view.focus

        if (!view.chat_name) {
            let names = view.members.filter(m => m.id != view.owner_id).map(m => m.name)
            view.chat_name = names.join(', ')
        }

        switch(view.lm_type) {
            case 'default':
                view.lm_preview = (view.lm_content ?? '').substr(0, 100)
                break
            case 'sticker':
                view.lm_preview = 'Стикер'
                break
        }

        if (view.lm_file_count > 0)
            view.lm_preview += `[${view.lm_file_count} файлов]`

        if(view.lm_sender_id == view.owner_id) {
            view.lm_preview = 'Вы: ' + view.lm_preview
        }
        else if(!view.is_chat_direct) {
            view.lm_preview = view.lm_sender_name + ': ' + view.lm_preview
        }

        view.datetime_label = view.lm_datetime && utils.getMessageDatetimeLabel(view.lm_datetime)

    })

    let main = document.querySelector('main')
    let holder = document.querySelector('.chatlist')

    views.forEach(view => {
        let element = templateManager.createElement('chat-view', view)
        let dots = element.querySelector('.dots')
        holder.appendChild(element)

        element.addEventListener('click', (e) => {
            if (e.target.classList.contains('dots'))
                return
            window.location = '/chat?id=' + view.chat_id
        })

        let cw = null

        dots.addEventListener('click', () => {
            if (cw && cw.isOpened()) {
                cw.close()
                cw = null
                return
            }

            let brect = dots.getBoundingClientRect()
            
            cw = makeButtonsCW({
                'Очистить историю': () => {
                    alert('hey')
                },
                'Выйти': () => {
                    alert('hey1')
                }
            }, {
                transformOrigin: 'top right',
                pos: {
                    right: document.body.clientWidth - brect.right,
                    top: brect.top + brect.height
                },
                attachedTo: dots,
                destroyOnClose: true,
                parent: main
            })
            console.log(cw.window)
            cw.open()
        })

    })



})



document.querySelectorAll('[chatid]').forEach(chat => {
    chat.addEventListener('click', (e) => {
        if (e.target.classList.contains('dots'))
            return
        window.location = '/chat?id=' + chat.getAttribute('chatid')
    })
})

document.querySelectorAll('.dots').forEach(b => {
    b.addEventListener('click', e => {
        alert('hey')
    })
})

let me = {}

fetch('/auth')
.then((r) => r.json())
.then(user => {
    me = user
})

document.querySelector('.create-chat').addEventListener('click', () => {
    if(!me) return

    let popup = new Popup({
        closable: false,
        title: 'Создать чат',
        html: templateManager.createHTML('create-chat')
    })
    let members = []
    let friendlist = popup.content.querySelector('.friendlist')
    let namefield = popup.content.querySelector('input.name')
    let ispublic = popup.content.querySelector('input.is-public')
    let avatar = popup.content.querySelector('.avatar')
    let autoName = true
    let avatarBlob = null

    popup.on('hidden', () => location.reload())

    avatar.addEventListener('click', () => {
        let amaker = new AvatarMaker((blob, src) => {
            avatar.src = src
            avatarBlob = blob
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
            location.reload()
        })
    })

    popup.addOption('Отмена', () => {
        return true
    })

    fetch('/getfriends')
    .then(friends => friends.json())
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