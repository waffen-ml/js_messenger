let url = new URLSearchParams(window.location.search)
let fsButton = document.querySelector('.button.add-friend')
let user = null

function togglefsbutton(state) {
    fsButton.style.pointerEvents = state? 'all' : 'none'
}

function changedFriendshipStatus(promise, fetch=true) {
    togglefsbutton(false)

    return promise.then(r => {
        return fetch? r.json() : r
    })
    .then((r) => {
        if(!r.success)
            alert('Ошибка!')
        return updateFriendshipStatus()
    })
}

function updateFriendshipButton(status) {
    togglefsbutton(true)

    if(status.friends) {
        fsButton.textContent = 'Удалить из друзей'
        fsButton.onclick = () => changedFriendshipStatus(
            fetch('/remove_friend?id=' + user.id))
    } else if(status.outgoing_request) {
        fsButton.textContent = 'Отозвать заявку'
        fsButton.onclick = () => changedFriendshipStatus(
            fetch('/cancel_friend_request?id=' + user.id))
    } else if (status.incoming_request) {
        fsButton.textContent = 'Принять заявку'
        fsButton.onclick = () => changedFriendshipStatus(
            fetch('/answer_friend_request?id=' + user.id))
    } else {
        fsButton.textContent = 'Добавить в друзья'
        fsButton.onclick = () => changedFriendshipStatus(
            fetch('/send_friend_request?id=' + user.id))
    }
}

function updateFriendshipStatus() {
    return fetch('/getfriendshipstatus?id=' + user.id)
    .then(r => r.json())
    .then(r => {
        updateFriendshipButton(r)
    })
}

function loadLastSeen() {
    let lastSeenLabel = document.querySelector('.user .last-seen')
    lastSeenLabel.textContent = utils.getLastSeenStatus(
        user.last_seen? new Date(user.last_seen) : null)
}

function loadFeed() {
    fetch('/auth')
    .then(r => r.json())
    .then(r => {
        let feed = new Feed(r, user.id, 
            document.querySelector('.feed'), 
            document.querySelector('main'))
    })
}


utils.getUser(url.get('id'), url.get('tag'))
.then(user_ => {
    user = user_
    updateFriendshipStatus()
    loadLastSeen()
    loadFeed()
})