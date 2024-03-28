const chatid = new URLSearchParams(window.location.search).get('id')
const loadWindow = 15
const updateLastSeenInterval = 20 // seconds
const typingStatusInterval = 5 // seconds
const messageLongPressMilliseconds = 400

const emojiList = Array.from(`😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗
😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢
🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬
❤🧡💛💚💙💜🤎🖤🤍💔💯❗❌💘`)
.filter(w => w != '\n')


class TypingListener {

    constructor(timeoutSeconds, intervalSeconds, onstart, onupdate, onstop) {
        this.intervalSeconds = intervalSeconds
        this.timeoutSeconds = timeoutSeconds

        this.timeoutId = -1
        this.intervalId = -1

        this.onstart = onstart ?? onupdate
        this.onupdate = onupdate
        this.onstop = onstop
    }

    isTyping() {
        return this.timeoutId >= 0
    }

    stopInterval() {
        if (this.intervalId >= 0) {
            clearInterval(this.intervalId)
            this.intervalId = -1
        }
    }

    stopTimeout() {
        if(this.timeoutId >= 0) {
            clearTimeout(this.timeoutId)
            this.timeoutId = -1
        }
    }

    startTimeout() {
        this.stopTimeout()
        this.timeoutId = setTimeout(() => {
            this.stop()
        }, this.timeoutSeconds * 1000)
    }

    startInterval() {
        if(this.intervalSeconds === null || 
            this.intervalSeconds < 0 || !this.onupdate)
            return
        this.stopInterval()
        this.intervalId = setInterval(() => {
            this.onupdate()
        }, this.intervalSeconds * 1000)
    }

    update() {
        if (!this.isTyping()) {
            this.startTimeout()
            this.startInterval()
            this.onstart()
        } else {
            this.startTimeout()
        }
    }

    stop() {
        this.stopInterval()
        this.stopTimeout()
        this.onstop()
    }
}

class MessageElement {
    constructor(chat, info) {
        this.id = info.id
        this.chat = chat
        this.info = info
        this.wrapper = templateManager.createElement('any-message', {data: info, myid: chat.me.id})
        this.userMessage = this.wrapper.querySelector('.user-message')
        this.systemMessage = this.wrapper.querySelector('.message-wrapper > .system-message')
        this.replyTo = this.userMessage? this.userMessage.querySelector('.reply-wrapper') : null
        this.i = 0

        if(this.userMessage && this.info.type == 'default') {
            console.log(this.info.content)
            console.log(contentCompiler.compile(this.info.content))
            this.userMessage.querySelector('.text').innerHTML = contentCompiler.compile(this.info.content)
        }

        setupInspectObjects(this.wrapper)
        this.update()
        this.setupCW()
    }

    toggleSelected(state) {
        if(state)
            this.wrapper.classList.add('selected')
        else
            this.wrapper.classList.remove('selected')
    }

    selectAndOpenCW(pos) {
        this.chat.interface.unselectAll()

        let cw = createOptionListCW({
            'Ответить': () => this.chat.interface.setMessageIdToReplyTo(this.id),
            'Переслать': () => alert('hey2'),
            'Удалить': () => this.chat.deleteMessage(this.id),
            'Прочитавшие': () => this.chat.inspectReadersOfMessage(this.id)
        }, {
            transformOrigin: 'top left',
            closeInstantly: true,
            checkScroll: this.chat.interface.holderWrapper
        })

        let w = this.i

        cw.setPosition(pos)

        cw.on('hidden', () => this.toggleSelected(false))
        cw.on('open', () => this.toggleSelected(true))

        this.i++

        cw.open()
    }

    setupCW() {     
        this.wrapper.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.selectAndOpenCW({
                top: e.clientY,
                left: e.clientX
            })
            document.getSelection().removeAllRanges()
        })
    }

    toggleDateLabel(state) {
        if(state)
            this.wrapper.classList.add('datechange')
        else
            this.wrapper.classList.remove('datechange')
    }

    setMinor(isMinor) {
        if(!this.userMessage)
            return

        if(isMinor)
            this.userMessage.classList.add('minor')
        else
            this.userMessage.classList.remove('minor')
    } 

    setReadStatus(status) {
        if(!this.userMessage)
            return

        if(status)
            this.userMessage.classList.add('read')
        else
            this.userMessage.classList.remove('read')
    }

    toggleReplyTo(state) {
        if(!this.replyTo)
            return
        else if(state)
            this.replyTo.style.display='flex'
        else
            this.replyTo.style.display='none'
    }

    async updateReplyTo() {
        if(!this.replyTo || !this.info.reply_to)
            return this.toggleReplyTo(false)

        let msg = this.chat.messageList.getMessageById(this.info.reply_to)
            || await this.chat.loadMessage(this.info.reply_to)

        if(!msg)
            return this.toggleReplyTo(false)

        this.replyTo.querySelector('.user-name').textContent = msg.sender_name
        this.replyTo.querySelector('.msg-text').innerHTML = utils.getMessagePreview(msg, this.chat.me.id, true, false)

        this.replyTo.onclick = () => this.chat.interface.focusOnMessage(this.info.reply_to)

        this.toggleReplyTo(true)
    }

    update() {
        this.toggleDateLabel(this.info.dateLabel)
        this.setMinor(this.info.minor)
        this.setReadStatus(this.info.read)
        this.updateReplyTo()

        if(this.chat.me.id == this.info.sender_id)
            this.userMessage.classList.add('mine')
    }

}

