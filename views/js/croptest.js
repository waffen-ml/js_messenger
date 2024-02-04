document.querySelector('.set-avatar').addEventListener('click', () => {
    avatarMaker.makeAvatar((blob) => {
        let formData = new FormData()
        formData.append('avatar', blob)
    
        fetch('/setavatar', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
        .then((r) => r.json())
        .then((r) => {
            if (!r.success)
                alert('Ошибка...')
            location.reload()
        })
    })
})