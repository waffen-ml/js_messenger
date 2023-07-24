const form = document.querySelector('form');

['required', 'multiple'].forEach(attrib => {
    document.querySelectorAll(`[${attrib}]`).forEach(obj => {
        const v = obj.getAttribute(attrib);
        if(v == false || !v) obj.removeAttribute(attrib);
    });
});

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
        const lbl = fu.querySelector('.error');
        lbl.style.display = 'block';
        lbl.textContent = err[k];
        fu.querySelector('[name]').classList.add('incorrect');
    });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/form?name=' + form.getAttribute('name'), {
        method: 'POST',
        credentials: 'same-origin',
        body: new FormData(form)
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