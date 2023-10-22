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

class Form {
    constructor(name, addr, onCreate, onError) {
        this.name = name;
        this.addr = addr ?? '/form?name=' + name;
        this.form = document.querySelector(`form[name="${name}"]`);

        if(!this.form) {
            if(onError) onError();
            return;
        }
        else if (this.form.innerHTML) {
            if(onCreate) onCreate();
            processAddAttr(this.form);
            return;
        }
        
        fetch(`/getform?name=${name}`)
        .then(r => r.json())
        .then(r => {
            if (!r.html) {
                if(onError) onError();
                console.log('Form ' + name + ' has not been loaded');
                return;
            }

            this.form.innerHTML = r.html + this.form.innerHTML;
            delete r.html;
            if(onCreate) onCreate(r);
            processAddAttr(this.form);
        });
        
    }

    addSubmitButton(text, f) {
        if(this.submitBtn) return;

        let btn = document.createElement('input');
        btn.setAttribute('type', 'submit');
        btn.setAttribute('value', text);
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
            let tgt = inp;
    
            if (isBinaryInput(inp))
                tgt = fu.querySelector('.option-list')
            
            tgt.classList.add('incorrect');
    
            if (err[k]) {
                const lbl = fu.querySelector('.error');
                lbl.style.display = 'block';
                lbl.textContent = err[k];
            }
        });
    }

    loopThroughInputs(func) {
        this.form.querySelectorAll('.form-unit').forEach(fu => {
    
            fu.querySelectorAll('[name]').forEach(inp => {
                const name = inp.getAttribute('name');
                const type = inp.getAttribute('type');
                func(fu, inp, name, type);
            });
    
        });
    }

    checkRequired() {
        let keys = [];
        let binary = {};
    
        this.loopThroughInputs((fu, inp, name) => {
            if (isOptional(fu)) return;
            else if (isUploader(inp)) {
                if (uplManager.getUploader(name).files.length)
                    return;
            } else if(isBinaryInput(inp)) {
                binary[name] = binary[name] | inp.checked;
                return;
            } else if(inp.value)
                return;
    
            keys.push(name);
        });
    
        Object.keys(binary).forEach(k => {
            if (!binary[k]) keys.push(k);
        })
    
        if (!keys.length) return null;
    
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
    
        this.loopThroughInputs((fu, inp, name) => {
            if(isUploader(inp)) {
                uplManager.identifyUploader(inp)
                .files.forEach(f => fd.append(name, f));
                return;
            }
            else if (isBinaryInput(inp) && !inp.checked)
                return;

            console.log(name + ' ' + inp.value);
            
            fd.append(name, inp.value);
        });
        
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
