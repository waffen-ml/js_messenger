const notificationWindow = document.querySelector('.notification')
const textHolder = notificationWindow.querySelector('.text')
const imageHolder = notificationWindow.querySelector('.avatar')
const titleHolder = notificationWindow.querySelector('.title')
const burgerButton = document.querySelector('header .burger')
let hideTimeout = null
let unreadTable = {}

function updateBurgerUnread() {
    let c = 0

    Object.values(unreadTable).forEach(v => c += v)

    if(c == 0)
        burgerButton.removeAttribute('num')
    else
        burgerButton.setAttribute('num', c)
}

function updateMenuUnread(unread, menu) {
    Object.keys(unread).forEach(name => {
        let navButton = menu.querySelector(`.button[id="nav${name}"]`)
        let unreadSpan = navButton.querySelector('.unread')
        let count = unread[name]

        if(count > 0) {
            unreadSpan.classList.remove('zero')
            unreadSpan.textContent = count
        } else {
            unreadSpan.classList.add('zero')
        }
    }) 
}

function updateUnread(unread) {
    Object.keys(unread).forEach(k => {
        unreadTable[k] = unread[k]
    })
    updateBurgerUnread()
    document.querySelectorAll('nav').forEach(nav => {
        updateMenuUnread(unread, nav)
    })
}

socket.on('update_unread', (unread) => {
    updateUnread(unread)
})

fetch('/getunread')
.then(r => r.json())
.then(unread => {
    updateUnread(unread)
})

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