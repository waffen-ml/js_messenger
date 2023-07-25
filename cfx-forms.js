class Form {
    constructor(name, title, units, val, ok, hints) {
        this.name = name;
        this.title = title;
        this.units = units;
        this.hints = hints
        this.val = val;
        this.ok = ok;

        this.units.forEach(u => {
            u.optional = u.optional? '1' : '';
        })
    }

    val(data, erf, cfx) {
        return this.val(data, erf, cfx);
    }

    ok(data, cfx) {
        return this.ok(data, cfx);
    }
}

class FormSystem {
    forms = {};

    addForm(form) {
        if (form.name in this.forms)
            throw new Error(`Form name "${form.name}" is already taken.`);
        this.forms[form.name] = form;
    }

    removeForm(name) {
        this.forms[name] = undefined;
    }

    getForm(name) {
        return this.forms[name];
    }

    passData(name, data, cfx) {
        const form = this.getForm(name);
        let output = {};

        form.val(data, (field, err) => {
            if (output[field] !== undefined) return;
            output[field] = err;
        }, cfx);

        if (Object.keys(output).length == 0)
            output['_out'] = form.ok(data, cfx);
        
        return output;
    }
}

const init = (cfx) => {
    cfx.forms = new FormSystem();
}

module.exports = { Form, FormSystem, init };