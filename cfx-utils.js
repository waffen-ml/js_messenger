exports.IndexedDict = class {
    current = 0;
    data = {};

    next() {
        return this.current++;
    }

    add(obj, isfunc) {
        isfunc ??= false;
        const id = this.next();
        obj = isfunc? obj(id) : obj;
        this.data[id] = obj;
        return id;
    }

    length() {
        return this.keys().length;
    }

    keys() {
        return Object.keys(this.data)
    }

    values() {
        return Object.values(this.data);
    }

    getNthKey(n) {
        const keys = this.keys();
        return keys[n < 0? keys.length + n : n];
    }

    getNthValue(n) {
        const values = this.values();
        return values[n < 0? values.length + n : n];
    }

    get(id) {
        return this.data[id];
    }

    remove(id) {
        delete this.data[id];
    }
}

exports.EventHandler = class {
    listeners = {};

    clearAll() {
        this.listeners = {};
    }

    clearListeners(name) {
        delete this.listeners[name];
    }

    addListener(name, func) {
        if (!this.listeners[name])
            this.listeners[name] = [];
        this.listeners[name].push(func);
    }

    addListeners(...args) {
        if (args.length == 1 && args[0])
            Object.keys(args[0]).forEach(k => {
                this.addListeners(k, args[0][k]);
            });
        else if (args.length == 2) {
            const ithrough = Array.isArray(args[1])? args[1] : [args[1]];
            ithrough.forEach(efunc => this.addListener(args[0], efunc))   
        }
    }

    fire(name, ...args) {
        if(!this.listeners[name]) return;
        this.listeners[name].forEach(l => l(...args))
    }
};

exports.getDayAndMonth = (date, ll) => {
    return date.toLocaleString(ll ?? 'default', { month: 'long', day: 'numeric'});
}

exports.createContent = (text, files) => {
    let content = {
        'image': [], 'video': [],
        'audio': [], 'other': []
    };

    (files ?? []).forEach(file => {
        const type = file.mimetype.split('/')[0];
        const sel = type in content? type : 'other';
        content[sel].push(file.filename);
    });

    content.text = text ?? '';

    return content;
}

exports.splitContent = (content) => {
    if (!(content.image.length + content.video.length
        && content.other.length + content.audio.length)) return [content];
    return [
        {
            text: content.text,
            image: content.image,
            video: content.video,
        },
        {
            audio: content.audio,
            other: content.other
        }   
    ];
}   

exports.clamp = (num, min, max) => Math.min(Math.max(num, min), max);

