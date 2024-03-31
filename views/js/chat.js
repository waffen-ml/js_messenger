const chatid = new URLSearchParams(window.location.search).get('id')
const loadWindow = 15
const updateLastSeenInterval = 20 // seconds
const typingStatusInterval = 5 // seconds
const messageLongPressMilliseconds = 400

const maxAudioDurationSeconds = 60

const emojiList = Array.from(`😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗
😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢
🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬
❤🧡💛💚💙💜🤎🖤🤍💔💯❗❌💘`)
.filter(w => w != '\n')


class LazyLoadingList {
    constructor(holder, scrollPage, load, convert, batchSize, startBatchSize, loadDistance=200) {
        this.holder = holder
        this.scrollPage = scrollPage ?? holder
        this.isLoading = false
        this.allowLoading = false
        this.batchSize = batchSize
        this.startBatchSize = startBatchSize ?? batchSize
        this.load = load
        this.convert = convert
        this.items = []
        this.loadDistance = loadDistance
        this.onload = () => {}

        this.reload()

        this.scrollPage.addEventListener('scroll', () => {
            this.loadIfNeeded()
        })
    }

    toggleLoading(state) {
        this.allowLoading = state
        this.loadIfNeeded()
    }

    reload() {
        this.items = []
        this.holder.innerHTML = ''
        this.loadIfNeeded(this.startBatchSize)
    }

    loadIfNeeded() {
        let reminder = this.scrollPage.scrollHeight - 
                this.scrollPage.scrollTop - this.scrollPage.clientHeight
        
        if (reminder < this.loadDistance)
            this.loadBatch(this.batchSize)
    }

    async loadBatch(size) {
        if(this.isLoading || !this.allowLoading)
            return

        this.isLoading = true
        
        let newItems = await this.load(size)

        if (newItems.length < size)
            this.toggleLoading(false)

        this.items.push(...newItems)
        newItems.forEach(item => {
            this.holder.appendChild(this.convert(item))
        })
        this.isLoading = false

        this.onload()
        this.loadIfNeeded()
    }
}

class LazyShowingList {
    constructor(items, holder, scrollPage, convert, batchSize, startBatchSize, loadDistance) {
        this.items = items
        this.nextToLoad = 0
        this.lazyList = new LazyLoadingList(holder, scrollPage,
            (count) => {
                let start = this.nextToLoad
                let end = Math.min(this.items.length - 1, start + count - 1)
                this.nextToLoad = end + 1
                return Promise.resolve(this.items.slice(start, end + 1))
            },
        convert, batchSize, startBatchSize, loadDistance)
    }

    restart(newItems) {
        this.lazyList.reload()
        this.items = newItems ?? this.items
        this.nextToLoad = 0
    }
}

class ChatInspector {

