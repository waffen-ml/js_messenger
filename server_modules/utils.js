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

    createContent(text, html, files, mmt) {
        mmt ??= 'file_mimetype'
        let w = {
            text: text,
            html: html,
            image: [], video: [],
            audio: [], other: []
        };
        (files ?? []).forEach(f => w[f[mmt]].push(f))
        return w
    }

    getDateLabel(date, ll) {
        if (ll) 
            return date.toLocaleString(ll, { month: 'long', day: 'numeric'})
                + (this.hasCurrentYear(date)? '' : ' ' + date.getFullYear());
        let day = this.addLeadingZeros(date.getDay(), 2)
        let month = this.addLeadingZeros(date.getMonth() + 1, 2)
        return day + ":" + month + (this.hasCurrentYear(date)? '' : '.' + date.getFullYear())
    }

    areDatesEqual(d1, d2) {
        return d1.getFullYear() == d2.getFullYear()
            && d1.getMonth() == d2.getMonth()
            && d1.getDate() == d2.getDate()
    }

    addLeadingZeros(n, z) {
        n = n.toString();
        return '0'.repeat(Math.max(0, z - n.length)) + n
    }

    getTimeLabel(datetime) {
        let hourLabel = this.addLeadingZeros(datetime.getHours(), 2);
        let minuteLabel = this.addLeadingZeros(datetime.getMinutes(), 2); 
        return hourLabel + ':' + minuteLabel;
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

    hasCurrentYear(datetime) {
        let now = new Date();
        return datetime.getFullYear() == now.getFullYear()
    }

    getPostDatetimeLabel(datetime, fancy) {
        let time = this.hasCurrentYear(datetime)?
            ' в ' + this.getTimeLabel(datetime) : '';
        
        if (fancy) {
            if(this.isToday(datetime))
                return 'Сегодня' + time;
            else if (this.isYesterday(datetime))
                return 'Вчера' + time;
        }
    
        return this.getDateLabel(datetime, 'ru') + time;
    }

    getMessageDatetimeLabel(datetime) {
        if (this.isToday(datetime))
            return this.getTimeLabel(datetime);
        else if (this.isYesterday(datetime))
            return 'вчера'
        return this.getDateLabel(datetime)
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

    getRandomUniform(min, max) {
        return Math.random() * (max - min) + min;
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    parseArrayOutput(raw, arrname, rep, mainIdCol='id') {
        let table = rep

        if (Array.isArray(rep)) {
            table = {}
            rep.forEach(w => table[w] = w)
        }

        Object.keys(rep).forEach(k => {
            rep[k] ??= k
        })

        let result = []
        let obj = {}
        obj[mainIdCol] = -1

        for(let i = 0; i < raw.length; i++) {
            let w = {}
            let isNullElement = true
            Object.keys(table).forEach(c => {
                if (raw[i][c] !== null)
                    isNullElement = false
                w[table[c]] = raw[i][c]
            })
            if (raw[i][mainIdCol] != obj[mainIdCol]) {
                result.push(obj)
                obj = raw[i]
                Object.keys(table).forEach(c => {
                    delete obj[c]
                })
                obj[arrname] = []
            }
            if (!isNullElement) {
                obj[arrname].push(w)
            }
        }
        result.push(obj)
        result.shift()
        return result
    }

    makeEnum(arr) {
        let enum = {}
        arr.forEach(a => enum[a] = a)
        return enum
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
