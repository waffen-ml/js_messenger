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

document.querySelector('.set-avatar').addEventListener('click', () => {

    let maker = new AvatarMaker((blob) => {
        let formData = new FormData()
        formData.append('avatar', blob)
    
        fetch('/setavatar', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
        .then((r) => r.text())
        .then((r) => {
            console.log(r)
            return
            if (!r.success)
                alert('Ошибка...')
            location.reload()
        })
    })

    maker.open()
})