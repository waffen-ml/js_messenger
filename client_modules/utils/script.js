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

    getPostDatetimeLabel(datetime, fancy) {
        let time = this.hasCurrentYear(datetime)?
            ' в ' + this.formatTime(datetime) : '';
        
        if (fancy) {
            if(this.isToday(datetime))
                return 'Сегодня' + time;
            else if (this.isYesterday(datetime))
                return 'Вчера' + time;
        }

        return this.getLocalizedDateLabel(datetime, 'ru') + time
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
        return Math.abs(d1 - d2) / 1000 / 60
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

        if (10 <= b && b <= 20)
            return c
        else if(n % 10 == 1)
            return a
        else if(n % 10 <= 4)
            return b
        else
            return c
    }

    getLastSeenStatus(datetime) {
        if(datetime === null || isNaN(datetime))
            return 'Был в сети давно'

        let minutesAgo = Math.floor((new Date() - datetime) / 1000 / 60)
        let hoursAgo = Math.floor(minutesAgo / 60)
        
        if (minutesAgo < 3)
            return 'Онлайн'
        else if(minutesAgo < 60)
            return `Был в сети ${minutesAgo} ${wordForm(minutesAgo, 'минуту', 'минуты', 'минут')} назад`
        else if(hoursAgo <= 3)
            return `Был в сети ${hoursAgo} ${wordForm(hoursAgo, 'час', 'часа', 'часов')} назад`
        else
            return 'Был в сети ' + this.getLocalizedDateLabel(datetime, true)
    }

}

const utils = new Utils();