class ChatInterface {
    constructor(chat) {
        this.holder = document.querySelector('.holder')
        this.holderWrapper = document.querySelector('.holder-wrapper')
        this.loadZone = document.querySelector('.load-zone')
        this.entry = document.querySelector('.entry')
        this.replyBar = document.querySelector('.reply-bar')
        this.loadedAll = false
        this.loadingMore = false
        this.chat = chat
        this.replyTo = -1

        this.messages = {}

        if(chat.info.is_direct)
            this.holder.classList.add('direct')

        this.replyBar.querySelector('.discard').addEventListener('click', () => {
            this.setMessageIdToReplyTo(-1)
        })

        this.setupStickersCW()
        this.setupFileCW()
        this.setupDotsCW()
        this.setupEntry()

        this.focusEntry()

        this.scrollDown(false)
    }

    unselectAll() {
        Object.values(this.messages).forEach(m => m.toggleSelected(false))
    }

    appendMessageEntry(text) {
        this.entry.value += text
    }

    repositionInputCW(cw, butt) {
        let actual = cw.setPosition({
            top:utils.bounds(butt).top - cw.window.clientHeight - 5,
            left:utils.bounds(butt).left - cw.window.clientWidth / 2 + butt.clientWidth / 2
        }, document.querySelector('main'), true, false)

        cw.setAxis({
            top:cw.window.clientHeight,
            left:utils.bounds(butt).left - actual.left + butt.clientWidth / 2
        })
    }

    setupDotsCW() {
        let dots = document.querySelector('.chat-header .dots')

        makeButtonsCW(dots, {
            'Очистить историю': () => {
                
            },
            'Выйти из чата': () => {

            },
            'Начать звонок': () => {},
            'Подробнее': () => {}
        })

    }

    setupFileCW() {
        let fb = document.querySelector('.input-bar button#file')

        this.fileUploader = uplManager.createUploader({})

        this.fileUploader.on('append', () => this.updateFileCount())
        this.fileUploader.on('remove', () => this.updateFileCount())

        let cw = new ContextWindow({
            destroyOnClose: false,
            className: 'filescw'
        })

        cw.window.appendChild(this.fileUploader.element)

        attachButtonToCW(() => {
            this.repositionInputCW(cw, fb)
            return cw
        }, fb)

    }

    getAttachedFiles() {
        return this.fileUploader.files
    }

    setupStickersCW() {
        let sb = document.querySelector('button#stickers')

        this.chat.getAvailableStickers()
        .then(packs => {
            let cw = new ContextWindow({
                html: templateManager.createHTML('stickerscw', {
                    packs: packs,
                    emojiList: emojiList
                }),
                destroyOnClose:false,
                className: 'stickerscw'
            })

            function showGrid(id) {
                cw.window.querySelectorAll('.grid').forEach(grid => grid.classList.add('disabled'))
                cw.window.querySelector('.grid#' + id).classList.remove('disabled')
            }

            cw.window.querySelectorAll('.navigation button').forEach(navbutt => {
                if(navbutt.getAttribute('id') == 'buy')
                    navbutt.addEventListener('click', () => {location.href = "stickerpacks"})
                else
                    navbutt.addEventListener('click', () => showGrid(navbutt.getAttribute('id')))
            })
            

            cw.window.querySelectorAll('.grid#emoji button').forEach(emojiButton => {
                emojiButton.addEventListener('click', () => this.appendMessageEntry(emojiButton.textContent))
            })

            packs.forEach(pack => {
                cw.window.querySelectorAll(`.grid#${pack.tag} button`).forEach(stickerButton => {
                    stickerButton.addEventListener('click', () => 
                    this.chat.sendSticker(pack.tag, parseInt(stickerButton.getAttribute('id'))))
                })
            })


            attachButtonToCW(() => {
                this.repositionInputCW(cw, sb)
                return cw
            }, sb)

        })

    
    }

