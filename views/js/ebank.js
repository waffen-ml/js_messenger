let url = new URLSearchParams(window.location.search)

let form = new Form('ebank', null, () => {
    form.addSubmitButton('Перевести', () => {
        window.location.reload()
    })

    if (url.get('sendto'))
        form.form.querySelector('input[name="usertag"]').value = url.get('sendto')
})

function openTransactions() {

    fetch('/gettransactions')
    .then(r => r.json())
    .then(transactions => {

        transactions.forEach(t => {
            t.datetime = new Date(t.datetime)
        })

        let popup = new Popup({
            closable: true,
            title: 'Недавние переводы',
            html: templateManager.createHTML('transactions', {transactions: transactions})
        })

        popup.addOption('Закрыть', () => true)

        popup.open()

    })

}
