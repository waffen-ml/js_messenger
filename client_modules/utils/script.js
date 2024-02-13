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
            + (date.getFullYear() == (new Date()).getFullYear()? '' : ' ' + date.getFullYear());
    }

    distributeFiles(msg, mimetypeField) {
        mimetypeField ??= 'mimetype'

        if(!msg.content)
            msg.content = {}
        msg.content.image = []
        msg.content.video = []
        msg.content.audio = []
        msg.content.other = [];

        (msg.files ?? []).forEach(f => {
            msg.content[f[mimetypeField]].push(f)
        })  

        delete msg.files
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

}

const utils = new Utils();