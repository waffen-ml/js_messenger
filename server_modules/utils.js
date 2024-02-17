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

    formatTime(dt) {
        return String(dt.getHours()).padStart(2, "0") + ':'
            + String(dt.getMinutes()).padStart(2, "0")
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
        let e = {}
        arr.forEach(a => e[a] = a)
        return e
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
