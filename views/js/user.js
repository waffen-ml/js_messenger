let url = new URLSearchParams(window.location.search)

new Promise((resolve) => {
    if (url.get('id')) {
        resolve(url.get('id'))
        return
    }

    fetch('/getuser?tag=' + url.get('tag'))
    .then(r => r.json())
    .then(r => resolve(r.id))
}).then(id => {
    let feed = new Feed(id, 
        document.querySelector('.feed'), 
        document.querySelector('main'))
})

