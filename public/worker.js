console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()
    
    let notification = new Notification(data.title ?? 'CoffeeTox', {
        body: data.body ?? 'HEY',
        icon: data.icon ?? 'https://coffeetox.ru/public/coffee.png',
        tag: data.tag,
        silent: false,
        dir: 'ltr',
    })

    notification.onclick = (e) => {
        if(data.link) {
            e.preventDefault();
            window.open(data.link, "_blank");
        }
    }

    self.registration.showNotification(notification)
})