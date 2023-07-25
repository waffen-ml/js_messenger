const form = document.querySelector('form');

function unbindErrors() {
    document.querySelectorAll('.form-unit .error').forEach(err => {
        err.innerHTML = '';
        err.style.display = 'none';
    });
    document.querySelectorAll('.form-unit .incorrect').forEach(inc => {
        inc.classList.remove('incorrect');
    });
}

function bindErrors(err) {
    Object.keys(err).forEach((k, i) => {
        const fu = document.querySelector(`.form-unit#${k}`);
        fu.querySelector('[name]').classList.add('incorrect');
        if (err[k]) {
            const lbl = fu.querySelector('.error');
            lbl.style.display = 'block';
            lbl.textContent = err[k];
        }
    });
}

function isUploader(obj) {
    return obj.classList.contains('uploader');
}

function isOptional(obj) {
    return Boolean(obj.getAttribute('optional'));
}

function loopThroughInputs(func) {
    form.querySelectorAll('[name]').forEach(inp => {
        const name = inp.getAttribute('name');
        func(inp, name);
    });
}

function checkRequired() {
    let keys = [];

    loopThroughInputs((inp, name) => {
        if (isOptional(inp)) return;

        if (isUploader(inp)) {
            if (uplManager.getUploader(name).files.length)
                return;
        } else if (inp.value) return;

        keys.push(name);
    });

    if (!keys.length) return null;

    let err = {};
    keys.forEach(key => err[key] = '');

    return err;
}



form.addEventListener('submit', (e) => {
    e.preventDefault();
    unbindErrors();

    let reqErr = checkRequired();

    if (reqErr) {
        bindErrors(reqErr);
        return;
    }

    let fd = new FormData();

    loopThroughInputs((inp, name) => {
        if(isUploader(inp))
            uplManager.identifyUploader(inp)
            .files.forEach(f => fd.append(name, f));
        else fd.append(name, inp.value);
    });

    fetch('/form?name=' + form.getAttribute('name'), {
        method: 'POST',
        credentials: 'same-origin',
        body: fd
    })
    .then((r) => r.json())
    .then((r) => {
        if (r._out !== undefined) {
            window.location.href = r._out;
            return;
        }
        unbindErrors();
        bindErrors(r);
    })
});