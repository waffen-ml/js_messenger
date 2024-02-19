const notificationWindow = document.querySelector('.notification')
const textHolder = notificationWindow.querySelector('.text')
const imageHolder = notificationWindow.querySelector('.avatar')
const titleHolder = notificationWindow.querySelector('.title')
let hideTimeout = null


function playNotificationSound() {

}

function hideNotification() {
    notificationWindow.style.animation = "notification-close 400ms ease-in-out forwards"
    hideTimeout = setTimeout(() => {
        notificationWindow.style.display = 'none'
    }, 400)
}

function showNotification(link, text, title, imagesrc) {

    if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
    }

    textHolder.textContent = text
    titleHolder.textContent = title ?? 'Уведомление'

    if (imagesrc) {
        imageHolder.src = imagesrc
        imageHolder.style.display = 'block'
    } else {
        imageHolder.style.display = 'none'
    }

    if (link) {
        notificationWindow.onclick = () => location.replace(link)
        notificationWindow.style.cursor = 'pointer'
    } else {
        notificationWindow.onclick = () => {}
        notificationWindow.style.cursor = 'default'
    }

    notificationWindow.style.display = "block";
    notificationWindow.style.animation = "none"
    notificationWindow.style.animation = "notification-open 400ms ease-in-out";

    hideTimeout = setTimeout(() => {
        hideNotification()
    }, 3000)
}