const formName = (new URLSearchParams(window.location.search)).get('name');
const mainForm = new Form(formName, (r) => {

    document.querySelector('.page-header').textContent = r.title;

    mainForm.addSubmitButton('Отправить', (res) => {
        location.href = '/';
    })

}, () => { alert('error!') });