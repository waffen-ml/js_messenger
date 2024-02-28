const notificationWindow = document.querySelector('.notification')
const textHolder = notificationWindow.querySelector('.text')
const imageHolder = notificationWindow.querySelector('.avatar')
const titleHolder = notificationWindow.querySelector('.title')
let hideTimeout = null

function updateMenuUnread(unread) {
    console.log(unread)
    Object.keys(unread).forEach(name => {
        let navButton = document.querySelector(`nav .button[id="nav${name}"]`)
        let count = unread[name].count

        if(count > 0) {
            navButton.classList.remove('zero')
            navButton.querySelector('.unread').textContent = count
        } else {
            navButton.classList.add('zero')
        }
    })

}

socket.on('update_unread', (unread) => {
    updateMenuUnread(unread)
})

fetch('/getunread')
.then(r => r.json())
.then(unread => updateMenuUnread(unread))

function hideNotification() {
    notificationWindow.style.animation = "notification-close 400ms ease-in-out forwards"
    hideTimeout = setTimeout(() => {
        notificationWindow.style.display = 'none'
    }, 400)
}

function showNotification(options) {

    if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
    }
    textHolder.textContent = options.text
    titleHolder.textContent = options.title ?? 'Уведомление'

    if (options.imagesrc) {
        imageHolder.src = options.imagesrc
        imageHolder.style.display = 'block'
    } else {
        imageHolder.style.display = 'none'
    }

    if (options.link) {
        notificationWindow.onclick = () => location.replace(options.link)
        notificationWindow.style.cursor = 'pointer'
    } else {
        notificationWindow.onclick = () => {}
        notificationWindow.style.cursor = 'default'
    }

    notificationWindow.style.display = "block"
    notificationWindow.style.animation = "none"
    void notificationWindow.offsetWidth
    notificationWindow.style.animation = "notification-open 400ms ease-in-out"

    hideTimeout = setTimeout(() => {
        hideNotification()
    }, 3000)
}