function isOptional(fu) {
    let opt = fu.getAttribute('optional');
    return Boolean(opt);
}

function isUploader(inp) {
    return inp.classList.contains('uploader');
}

function isBinaryInput(inp) {
    return ['checkbox', 'radio'].includes(inp.getAttribute('type'));
}

function processAddAttr(parent) {
    parent.querySelectorAll('[addattr]').forEach(tgt => {
        let attr = tgt.getAttribute('addattr');
        if(attr) {
            tgt.setAttribute(attr, true);
        }
    })
}

const generic = {
    check: (inp, type, name) => {
        switch(type) {
            case 'entry':
            case 'textarea':
            case 'text':
            case 'tel':
            case 'password':
            case 'email':
            case 'date':
                return Boolean(inp.value);
            case 'checkbox':
                return true;
            case 'radio':
                return inp.querySelectorAll('input')
                .some((w) => w.checked);
            case 'file':
                return uplManager.getUploader(name).files.length > 0;
            default:
                return true;
        }
    },
    submit: (fd, inp, type, name) => {
        switch(type) {
            case 'entry':
            case 'textarea':
            case 'text':
            case 'tel':
            case 'password':
            case 'email':
            case 'date':
                fd.append(name, inp.value);
                break;
            case 'checkbox':
            case 'radio':
                inp.querySelectorAll('input')
                .forEach(w => {
                    if (w.checked)
                        fd.append(name, w.value)
                })
                break;
            case 'file':
                uplManager.getUploader(name)
                .files.forEach(f => fd.append(name, f));
                break;
            default:
                break;
        }
    }
}

class Form {
    constructor(name, addr, onCreate, onError) {
        this.name = name;
        this.addr = addr ?? '/form?name=' + name;
        this.form = document.querySelector(`form[name="${name}"]`);
        this.custom = {};

        if(!this.form) {
            if(onError)
                onError();
            return;
        }
        else if (this.form.innerHTML) {
            if(onCreate)
                onCreate(this);
            this.process();
            return;
        }
        
        fetch(`/getform?name=${name}`)
        .then(r => r.json())
        .then(r => {
            if (!r.html) {
                if(onError)
                    onError();
                console.log('Form ' + name + ' has not been loaded');
                return;
            }

            this.form.innerHTML = r.html + this.form.innerHTML;
            delete r.html;
            if(onCreate)
                onCreate(this, r);
            this.process();
        });
        
    }

    process() {
        processAddAttr(this.form);
        uplManager.setupContainer(this.form);
    }

    setupCustomUnit(name, unit, submit, check) {
        let fu = this.form.querySelector('.form-unit#' + name);
        
        if(!fu || fu.getAttribute('type') != 'custom')
            return false;
        
        unit.setAttribute('name', name);
        fu.querySelector('.custom').appendChild(unit);
        this.custom[name] = {submit: submit, check: check};

        return true;
    }

    addSubmitButton(text, f) {
        if(this.submitBtn)
            return;

        let btn = document.createElement('input');
        btn.setAttribute('type', 'submit');
        btn.setAttribute('value', text ?? 'Отправить');
        btn.classList.add('button');
        this.submitBtn = btn;

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit(f);
        });

        this.form.appendChild(btn);
    }

    unbindErrors() {
        this.form.querySelectorAll('.form-unit .error').forEach(err => {
            err.innerHTML = '';
            err.style.display = 'none';
        });
        this.form.querySelectorAll('.form-unit .incorrect').forEach(inc => {
            inc.classList.remove('incorrect');
        });
    }

    bindErrors(err) {
        Object.keys(err).forEach((k, i) => {
            const fu = this.form.querySelector(`.form-unit#${k}`);
            const inp = fu.querySelector('[name]');
            inp.classList.add('incorrect');
            if (err[k]) {
                const lbl = fu.querySelector('.error');
                lbl.style.display = 'block';
                lbl.textContent = err[k];
            }
        });
    }

    loopThroughUnits(func) {
        this.form.querySelectorAll('.form-unit').forEach(fu => {
            let inp = fu.querySelector('[name]');
            let name = inp.getAttribute('name');
            let type = fu.getAttribute('type');
            func(fu, inp, name, type);
        });
    }

    getInput(name) {
        return this.form.querySelector(`[name="${name}"]`)
    }

    checkRequired() {
        let keys = [];

        this.loopThroughUnits((fu, inp, name, type) => {
            if(isOptional(fu))
                return;
            else if(type == 'custom' && (!this.custom[name].check
                    || this.custom[name].check(inp, name)))
                return;
            else if (type != 'custom' && generic.check(inp, type, name))
                return;
            
            keys.push(name);
        })
    
        if (!keys.length)
            return null;
    
        let err = {};
        keys.forEach(key => err[key] = '');
    
        return err;
    }

    submit(onSuccess) {
        this.unbindErrors();
        let reqErr = this.checkRequired();
    
        if (reqErr) {
            this.bindErrors(reqErr);
            return;
        }
    
        let fd = new FormData();
    
        this.loopThroughUnits((fu, inp, name, type) => {
            if(type == 'custom')
                this.custom[name].submit(fd, inp, name);
            else
                generic.submit(fd, inp, type, name);
        })
        
        fetch(this.addr, {
            method: 'POST',
            credentials: 'same-origin',
            body: fd
        })
        .then((r) => r.json())
        .then((r) => {
            if ('_out' in r) {
                if(onSuccess)
                    onSuccess(r._out);
                return;
            }
            this.unbindErrors();
            this.bindErrors(r);
        })
    }
}
