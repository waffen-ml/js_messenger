const publicVapidKey = 'BFz5DJhb3Fxpj5UB855BnYqXV6HCi2_UJyYGsgEFZRBAGCrm9XThi18-BFxb_cv7lgcrH0Lguj3J6SWfv3E02E8'
const avatarImg = document.querySelector('.avatar')

async function send() {
    let registration = await navigator.serviceWorker.getRegistration()

    if(!registration)
        registration = await navigator.serviceWorker.register('/public/worker.js')

    alert(registration)

    let subscription = 'getSubscription' in registration.pushManager?
        await registration.pushManager.getSubscription() : null

    alert(subscription)

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: utils.urlBase64ToUint8Array(publicVapidKey)
        })
    }

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
    send()
    .then(() => {
        alert('Успешно!')
    })
    .catch(err => {
        alert('Ошибка: ' + err.message)
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
                avatarImg.src = src
        })
    })

    maker.open()
})

document.querySelector('.delete-avatar').addEventListener('click', () => {
    fetch('/deleteuseravatar')
    .then(r => r.json())
    .then(r => {
        if (!r.success)
            alert('Ошибка...')
        else
            avatarImg.src = `/getuseravatar?id=${user.id}&w=` + new Date().getTime()
    })
})

document.querySelector('.exit-sessions').addEventListener('click', () => {
    fetch('/exitsessions')
    .then(r => r.json())
    .then(r => {
        if (!r.success)
            alert('Ошибка...')
        else
            alert('Успешно!')
    })
})

let user = null

fetch('/auth')
.then(r => r.json())
.then(r => {
    user = r

    let editProfileForm = new Form('editprofile', null, (form) => {
        form.getInput('name').value = user.name
        form.getInput('tag').value = user.tag
        form.getInput('bio').value = user.bio
    
        form.addSubmitButton('Сохранить', () => {
            alert('Сохранено!')
        })
    })

    let changePasswordForm = new Form('changepassword', null, (form) => {
        form.addSubmitButton('Сменить', () => {
            alert('Успешно!')
        })
    })
})