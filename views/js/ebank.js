let form = new Form('ebank', null, () => {
    form.addSubmitButton('Перевести', () => {
        window.location.reload();
    })
});

function openTransactions() {

    fetch('/gettransactions')
    .then(r => r.json())
    .then(transactions => {

        let popup = new Popup({
            closable: true,
            title: 'Недавние переводы',
            html: templateManager.createHTML({transactions: transactions})
        })

        popup.addOption('Закрыть', () => true)

        popup.open()

    })

}
