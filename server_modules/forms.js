class Form {
    constructor(meta, units, onVal, onOk, hints) {
        this.meta = meta;
        this.units = units;
        this.hints = hints
        this.onVal = onVal;
        this.onOk = onOk;

        this.units.forEach(u => {
            u.optional = u.optional? '1' : '';
        })
    }

    passData(data, ...args) {
        let output = {};

        this.val(data, (field, err) => {
            if (output[field] === undefined)
                output[field] = err;
        }, ...args);

        if (Object.keys(output).length == 0)
            output['_out'] = this.ok(data, ...args);
        
        return output;
    }

    val(data, erf, ...args) {
        if (this.onVal)
            this.onVal(data, erf, ...args);
    }

    ok(data, ...args) {
        return this.onOk(data, ...args);
    }
}

class FormSystem {
    forms = {};

    addForm(form, name, title) {
        if (name in this.forms)
            throw new Error(`Form name "${name}" is already taken.`);
        form.meta = {name: name, title: title}
        this.forms[name] = form;
    }

    removeForm(name) {
        this.forms[name] = undefined;
    }

    getForm(name) {
        return this.forms[name];
    }

    passData(name, data, cfx) {
        return this.forms[name].passData(data, cfx);
    }
}

exports.Form = Form;
exports.init = (cfx) => {
    cfx.forms = new FormSystem();
}