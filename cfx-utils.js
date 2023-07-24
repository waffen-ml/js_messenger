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
        return Object.keys(this.data).length;
    }

    values() {
        return Object.values(this.data);
    }

    get(id) {
        return this.data[id];
    }

    remove(id) {
        this.data[id] = undefined;
    }
}

exports.createContent = (text, files) => {
    let content = {
        'image': [], 'video': [],
        'audio': [], 'other': []
    };

    files.forEach(file => {
        const type = file.mimetype.split('/')[0];
        const sel = type in content? type : 'other';
        content[sel].push(file.filename);
    });

    content.text = text;

    return content;
}

exports.clamp = (num, min, max) => Math.min(Math.max(num, min), max);

