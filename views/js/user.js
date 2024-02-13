let urlParams = new URLSearchParams(window.location.search)

new Promise((resolve) => {
    if (urlParams.get('id')) {
        resolve(urlParams.get('id'))
        return
    }

    fetch('/getuser?tag=' + urlParams.get('tag'))
    .then(r => r.json())
    .then(r => resolve(r.id))
}).then(id => {
    let feed = new Feed(id, 
        document.querySelector('.feed'), 
        document.querySelector('main'))
})

