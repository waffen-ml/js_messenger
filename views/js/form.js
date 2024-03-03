function loadForm(onCreate) {
    let formName = document.querySelector('form').getAttribute('name');
    let mainForm = new Form(formName, null, (form, r) => {
        document.querySelector('.page-header').textContent = r.title;

        if (onCreate)
            onCreate(form, r);
    
        form.addSubmitButton('Отправить', (res) => {
            console.log(res)
            let params = new URLSearchParams(window.location.search);
            location.href = params.get('next') || '/';
        })
    
    }, () => { alert('error!') });
}