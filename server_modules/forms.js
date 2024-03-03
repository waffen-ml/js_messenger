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

    passData(data, user, info) {
        let output = {}

        return this.val(data, (field, err) => {
            if (field === undefined)
                return Object.keys(output).length;
            else if (output[field] === undefined)
                output[field] = err
        }, user, info)
        .then((valdata) => {
            if (Object.keys(output).length > 0)
                return;
            return this.ok(data, user, valdata, info)
        })
        .then((out) => {
            output['_out'] = out
            return output
        })
    }

    val(data, erf, user, info) {
        return Promise.resolve(
            this.onVal? this.onVal(data, erf,  user, info) : null)
    }

    ok(data, user, valdata, info) {
        return Promise.resolve(this.onOk(data, user, valdata, info))
        .then(w => w ?? null)
    }
}

class FormSystem {
    forms = {}

    constructor(cfx) {
        this.cfx = cfx
    }

    addForm(form) {
        if (form.meta.name in this.forms)
            throw new Error(`Form name "${form.meta.name}" is already taken.`);
        this.forms[form.meta.name] = form;
    }

    getForm(name) {
        return this.forms[name];
    }

    passData(name, data, user, info) {
        return this.forms[name].passData(data, user, info);
    }
}

exports.Form = Form;
exports.init = (cfx) => {
    if(!cfx.files)
        return true

    cfx.forms = new FormSystem();

    cfx.core.safeRender('/form', (user, req, res) => {
        const form = cfx.forms.getForm(req.query.name)
        return {
            render: 'form',
            form: form
        }
    })

    cfx.core.safePost('/form', (user, req, res) => {
        let data = req.body;
    
        req.files.forEach(file => {
            const fn = file.fieldname
            if (!data[fn])
                data[fn] = []
            data[fn].push(file)
        })

        return cfx.forms.passData(req.query.name, data, user, {
            req: req,
            res: res
        })

    }, cfx.core.upload.any(), false)
}