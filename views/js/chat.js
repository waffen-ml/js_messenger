const chatid = new URLSearchParams(window.location.search).get('id');
const socket = io();
const loadWindow = 15

class ChatInterface {
    constructor(isdirect) {
        this.holder = document.querySelector('.holder')
        this.holderWrapper = document.querySelector('.holder-wrapper')
        this.loadZone = document.querySelector('.load-zone')
        this.entry = document.querySelector('.entry')
        this.loadedAll = false
        this.loadingMore = false
        this.attachedFiles = []

        if(isdirect)
            this.holder.classList.add('direct')

        document.querySelector('#file').addEventListener('click', () => {
            this.openFilePopup()
        });

        this.scrollDown(false)
    }

    openFilePopup() {
        let popup = new Popup({
            title: 'Файлы',
            closable: true
        })

        let uploader = uplManager.createUploader({
            files: this.attachedFiles,
            onInspect: (file) => {
                inspectFile(file, (inspect) => {
                    inspect.popup.addOption('Назад', () => true)
                })
            }
        })

        popup.content.appendChild(uploader.element)

        popup.on('hidden', () => {
            this.attachedFiles = uploader.files
            this.updateFileCount()
        })

        popup.addOption('OK', () => true)

        popup.open()

    }    

    initSendFunction(send) {
        this.entry.addEventListener('keydown', (e) => {
            if (e.key != 'Enter') return;
            e.preventDefault();
            send();
        })
        
        document.querySelector('#send').onclick = send;
    }

    initLoadMessagesFunction(load) {
        this.holderWrapper.addEventListener('scroll', e => {
            if (!this.loadedAll && !this.loadingMore &&
                this.holderWrapper.scrollTop <= this.loadZone.clientHeight) {
                this.loadingMore = true
                
                let initialHeight = this.holderWrapper.scrollHeight

                load().then(() => {
                    let y = this.holderWrapper.scrollTop + this.holderWrapper.scrollHeight - initialHeight

                    this.holderWrapper.scroll({top: y, behavior: 'instant'})
                    this.loadingMore = false
                })
            }
        })
    }

    disableLoadingMore() {
        this.loadedAll = true
        this.holderWrapper.classList.add('loaded-all')
    }

    scrollDown(smooth) {
        this.holderWrapper.scrollTo({top: this.holder.scrollHeight, behavior: smooth? 'smooth' : 'instant'});
    }

    scrollUp(smooth) {
        this.holderWrapper.scrollTo({top:0, behavior: smooth? 'smooth' : 'instant'})
    }

    updateFileCount() {
        const btn = document.querySelector('.input-bar #file');
        const count = this.attachedFiles.length;
        btn.value = (count? count + ' ' : '') + '📁';
    }

    delayedScroll() {
        Promise.all(Array.from(this.holder.querySelectorAll('img')).map(img => {
            if(img.complete)
                return Promise.resolve(true);
            return new Promise(resolve => {
                img.addEventListener('load', () => resolve(true));
                img.addEventListener('error', () => resolve(false))
            })
        })).then((s) => {
            this.scrollDown(false);
        })
    }

    addMessages(msgs, myid, before, scroll) {
        let elements = msgs.map(msg => {
            let element = templateManager.createElement('universal-message', {data: msg, myid: myid})
            setupInspectObjects(element)
            return element
        })
        if (before) {
            [...elements].reverse().forEach(child => {
                this.holder.insertBefore(child, this.holder.firstChild)
            })
            if (scroll)
                this.scrollUp(true);
        }
        else {
            this.holder.append(...elements)
            if (scroll)
                this.scrollDown(true);
        }
    }

    getMessageWrapper(id) {
        return this.holder.querySelector(`.message-wrapper[msg-id="${id}"]`)
    }
    
    removeDateLabel(id) {
        let wrapper = this.getMessageWrapper(id)
        let label = wrapper.querySelector('.date-label')
        if (label)
            wrapper.removeChild(label)
    }

    removeMessage(id) {
        let wrapper = this.getMessageWrapper(id)
        if (wrapper)
            this.holder.removeChild(wrapper)
    }

    makeMessageMinor(id) {
        let msg = this.getMessageWrapper(id).querySelector('.user-message')
        msg.classList.add('minor')
    }

    clearInput() {
        this.entry.value = ''
        this.attachedFiles = []
    }

