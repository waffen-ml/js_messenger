const notificationWindow = document.querySelector('.notification')
const textHolder = notificationWindow.querySelector('.text')
const imageHolder = notificationWindow.querySelector('.avatar')
const titleHolder = notificationWindow.querySelector('.title')



function playNotificationSound() {

}

function hideNotification() {

}

function showNotification(link, text, title, imagesrc) {

    if(text) {
        textHolder.style.display = 'block'
        textHolder.textContent = text
    } else {
        textHolder.style.display = 'none'
    }

    if(title) {
        titleHolder.style.display = 'block'
        titleHolder.textContent = title
    } else {
        titleHolder.style.display = 'none'
    }

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
    notificationWindow.style.animation = "notification-open 400ms ease-in-out";

    

    setTimeout(() => {
        hideNotification()
    }, 3000)



}