    setupEntry() {
        this.entry.addEventListener('keydown', (e) => {
            if(e.key == 'Enter' && !window.isMobileOrTablet() && !window.event.shiftKey) {
                e.preventDefault()
                this.chat.sendDefault()
            }
        })

        document.querySelector('#send').onclick = () => this.chat.sendDefault()

        const ctx = document.createElement('canvas').getContext('2d')
        const entryStyle = getComputedStyle(this.entry)
        ctx.font = entryStyle.font

        this.typingListener = new TypingListener(
            typingStatusInterval,
            typingStatusInterval,
            null,
            () => this.chat.sendTypingStatus(true),
            () => this.chat.sendTypingStatus(false))

        this.entry.addEventListener('input', (e) => {
            let text = this.entry.value
            let innerWidth = this.entry.clientWidth - 2 * parseInt(entryStyle.paddingLeft)
            
            if(text.match(/\n/) || ctx.measureText(text).width > innerWidth)
                this.entry.classList.add('expanded')
            else
                this.entry.classList.remove('expanded')

            if(text)
                this.typingListener.update()
            else if(!text && typingListener.isTyping())
                this.typingListener.stop()
        })

        this.entry.addEventListener('clear', () => {
            this.entry.classList.remove('expanded')
            this.typingListener.stop()
        })
        
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
        const btn = document.querySelector('.input-bar #file')
        const count = this.getAttachedFiles().length
        btn.value = (count? count + ' ' : '') + '📁'
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

    addMessages(msgs, before) {
        msgs = msgs.map(msg => {
            this.messages[msg.id] = new MessageElement(this.chat, msg)
            return this.messages[msg.id]
        })

        if(!before) {
            msgs.forEach(m => this.holder.appendChild(m.wrapper))
            this.scrollDown(true)
        } else {
            msgs.reverse().forEach(m => this.holder.insertBefore(m.wrapper, this.holder.firstChild))
        }
    }
    
    deleteMessage(id) {
        if(!this.messages[id])
            return
        this.holder.removeChild(this.messages[id].wrapper)
        delete this.messages[id]
    }

    getMessage(id) {
        return this.messages[id]
    }

    clearInput() {
        this.entry.value = ''
        this.entry.classList.remove('expanded')
        this.entry.dispatchEvent(new Event('clear'))
        this.fileUploader.clear()
        this.setMessageIdToReplyTo(-1)
    }

    setChatAvatar(avatarUrl) {
        document.querySelector('.chat-header .avatar').src = avatarUrl
    }

    setChatTitle(title) {
        document.querySelector('.chat-header .chat-name').textContent = title ?? ''
    }

    setChatSubtitle(subtitle) {
        if(subtitle) {
            document.querySelector('.chat-header .subinfo').textContent = subtitle
            document.querySelector('.chat-header .info').classList.add('detailed')
        } else 
            document.querySelector('.chat-header .info').classList.remove('detailed')
    }

    setHeaderClickEvent(onclick) {
        document.querySelector('.chat-header .info').onclick = onclick
    }

    updateMessage(id) {
        let msg = this.getMessage(id)
        if(msg) msg.update()
    }

    async focusOnMessage(id) {
        let msg = this.getMessage(id)

        if(!msg && await this.chat.loadToReach(id))
            msg = this.getMessage(id)
        if(!msg)
            return false

        msg.wrapper.scrollIntoView()
        msg.toggleSelected(true)
        setTimeout(() => msg.toggleSelected(false), 500)
        return true
    }

    setMessageIdToReplyTo(id) {
        id = parseInt(id)

        if(!isNaN(id) && id >= 0) {
            this.replyTo = id
            this.replyBar.style.display = 'flex'

            let msg = this.chat.messageList.getMessageById(id)

            if(!msg)
                return this.setMessageIdToReplyTo(-1)

            this.replyBar.querySelector('.user-name').textContent = msg.sender_name
            this.replyBar.querySelector('.msg-text').innerHTML = utils.getMessagePreview(msg, this.chat.me.id, true, false)

            this.focusEntry()
        } else {
            this.replyTo = -1
            this.replyBar.style.display = 'none'
        }
    }

    focusEntry() {
        this.entry.focus()
    }

}

class MessageList {
    constructor(itf, me) {
        this.messages = []
        this.interface = itf
        this.me = me
    }

