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

        return this.val(data, (field, err) => {
            if (field === undefined)
                return Object.keys(output).length;
            else if (output[field] === undefined)
                output[field] = err;
        }, ...args)
        .then((valdata) => {
            if (Object.keys(output).length > 0)
                return;
            return this.ok(data, valdata, ...args);
        })
        .then((out) => {
            output['_out'] = out;
            return output;
        })
    }

    val(data, erf, ...args) {
        return Promise.resolve(
            this.onVal? this.onVal(data, erf, ...args) : null)
    }

    ok(data, ...args) {
        return Promise.resolve(this.onOk(data, ...args))
            .then((data) => data ?? null)
    }
}

class FormSystem {
    forms = {};

    addForm(form) {
        if (form.meta.name in this.forms)
            throw new Error(`Form name "${form.meta.name}" is already taken.`);
        this.forms[form.meta.name] = form;
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

    cfx.core.safeRender('/form', (req, res) => {
        const form = cfx.forms.getForm(req.query.name)
        return {
            render: 'form',
            form: form
        }
    });
    
    cfx.core.app.post('/form', cfx.core.upload.any(), (req, res) => {
        let data = req.body;
    
        req.files.forEach(file => {
            const fn = file.fieldname;
            if (!data[fn])
                data[fn] = [];
            data[fn].push(file);
        });
    
        cfx.forms.passData(
            req.query.name,
            data, cfx.as(req.session))
        .then(out => {
            //console.log(out);
            res.send(out);
        })
    });     
    
}