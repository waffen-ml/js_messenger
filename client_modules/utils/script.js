class Utils {

    areDatesEqual(d1, d2) {
        return d1.getFullYear() == d2.getFullYear()
            && d1.getMonth() == d2.getMonth()
            && d1.getDate() == d2.getDate()
    }

    isToday(datetime) {
        let now = new Date();
        return this.areDatesEqual(datetime, now)
    }

    isYesterday(datetime) {
        let now = new Date();
        now.setDate(now.getDate() - 1);
        return this.areDatesEqual(datetime, now)
    }

    getLocalizedDateLabel(date, rel) 
    { 
        if (rel && this.isToday(date))
            return 'Сегодня'
        else if(rel && this.isYesterday(date))
            return 'Вчера'

        return date.toLocaleString('ru', { month: 'long', day: 'numeric'})
            + (this.hasCurrentYear(date)? '' : ' ' + date.getFullYear());
    }

    formatTime(dt) {
        return String(dt.getHours()).padStart(2, "0") + ':'
            + String(dt.getMinutes()).padStart(2, "0")
    }

    formatDate(dt, year=false) {
        let w = String(dt.getDate()).padStart(2, '0') + '.'
            + String(dt.getMonth() + 1).padStart(2, '0')
        if (year)
            w += '.' + String(dt.getFullYear())
        return w
    }

    hasCurrentYear(datetime) {
        let now = new Date();
        return datetime.getFullYear() == now.getFullYear()
    }

    getPostDatetimeLabel(datetime) {
        let time = this.hasCurrentYear(datetime)?
            ' в ' + this.formatTime(datetime) : '';
        
        return this.getLocalizedDateLabel(datetime, true) + time
    }

    getMessageDatetimeLabel(datetime) {
        if (this.isToday(datetime))
            return this.formatTime(datetime)
        else if (this.isYesterday(datetime))
            return 'вчера'
        return this.formatDate(datetime, !this.hasCurrentYear(datetime))
    }

    distributeFiles(msg, mimetypeField) {
        mimetypeField ??= 'mimetype'

        let files = {}
        files.image = []
        files.video = []
        files.audio = []
        files.other = [];

        (msg.files ?? []).forEach(f => {
            files[f[mimetypeField]].push(f)
        })  
        
        msg.files = files
    }

    differenceInMinutes(d1, d2) {
        return this.differenceInSeconds(d1, d2) / 60
    }

    differenceInSeconds(d1, d2) {
        return Math.abs(d1 - d2) / 1000
    }

    strweight(s) {
        for (let i = 0; i < s.length; i++)
            if (s[i] != ' ' && s[i] != '\n')
                return true
        return false
    }

    generateChatName(members, exclude, maxmembers=10) {
        let w = []
        let i = 0
        while(i < members.length && w.length < maxmembers) {
            if (!exclude || members[i].id != exclude.id)
                w.push(members[i])
            i++
        }
        let out = w.map(k => k.name).join(', ')
        if (members.length - (exclude != null) > w.length)
            out += '...'
        return out
    }

    getOtherMember(chat, member) {
        for(let i = 0; i < chat.members.length; i++)
            if (chat.members[i].id != member.id)
                return chat.members[i]
        return null
    }

    getChatAvatarURL(chat, observer) {
        if(chat.is_direct) {
            let other = this.getOtherMember(chat, observer)
            return '/getuseravatar?id=' + other.id
        }
        else {
            return '/getchatavatar?id=' + chat.id
        }
    }

    getChatName(chat, observer) {
        return chat.name || this.generateChatName(chat.members, observer)
    }

    urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/\-/g, "+")
          .replace(/_/g, "/");
      
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
      
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    getUser(id, tag) {
        id = id || ''
        tag = tag || ''
        return fetch(`/getuser?id=${id}&tag=${tag}`)
        .then(r => r.json())
    }

    wordForm(n, a, b, c) {
        // a -- минуту (1, 21, 31...)
        // b -- минуты (2, 3, 4, 24...)
        // c -- минут (5, 6, 7, ...)

        if (10 <= n && n <= 20)
            return c
        else if(n % 10 == 1)
            return a
        else if(n % 10 <= 4 && n % 10 != 0)
            return b
        else
            return c
    }

    nItemsLabel(n, a, b, c, hideOne) {
        let form = this.wordForm(n, a, b, c)
        if(n == 1 && hideOne)
            return form
        return n + ' ' + form
    }

    getLastSeenStatus(datetime) {
        if(datetime === null || isNaN(datetime))
            return 'Был в сети давно'

        let minutesAgo = Math.floor((new Date() - datetime) / 1000 / 60)
        let hoursAgo = Math.floor(minutesAgo / 60)

        console.log(minutesAgo)
        
        if (minutesAgo < 1)
            return 'Онлайн'
        else if(minutesAgo < 60)
            return `Был в сети ${this.nItemsLabel(minutesAgo, 'минуту', 'минуты', 'минут', true)} назад`
        else if(hoursAgo <= 3)
            return `Был в сети ${this.nItemsLabel(hoursAgo, 'час', 'часа', 'часов', true)} назад`
        else
            return 'Был в сети ' + this.getPostDatetimeLabel(datetime).toLowerCase()
    }

    bounds(element) {
        return element.getBoundingClientRect()
    }

    getMessagePreview(msg, myid, html=false, showName=true) {
        let preview = showName && msg.sender_name?
            (myid == msg.sender_id? 'Вы' : msg.sender_name) + ': ' : ''

        preview += this.getMessageContentPreview(msg, html)

        let numFiles = 0;

        if(Array.isArray(msg.files))
            numFiles = msg.files.length
        else
            Object.values(msg.files).forEach(w => numFiles += w.length)

        if(numFiles > 0)
            preview += ` [${this.nItemsLabel(numFiles, 'файл', 'файла', 'файлов')}]`

        return preview
    }

    getMessageContentPreview(msg, html=true) {
        let content;

        switch(msg.type) {
            case 'sticker':
                content = 'Стикер'
                break
            case 'default':
                content = msg.content
                break
        }

        content = contentCompiler.compile(content, {
            disableYT: true,
            disableLineBreaks: true
        })

        if(html)
            return content
        else {
            let div = document.createElement('div')
            div.innerHTML = content
            return div.textContent
        }
    }

    classAttr(d) {
        return Object.keys(d).filter(k => d[k]).join(' ')
    }
    
    escapeHTML(unsafe) {
        return unsafe
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;')
    }
}

const utils = new Utils();

exports.utils = utils