    getMessageById(id) {
        for(let i = 0; i < this.messages.length; i++)
            if(this.messages[i].id == id)
                return this.messages[i]
        return null
    }

    getMessageByIndex(index) {
        return this.messages[index]
    }

    deleteMessage(id) {
        let index = this.messages.findIndex(w => w.id == id)
        if(index < 0)
            return

        if(index > 0 && index < this.messages.length - 1) {
            this.enhance(this.messages[index + 1], this.messages[index - 1])
        }

        this.messages.splice(index, 1)
        this.interface.deleteMessage(id)
    }

    addMessages(msgs, prepare=true, before=false) {
        //msgs: ascending

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
            this.addBefore(msgs)
        else
            this.addAfter(msgs)
    }

    isMinor(curr, prev) {
        return curr.sender_id === prev.sender_id
            && utils.differenceInMinutes(curr.datetime, prev.datetime) < 5
    }

    requiresDateLabel(curr, prev) {
        return !prev.datetime || !utils.areDatesEqual(curr.datetime, prev.datetime)
    }

    enhance(curr, prev) {
        curr.minor = this.isMinor(curr, prev)
        curr.dateLabel = this.requiresDateLabel(curr, prev)
        this.interface.updateMessage(curr.id)
        return curr
    }

    enhanceAll(msgs, prev) {
        this.enhance(msgs[0], prev ?? {})
        for (let i = 1; i < msgs.length; i++)
            this.enhance(msgs[i], msgs[i - 1])
        return msgs
    }

    addBefore(batch) {
        this.enhanceAll(batch)
        let a = batch[batch.length - 1]
        let b = this.messages[0]

        if(b) {
            this.enhance(b, a) 
        }

        this.interface.addMessages(batch, true)
        this.messages.unshift(...batch)
    }

    addAfter(batch) {
        let last = this.messages[this.messages.length - 1]
        this.enhanceAll(batch, last)
        this.messages.push(...batch)
        this.interface.addMessages(batch, false)
    }
}

class Chat {
    constructor(me, chatid, socket) {
        this.chatid = chatid
        this.socket = socket
        this.me = me

        fetch('/getchatinfo?id=' + chatid)
        .then(r => r.json())
        .then(info => this.init(info))
    }

    inspectReadersOfMessage(msgid) {
        return fetch(`/getreadersofmessage?chatid=${this.chatid}&msgid=${msgid}`)
        .then(r => r.json())
        .then(users => {
            let popup = createUserListPopup(users)
            popup.open()
        })
    }

    deleteMessage(msgid) {
        return fetch(`/deletemessage?chatid=${this.chatid}&msgid=${msgid}`)
        .then(r => r.json())
        .then(r => {
            if(r.error) {
                alert('Ошибка: ' + r.error)
                return
            }
        })
    }

    updateTypingMembers() {
        let typingMembers = Object.values(this.members).filter(m => m.typingListener.isTyping())

        if(typingMembers.length == 0) {
            this.subtitleList[1] = null
        }
        else if (this.direct_to) {
            this.subtitleList[1] = 'печатает...'
        }
        else {
            this.subtitleList[1] = typingMembers.map(m => m.name).join(', ') + ' ' 
            + (typingMembers.length > 1? 'печатают' : 'печатает') + '...'
        }

        this.updateSubtitle()
    }

    updateSubtitle() {
        let subtitle = [...this.subtitleList].reverse().find(w => w)
        this.interface.setChatSubtitle(subtitle)
    }

    init(info) {
        this.info = info
        this.interface = new ChatInterface(this)
        this.messageList = new MessageList(this.interface, this.me)
        this.members = {}
        this.direct_to = info.is_direct? 
            this.info.members.find(m => m.id != this.me.id) : null

        info.members.forEach(m => {
            this.members[m.id] = m
            m.typingListener = new TypingListener(
                typingStatusInterval * 1.5, null, 
                () => this.updateTypingMembers(),
                null, () => this.updateTypingMembers())
        })

        this.subtitleList = Array(2)

        this.interface.initLoadMessagesFunction(() => this.loadMessageBatch())
        //this.interface.identifyMyMessages(null, me.id)
        //this.loadChatInfo()
        this.loadMessageBatch()
        this.setupSocket()

        this.updateLastSeen()
        this.setupHeader()
        this.readMessages()
    }

    sendTypingStatus(status) {
        console.log('sending status: ' + status)
        return fetch(`/settypingstatus?chatid=${this.chatid}&status=${status? 1 : 0}`)
    }