    constructor(chat) {
        this.chat = chat
        this.chatSettings = new ChatSettings({
            name: chat.info.name,
            description: chat.info.description,
            chatId: chat.info.id,
            hasAvatar: chat.info.avatar_id !== null,
            isPublic: Boolean(chat.info.is_public),
            defaultName: this.generateDefaultName(),
            readOnly: false//!this.chat.me.is_admin
        })

        this.chatSettings.onchange = () => {
            let changes = this.chatSettings.getChanges()
            this.toggleUnsavedHandling(Object.keys(changes).length > 0)
        }

        this.popup = new Popup({closable: true, className: 'chat-inspect'})
        this.popup.content.appendChild(this.chatSettings.element)

        this.popup.content.append(...templateManager.createElement('chat-popup',
            {chatid: chat.chatid, direct: chat.info.is_direct, admin: chat.me.is_admin}))

        this.popup.content.querySelectorAll('.controls a')
            .forEach(button => {
                button.onclick = () => this.showTab(button.getAttribute('id').split('-')[1])
            })

        this.showTab('members')

        this.lazyLists = {}

        this.chat.updateAllMembersLastSeenStatus()
        .then(() => {
            this.lazyLists['members'] = new LazyShowingList(
                this.chat.info.members, this.popup.querySelector('#members .flex-holder'),
                this.popup.querySelector('.tab#members'),
                (item) => {
                    return templateManager.createElement('chat-memberlist-item', {
                        admin: item.is_admin,
                        canDelete: this.chat.me.is_admin,
                        id: item.id,
                        name: item.name,
                        lastSeen: item.last_seen
                    })
                }, 10)
        })

        this.chat.getFilesWithMimetype('audio')
        .then(files => {
            this.lazyLists['audio'] = new LazyShowingList(
                files.reverse(), this.popup.querySelector('#audio .flex-holder'),
                this.popup.querySelector('.tab#audio'),
                (item) => {
                    return templateManager.createElement('chat-audiolist-item', item)
                }, 10)
        })

        this.chat.getFilesWithMimetype('image', 'video')
        .then(files => {
            this.lazyLists['media'] = new LazyShowingList(
                files.reverse(), this.popup.querySelector('#media .grid-holder'),
                this.popup.querySelector('.tab#media'),
                (item) => {
                    return templateManager.createElement('chat-medialist-item', item)
                }, 5)
            this.lazyLists['media'].lazyList.onload = () => setupInspectObjects(
                this.popup.querySelector('#media'))
        })


    }

    updateMembers() {

    }

    updateMembers() {


    }

    showTab(id) {
        this.popup.content.querySelectorAll('.tab')
            .forEach(tab => tab.classList.remove('active'))
        this.popup.content.querySelector('.tab#' + id).classList.add('active')

        this.popup.content.querySelectorAll('.controls a')
            .forEach(a => a.classList.remove('chosen'))
        this.popup.content.querySelector('.controls #show-' + id).classList.add('chosen')

        this.lazyLists[id].lazyList.toggleLoading(true)
    }

    toggleUnsavedHandling(state) {
        this.popup.removeOption('Отмена')
        this.popup.removeOption('Сохранить')

        if(state) {
            this.popup.addOption('Сохранить', () => {
                this.chat.applyInfoChanges(this.chatSettings.getChanges())
                return true
            })
            this.popup.addOption('Отмена', () => {
                return true
            })
        }
    }

    generateDefaultName() {
        return utils.generateChatName(this.chat.info.members, this.chat.me, 5)
    }

