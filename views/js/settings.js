const publicVapidKey = 'BFz5DJhb3Fxpj5UB855BnYqXV6HCi2_UJyYGsgEFZRBAGCrm9XThi18-BFxb_cv7lgcrH0Lguj3J6SWfv3E02E8'

async function send() {
    const register = await navigator.serviceWorker.register('/public/worker.js')
    const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: utils.urlBase64ToUint8Array(publicVapidKey)
    })
    let fd = new FormData()
    fd.append('subscription', JSON.stringify(subscription))

    await fetch('/subnotif', {
        method: 'POST',
        body: fd,
        headers: {
            'credentials': 'same-origin'
        }
    })
}

document.querySelector('.enable-notifications').addEventListener('click', () => {
    send().catch(err => {
        console.log('Ошибка: ' + err.message)
    })
})

document.querySelector('.set-avatar').addEventListener('click', () => {
    let maker = new AvatarMaker((blob, src) => {
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
            else
                document.querySelector('.avatar').src = src
        })
    })

    maker.open()
})

let form = new Form('editprofile', null, () => {
    form.addSubmitButton('Сохранить', () => {
        alert('Сохранено!')
    })
})