let form = new Form('ebank', null, () => {
    form.addSubmitButton('Перевести', () => {
        window.location.reload();
    })
});