    setChatHeader(title, subtitle, avatarUrl, onclick) {
        document.querySelector('.chat-header .chat-name').textContent = title ?? ''

        if (subtitle) {
            document.querySelector('.chat-header .subinfo').textContent = subtitle
            document.querySelector('.chat-header .info').classList.add('detailed')
        }

        document.querySelector('.chat-header .avatar').src = avatarUrl
        document.querySelector('.chat-header .info').onclick = onclick
    }
}

class ChatMessages {
    
    constructor(itf, me) {
        this.messages = []
        this.interface = itf
        this.me = me
    }

    addMessages(msgs, prepare, before, scroll) {
        if (!msgs.length)
            return

        if (prepare) {
            msgs.forEach(m => {
                m.minor = false
                m.datetime = new Date(m.datetime)
                utils.distributeFiles(m, 'mimetype')
            })
        }
        if (before)
            this.addBefore(msgs, scroll)
        else
            this.addAfter(msgs, scroll)
    }

    isMinor(curr, prev) {
        return curr.sender_id === prev.sender_id
            // && utils.differenceInMinutes(curr.datetime, prev.datetime) < 5
    }

    requiresDateLabel(curr, prev) {
        return !prev.datetime || !utils.areDatesEqual(curr.datetime, prev.datetime)
    }

    _enhanceStep(curr, prev) {
        curr.minor = this.isMinor(curr, prev)
        curr.dateLabel = this.requiresDateLabel(curr, prev)
        return curr
    }

    enhance(msgs, prev) {
        this._enhanceStep(msgs[0], prev ?? {})
        for (let i = 1; i < msgs.length; i++)
            this._enhanceStep(msgs[i], msgs[i - 1])
        return msgs
    }

    addBefore(batch, scroll) {
        this.enhance(batch)
        this.interface.addMessages(batch, this.me.id, true, scroll)
        
        let a = batch[batch.length - 1]
        let b = this.messages[0]

        if (this.messages.length) {
            if (!this.requiresDateLabel(b, a)) {
                this.interface.removeDateLabel(b.id)
                b.dateLabel = false
            }
            if (this.isMinor(b, a)) {
                this.interface.makeMessageMinor(b.id)
                b.minor = true
            }
        }

        this.messages.unshift(...batch)
    }

    addAfter(batch, scroll) {
        let last = this.messages[this.messages.length - 1]
        this.enhance(batch, last)
        this.messages.push(...batch)
        this.interface.addMessages(batch, this.me.id, false, scroll)
    }
}

class Chat {
    constructor(me, info, socket) {
        this.info = info
        this.chatid = info.id
        this.socket = socket
        this.me = me
        this.interface = new ChatInterface(info.direct)
        this.messages = new ChatMessages(this.interface, me)

        this.interface.initSendFunction(() => this.send())
        this.interface.initLoadMessagesFunction(() => this.loadMessageBatch())
        //this.interface.identifyMyMessages(null, me.id)
        this.loadChatInfo()
        this.loadMessageBatch()
        this.setupSocket()
    }

    loadChatInfo() {
        fetch('/getchatinfo?id='+this.chatid)
        .then(r => r.json())
        .then(r => {

            let name = utils.getChatName(r, this.me)
            let subtitle = r.is_direct? null : r.members.length + ' участников'
            let avatar_url = utils.getChatAvatarURL(r, this.me)
            let onclick = r.is_direct? () => location.replace('/user?id=' + utils.getOtherMember(r, this.me).id)
                : () => alert('hey!')
            
            this.interface.setChatHeader(name, subtitle, avatar_url, onclick)

        })
    }

    loadMessageBatch() {
        let first = this.messages.messages[0]

        if (first && first.local_id == 1)
            return Promise.resolve()

        let loadStart = first? first.local_id - 1 : -1
        
        return fetch(`/getmessages?chatid=${chatid}&count=${loadWindow}&start=${loadStart}`)
        .then(r => r.json())
        .then(msgs => {

            this.messages.addMessages(msgs.reverse(), true, true, false)

            if (msgs.length < loadWindow) {
                this.interface.disableLoadingMore()
            }

            if (loadStart == -1)
                this.interface.delayedScroll()
        })
    }
    
    setupSocket() {
        socket.emit('join-chat', chatid);

        socket.on('message', msg => {
            this.messages.addMessages([msg], true, false, true)
        })
    }

