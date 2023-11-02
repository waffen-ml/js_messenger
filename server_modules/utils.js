class Utils {

    strweight(s) {
        for(let i = 0; i < s.length; i++)
            if(!'\n '.includes(s[i]))
                return true;
        return false;
    }

    simplifyMimetype(mt) {
        mt = mt.split('/')[0];
        if (mt != 'image' && mt != 'video' && mt != 'audio')
            return 'other'
        return mt
    }

    createContent(text, html) {
        return {
            text: text,
            html: html,
            image: [], video: [],
            audio: [], other: []
        };
    }

    getDateLabel(date, ll) {
        return date.toLocaleString(ll ?? 'default', { month: 'long', day: 'numeric'})
            + (date.getFullYear() == (new Date()).getFullYear()? '' : ', ' + date.getFullYear());
    }

    areDatesEqual(d1, d2) {
        return d1.getFullYear() == d2.getFullYear()
            && d1.getMonth() == d2.getMonth()
            && d1.getDate() == d2.getDate()
    }

    formatTimeUnit(n) {
        return (n < 10 ? '0' : '') + n
    }

    getTimeLabel(datetime) {
        let hourLabel = this.formatTimeUnit(datetime.getHours());
        let minuteLabel = this.formatTimeUnit(datetime.getMinutes()); 
        return hourLabel + ':' + minuteLabel;
    }

    getDatetimeLabel(datetime, fancy) {
        let now = new Date();
        let time = datetime.getFullYear() == now.getFullYear()?
            ' в ' + this.getTimeLabel(datetime) : '';
        
        if (fancy) {
            if(this.areDatesEqual(datetime, now))
                return 'Сегодня' + time;
        
            now.setDate(now.getDate() - 1);
        
            if (this.areDatesEqual(datetime, now))
                return 'Вчера' + time;
        }
    
        return this.getDateLabel(datetime) + time;
    }

    createMessage(msg, minor) {
        return {
            message_id: msg.message_id,
            sender_id: msg.sender_id,
            sender_tag: msg.sender_tag,
            sender_name: msg.sender_name,
            datetime: msg.datetime,
            content: exports.createContent(msg.text),
            minor: minor
        }
    }

    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    }

    mysql_escape (str) {
        return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\"+char;
                                     
                default:
                    return char;
            }
        });
    }

}

const utils = new Utils();
Object.getOwnPropertyNames(Utils.prototype).slice(1)
.forEach(method => {
    exports[method] = (...args) => utils[method](...args);
})

exports.init = (cfx) => {
    cfx.utils = utils;
}