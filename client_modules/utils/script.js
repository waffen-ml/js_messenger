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


}

const utils = new Utils();