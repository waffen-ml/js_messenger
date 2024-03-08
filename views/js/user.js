let url = new URLSearchParams(window.location.search)

utils.getUser(url.get('id'), url.get('tag'))
.then(user => {

    let lastSeenLabel = document.querySelector('.user .last-seen')
    lastSeenLabel.textContent = utils.getLastSeenStatus(
        user.last_seen? new Date(user.last_seen) : null)

    fetch('/auth')
    .then(r => r.json())
    .then(r => {
        let feed = new Feed(r, user.id, 
            document.querySelector('.feed'), 
            document.querySelector('main'))
    })
})