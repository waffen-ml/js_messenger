document.querySelector('.add-friend').addEventListener('click', () => {

    let popup = new Popup({
        title: 'Добавить друга',
        closable: true,
        html: '<form name="addfriend"></form>',
    })

    popup.on('hidden', () => location.reload())

    let form = new Form('addfriend', null)

    popup.addOption('Отмена', () => true)
    popup.addOption('Добавить', () => {
        if (form)
            form.submit(() => {
                popup.close()
            })
    })
})

function answerRequest(id, accept) {
    fetch(`/answer_friend_request?accept=${accept? 1 : 0}&id=${id}`)
    .then(() => location.reload())
}

function declineRequest(id) {
    answerRequest(id, 0)
}

function acceptRequest(id) {
    answerRequest(id, 1)
}

function cancelRequest(id) {
    fetch(`/cancel_friend_request?id=${id}`)
    .then(() => location.reload())
}

function removeFriend(id) {
    fetch(`/remove_friend?id=${id}`)
    .then(() => location.reload())
}