    open() {
        this.popup.open()
    }

}


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
        this.inputBar = document.querySelector('.input-bar')
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
        this.setupAudioRecording()

        this.focusEntry()
        this.onInputChange()

        this.scrollDown(false)
    }

    inspectChat() {

        let inspector = new ChatInspector(this.chat)
        inspector.open()

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

        this.fileUploader.on('append', () => this.onInputChange())
        this.fileUploader.on('remove', () => this.onInputChange())

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

            let nav = cw.window.querySelector('.navigation')
            
            nav.addEventListener('wheel', e => {
                nav.scrollBy({
                    left: e.deltaY < 0? -30 : 30
                })
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
            else if(!text && this.typingListener.isTyping())
                this.typingListener.stop()
        
            this.onInputChange()
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
        this.onInputChange()
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

    onInputChange() {
        if(!utils.strweight(this.entry.value) && this.getAttachedFiles().length == 0)
            this.setInputBarClass('audio-record-available')
        else    
            this.setInputBarClass()

        let fileBtn = this.inputBar.querySelector('#file')
        let count = this.getAttachedFiles().length
        fileBtn.textContent = (count? count + ' ' : '') + '📁'
    }

    setupAudioRecording() {
        this.inputBar.querySelector('#record').addEventListener('click', () => {
            this.chat.audioRecorder.start()
            .catch(error => {
                alert(error)
            })
        })
        this.inputBar.querySelector('#discard-audio').addEventListener('click', () => this.chat.audioRecorder.stop(false))
        this.inputBar.querySelector('#send-audio').addEventListener('click', () => this.chat.audioRecorder.stop(true))
    }

    startRecording() {
        this.setInputBarClass('recording-audio')
        let span = this.inputBar.querySelector('.audio-record-bar span')

        let seconds = 0

        span.textContent = '0 с'
        this.recordingIntervalId = setInterval(() => {
            span.textContent = (++seconds) + ' с'
        }, 1000)
    }
    
    stopRecording() {
        if(this.recordingIntervalId && this.recordingIntervalId >= 0) {
            clearInterval(this.recordingIntervalId)
            this.recordingIntervalId = null
        }
        
        this.setInputBarClass('')
        this.onInputChange()
    }

    setInputBarClass(className='') {
        this.inputBar.className = 'input-bar ' + className
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

    init(info) {
        this.info = info
        this.interface = new ChatInterface(this)
        this.messageList = new MessageList(this.interface, this.me)
        this.members = {}
        this.direct_to = info.is_direct? 
            this.info.members.find(m => m.id != this.me.id) : null

        info.members.forEach(m => {

            if(m.id == this.me.id && m.is_admin)
                this.me.is_admin = true

            this.members[m.id] = m
            m.typingListener = new TypingListener(
                typingStatusInterval * 1.5, null, 
                () => this.updateTypingMembers(),
                null, () => this.updateTypingMembers())
        })

        this.subtitleList = Array(2)
        this.audioRecorder = new AudioRecorder(this)
        this.focusedEventCallbacks = {}
        this.focusedEvents = []

        this.interface.initLoadMessagesFunction(() => this.loadMessageBatch())
        //this.interface.identifyMyMessages(null, me.id)
        //this.loadChatInfo()
        this.loadMessageBatch()
        this.setupSocket()

        this.updateLastSeen()
        this.setupHeader()
        this.readMessages()

        addEventListener('focus', () => {
            this.processFocusedEvents()
        })

        console.log(this.info)
    }

    applyInfoChanges(changes) {
        let fd = new FormData()

        if(changes.name === null)
            fd.append('deleteName', 1)
        else if(changes.name)
            fd.append('name', changes.name)
        if (changes.description)
            fd.append('description', changes.description)
        if(changes.avatarBlob === null)
            fd.append('deleteAvatar', 1)
        else if(changes.avatarBlob)
            fd.append('avatar', changes.avatarBlob)
        if(changes.isPublic !== undefined)
            fd.append('isPublic', changes.isPublic? 1 : 0)

        return fetch(`/changechatinfo?chatid=${this.chatid}`, {
            method: 'POST',
            credentials: "same-origin",
            body: fd
        }).then(r => r.json())
        .then(r => {
            console.log('WEWQEW')
            console.log(r)
        })
    }

    updateInfo() {
        return fetch(`/getchatinfo?id=${this.chatid}&members=0`)
        .then(r => r.json())
        .then(info => {

            this.info.name = info.name
            this.info.description = info.description
            this.info.avatar_id = info.avatar_id
            this.info.is_public = info.is_public

            this.setupHeader()
            
        })
    }

    getStream(options) {
        navigator.getUserMedia  = navigator.getUserMedia
            || navigator.webkitGetUserMedia 
            || navigator.mozGetUserMedia 
            || navigator.msGetUserMedia

        if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            return navigator.mediaDevices.getUserMedia(options)
            .catch((err) => {
                alert(err)
                return null
            })
        else {
            alert('navigator does not have necessary methods')
            return Promise.resolve(null)
        }
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

    sendTypingStatus(status) {
        console.log('sending status: ' + status)
        return fetch(`/settypingstatus?chatid=${this.chatid}&status=${status? 1 : 0}`)
    }

    setupHeader() {
        let name = utils.getChatName(this.info, this.me)
        let onclick = () => this.interface.inspectChat()

        this.subtitleList[0] = this.direct_to? null : utils.nItemsLabel(
            this.info.members.length, 'участник', 'участника', 'участников') 
        
        this.interface.setChatAvatar(`/getchatavatar?id=${this.chatid}&t=` + Math.random())
        this.interface.setChatTitle(name)
        this.interface.setHeaderClickEvent(onclick)
        this.updateSubtitle()
    }
 
    updateLastSeen() {
        if (!this.direct_to)
            return

        const update = () => {
            return fetch('/getuser?id=' + this.direct_to.id)
            .then(r => r.json())
            .then(r => {
                this.subtitleList[0] = utils.getLastSeenStatus(new Date(r.last_seen))
                this.updateSubtitle()
            })
        }

        update()

        setInterval(() => {
            if(!document.hasFocus())
                return
            update()
        }, updateLastSeenInterval * 1000)
        
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

    setupFocusedEventType(type, cb) {
        this.focusedEventCallbacks[type] = cb

        socket.on(type, data => {
            this.focusedEvents.push({type: type, data: data})

            if(document.hasFocus())
                this.processFocusedEvents()
        })
    }

    processFocusedEvents() {
        this.focusedEvents.forEach(event => {
            this.focusedEventCallbacks[event.type](event.data)
        })
        this.focusedEvents = []
    }
    
    setupSocket() {
        socket.emit('join-chat', chatid)

        this.setupFocusedEventType('message', msg => {
            console.log('message')
            console.log(msg)
            if(msg.chat_id != this.chatid)
                return
            this.messageList.addMessages([msg], true, false)
            this.readMessages()      
        })

        this.setupFocusedEventType('delete_message', w => {
            if(w.chatid != this.chatid) return
            this.messageList.deleteMessage(w.msgid)
        })

        this.setupFocusedEventType('last_read', msg => {
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

        socket.on('typing_status', msg => {
            if(msg.id == this.me.id)
                return
            let member = this.members[msg.id]
            if(msg.status == 1)
                member.typingListener.update()
            else
                member.typingListener.stop()
        })

        socket.on('update_info', () => {
            this.updateInfo()
        })
    }

    updateAllMembersLastSeenStatus() {
        return Promise.all(this.info.members.map(
            member => fetch('/getuserinfo?id=' + member.id)
            .then(r => r.json())
            .then(r => {
                member.last_seen = r.last_seen
                return member
            })
        ))
    }

    getFilesWithMimetype(...mt) {
        return fetch(`/getfilesmt?chatid=${this.chatid}&mt=` + mt.join(','))
        .then(r => r.json())
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

class AudioRecorder {
    constructor(chat) {
        this.chat = chat
        this.interface = chat.interface
        this.recordTimeoutId = -1
        this.chunks = []
    
    }

    async initRecorder() {
        this.audioStream = await this.chat.getStream({audio: true})
            
        if(!this.audioStream)   
            throw Error('Audio is not available')
    
        this.recorder = new MediaRecorder(this.audioStream)
        this.recorder.addEventListener('dataavailable', (e) => {
            this.chunks.push(e.data)
        })
    }
    
    isRecording() {
        return this.recorder.state == 'recording'
    }

    async start() {
        await this.initRecorder()
        
        if(this.isRecording())
            throw Error('Recorder is busy')

        this.clear()

        this.recordTimeoutId = setTimeout(() => {
            this.recordTimeoutId = -1
            this.stop(true)
        }, maxAudioDurationSeconds * 1000)

        this.recorder.start(50)

        this.interface.startRecording()

        console.log('started recording')
    }

    stop(send) {
        if(this.recordTimeoutId >= 0) {
            clearTimeout(this.recordTimeoutId)
            this.recordTimeoutId = -1
        }
        this.recorder.stop()
        this.interface.stopRecording()
        console.log('stopped recording')

        this.audioStream.getTracks().forEach(function(track) {
            track.stop()
        })

        if(!send)
            return

        let blob = new Blob(this.chunks, {type: 'audio/ogg; codecs=opus'})
        this.chat.send('default', '',  [blob])
    }

    clear() {
        this.chunks = []
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