    send() {
        let attachedFiles = this.interface.attachedFiles
        let text = this.interface.entry.value

        if (text == '' && !attachedFiles.length)
            return
    
        let data = new FormData();
        data.append('text', text);
        
        attachedFiles.forEach(f => data.append('files', f));

        fetch('/sendmsg?id=' + chatid, {
            method: 'POST',
            credentials: 'same-origin',
            body: data
        }).then(r => r.json())
        .then(r => {
            console.log(r);
        })
    
        this.interface.clearInput()
        this.interface.updateFileCount();
    }
}

function toggleStream(stream, state) {
    stream.getAudioTracks().forEach(t => {
        t.enabled = state
    })
}

class CallInterface {

    constructor() {
        this.voiceChatTab = document.querySelector('.voice-chat')
        this.voiceChatMemberList = document.querySelector('.voice-controls .members')

        this.updateHeaderCallButtons(false)
    }

    setupStreamMuteButton(stream, button, onEnabledLabel, onMutedLabel) {
        if(!stream)
            return
    
        let muted = false
        button.textContent = onEnabledLabel
    
        button.addEventListener('click', () => {
            muted = !muted
            toggleStream(stream, !muted)
            button.textContent = muted? onMutedLabel : onEnabledLabel
        })
    }
    
    displayMemberControls(member) {
        if (!member.call) {
            console.log('call is missing!')
            console.log(member)
            return
        } else {
            console.log('displaying')
            console.log(member)
        }
    
        let li = document.createElement('li')
        li.classList.add('member')
        li.setAttribute('id', 'member' + member.id)
        
        let avatar = document.createElement('img')
        avatar.setAttribute('src', '/file?id=169904737598173031.jpg')
        avatar.classList.add('avatar')
    
        let name = document.createElement('span')
        name.classList.add('name')
        name.classList.add('finite')
        name.textContent = member.name
    
        let volumeRange = document.createElement('input')
        volumeRange.setAttribute('type', 'range')
        volumeRange.setAttribute('min', 0)
        volumeRange.setAttribute('max', 100)
        volumeRange.setAttribute('step', 1)
        volumeRange.setAttribute('value', 100)
        volumeRange.classList.add('volume-range')
    
        let volumeLabel = document.createElement('span')
        volumeLabel.classList.add('volume-label')
        volumeLabel.textContent = '100%'
    
        let mute = document.createElement('button')
        mute.classList.add('mute')
    
        this.setupStreamMuteButton(member.stream, mute, 'Слышен', 'Заглушен')
    
        volumeRange.addEventListener('change', () => {
            member.audio.volume = volumeRange.value / 100;
            volumeLabel.textContent = volumeRange.value + '%'
        })
    
        li.appendChild(avatar)
        li.appendChild(name)
        li.appendChild(volumeRange)
        li.appendChild(volumeLabel)
        li.appendChild(mute)
    
        this.voiceChatMemberList.appendChild(li)
    }

    removeMemberControls(member) {
        let el = this.voiceChatMemberList.querySelector('#member' + member.id)
        if (el) this.voiceChatMemberList.removeChild(el)
    }

    showControls() {
        this.voiceChatTab.classList.add('active')
        this.voiceChatTab.classList.remove('hidden')
    }

    clearControls() {
        this.voiceChatMemberList.innerHTML = ''
    }

    updatePreview(callTable) {
        this.voiceChatTab.setAttribute('style', '')
        this.voiceChatTab.classList.remove('active')
        this.voiceChatTab.classList.remove('hidden')
        
        if (!callTable || !Object.keys(callTable).length) {
            this.voiceChatTab.classList.add('hidden')
            return
        }
    
        let members = Object.values(callTable)
        let c = members.length
        
        let w = this.voiceChatTab.querySelector('.count span')
        
        if (c > 10 && c < 20 || c % 10 >= 5 || c % 10 == 0)
            w.textContent = 'участников'
        else if(c%10 == 1)
            w.textContent = 'участник'
        else
            w.textContent = 'участника'
    
        this.voiceChatTab.querySelector('.count .num').textContent = c
    
        let k = Math.min(members.length, 5)
        let s = members.slice(members.length - k).reverse().map(w => w.name).join(', ')
        if (k < members.length)
            s += '...'
    
        this.voiceChatTab.querySelector('.list').textContent = 'В звонке: ' + s
    }

    updateHeaderCallButtons(call) {
        let join = document.querySelector('.chat-header .join-call')
        let leave = document.querySelector('.chat-header .leave-call')
        join.style.display = call? 'none' : 'block'
        leave.style.display = call? 'block' : 'none'
    }
    