    setupHeader() {
        let name = utils.getChatName(this.info, this.me)
        let avatar_url = utils.getChatAvatarURL(this.info, this.me)
        let onclick = this.info.is_direct? () => location.replace('/user?id=' + utils.getOtherMember(this.info, this.me).id)
            : () => alert('hey!')

        this.subtitleList[0] = this.direct_to? null : utils.nItemsLabel(
            this.info.members.length, 'участник', 'участника', 'участников') 
        
        this.interface.setChatAvatar(avatar_url)
        this.interface.setChatTitle(name)
        this.interface.setHeaderClickEvent(onclick)
        this.updateSubtitle()
    }
 
    updateLastSeen() {
        if (!this.direct_to)
            return

        fetch('/getuser?id=' + this.direct_to.id)
        .then(r => r.json())
        .then(r => {
            this.subtitleList[0] = utils.getLastSeenStatus(new Date(r.last_seen))
            this.updateSubtitle()
            setTimeout(() => this.updateLastSeen(), updateLastSeenInterval * 1000)
        })
        
    }

    async loadToReach(msgid) {
        let least = parseInt(this.messageList.messages[0].id)
        let target = parseInt(msgid)

        if (target >= least)
            return true

        let response = await fetch(`/getdistancebetweenmsgs?chatid=${this.chatid}&id1=${least}&id2=${target}`)
            .then(r => r.json())

        let toLoad = response.distance + loadWindow

        if (toLoad > 150)
            return false

        await this.loadMessageBatch(toLoad)

        return true
    }

    loadMessageBatch(batchSize=loadWindow) {
        let first = this.messageList.getMessageByIndex(0)
        let loadStart = first? first.id - 1 : -1
        
        return fetch(`/getmessages?chatid=${chatid}&count=${batchSize}&start=${loadStart}`)
        .then(r => r.json())
        .then(msgs => {
            this.messageList.addMessages(msgs, true, true, false)

            if (msgs.length < batchSize) {
                this.interface.disableLoadingMore()
            }

            if (loadStart == -1)
                this.interface.delayedScroll()
        })
    }

    loadMessage(id) {
        return fetch(`/getmessage?msgid=${id}&chatid=${this.chatid}`)
        .then(r => r.json())
    }
    
    setupSocket() {
        socket.emit('join-chat', chatid);

        socket.on('message', msg => {
            console.log('message')
            console.log(msg)
            if(msg.chat_id != this.chatid)
                return
            this.messageList.addMessages([msg], true, false)
            this.readMessages()
        })

        socket.on('delete_message', w => {
            if(w.chatid != this.chatid) return
            this.messageList.deleteMessage(w.msgid)
        })

        socket.on('typing_status', msg => {
            if(msg.id == this.me.id)
                return
            let member = this.members[msg.id]
            if(msg.status == 1)
                member.typingListener.update()
            else
                member.typingListener.stop()
        })

        socket.on('last_read', msg => {
            if(msg.chatid != this.chatid) return
            
            let idx = this.messageList.messages.findIndex(w => w.id == msg.id)
            for(let i = 0; i <= idx; i++) {
                let msg = this.messageList.messages[i]
                if(msg.sender_id != this.me.id)
                    continue
                msg.read = true
                this.interface.updateMessage(msg.id)
            }
        })
    }

    readMessages() {
        return fetch('/readmessages?id=' + this.chatid)
    }

    getAvailableStickers() {
        return fetch('/getavailablestickerpacks')
        .then(r => r.json())
    }

    sendSticker(name, i) {
        this.send('sticker', `/public/stickers/${name}/${i}.png`)
    }

    sendDefault() {
        let attachedFiles = this.interface.getAttachedFiles()
        let content = this.interface.entry.value
        this.send('default', content, attachedFiles)
        .then(r => {
            if(r.success)
                this.interface.clearInput()
        })
    }

    send(type, content, files) {
        files ??= []

        if (!utils.strweight(content) && !files.length)
            return Promise.resolve({success: 0})
    
        let data = new FormData()
        data.append('type', type)
        data.append('content', content)

        let replyTo = this.interface.replyTo
        if(replyTo >= 0) {
            this.interface.setMessageIdToReplyTo(-1)
            data.append('reply_to', replyTo)
        }
        
        files.forEach(f => data.append('files', f));

        return fetch('/sendmsg?id=' + chatid, {
            method: 'POST',
            credentials: 'same-origin',
            body: data
        }).then(r => r.json())
        .then(r => {
            console.log(r);
            return r
        })

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


fetch('/auth')
.then((r) => r.json())
.then(user => {
    if(!user) {
        alert('Вы не вошли в аккаунт.')
        location.replace('/')
        return
    }
    chat = new Chat(user, chatid, socket)
})



