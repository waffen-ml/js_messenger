function loadForm(onCreate) {
    let formName = document.querySelector('form').getAttribute('name');
    let mainForm = new Form(formName, null, (r) => {
        document.querySelector('.page-header').textContent = r.title;

        if (onCreate)
            onCreate(mainForm);
    
        mainForm.addSubmitButton('Отправить', (res) => {
            let params = new URLSearchParams(window.location.search);
            location.href = params.get('next') || '/';
        })
    
    }, () => { alert('error!') });
}