    setupJoinLeaveButtons(call) {
        document.querySelector('.join-call').addEventListener('click', () => {
            if(call.isCallGoing())
                return
            call.enterVoiceChat()
        })

        document.querySelector('.leave-call').addEventListener('click', () => {
            if(!call.isCallGoing())
                return
            call.leaveVoiceChat()
        })
    }

}

class Call {

    constructor(me, chatid, socket) {
        this.me = me
        this.interface = new CallInterface()
        this.peer = null
        this.stream = null
        this.callTable = null
        this.socket = socket
        this.chatid = chatid

        //this.getStream()
        this.setupSocketEvents()
        this.requestCallTable()
        this.interface.setupJoinLeaveButtons(this)
    }

    isCallGoing() {
        return Boolean(this.peer)
    }

    requestCallTable() {
        fetch('/getcalltable?chatid=' + this.chatid)
        .then(r => r.json())
        .then(r => {
            this.callTable = r.table
            console.log(r.table)
            this.interface.updatePreview(this.callTable)
        })
    }

    doesCallContainUser(userid) {
        if(!this.callTable) return false
        return Object.values(this.callTable).some((v) => v.id == userid)
    }

    setupSocketEvents() {
        this.socket.on('call-member-disconnected', (peerid) => {
            console.log('disconnected ' + peerid)
            this.removeMember(this.callTable[peerid])
        })
        
        this.socket.on('new-call-member', (user) => {
            
            this.callTable[user.peer] = user

            console.log(user)

            if (!this.peer) {
                this.interface.updatePreview(this.callTable)
                return
            } else if(user.id == this.me.id)
                return
            
            const call = this.peer.call(user.peer, this.stream)
        
            call.on('stream', userStream => {
                this.connectToMember(call, userStream)
            });
        
            call.on('close', () => {
        
            })
        })
        
    }

    getStream() {
        navigator.mediaDevices.getUserMedia({
            'audio': true,
            'video': false
        }).then(stream => {
           this.stream = stream
           this.interface.setupStreamMuteButton(stream, 
               document.querySelector('.personal .mute'),
               'Включен', 'Выключен')
        }).catch(err => {
            alert('Не удалось получить доступ к аудио: ' + err)
        })
    }

    connectToMember(call, userStream) {
        let user = this.callTable? this.callTable[call.peer] : null
        
        if (!user || user.id == this.me.id) {
            console.log('i cant have it')
            console.log(user)
            return
        }

        user.call = call
        user.stream = userStream
        user.audio = document.createElement('audio')
        user.audio.srcObject = userStream
        user.audio.autoplay = true
        this.interface.displayMemberControls(user)
    }

    destroyPeer() {
        this.peer.destroy()
        this.peer = null
    }

    enterVoiceChat() {
        if(!this.stream || !this.callTable ||
            this.peer || this.doesCallContainUser(this.me.id)) {
            alert('Невозможно начать разговор.')
            return
        }
        
        toggleStream(this.stream, true)
        this.interface.clearControls()

        this.peer = new Peer(undefined, {
            host: '/',
            port: '3001',
            secure: true
        });
    
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

    removeMember(member) {
        if(!member)
            return
        this.deleteMemberAudio(member)
        delete this.callTable[member.peer]
        if (!this.peer)
            this.interface.updatePreview(this.callTable)
        else
            this.interface.removeMemberControls(member)
    }

    deleteMemberAudio(member) {
        if(member && member.audio)
            member.audio.remove()
    }

    leaveVoiceChat() {
        if(!this.peer)
            return

        delete this.callTable[this.peer.peerid]
        this.socket.emit('end-call')
        this.destroyPeer()
    
        Object.values(this.callTable).forEach(this.deleteMemberAudio)
    
        this.interface.updatePreview(this.callTable)
        this.interface.updateHeaderCallButtons(false)
    }
}

let chat = null
let call = null
let user = null

fetch('/auth')
.then((r) => r.json())
.then(user_ => {
    if(!user_) {
        alert('Вы не вошли в аккаунт.')
        location.replace('/')
        return
    }
    user = user_
    return fetch('/getchatinfo?id=' + chatid)
})
.then(r => r.json())
.then(info => {
    chat = new Chat(user, info, socket)
    call = new Call(user, info, socket)
})





