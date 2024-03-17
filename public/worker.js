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

    notification.addEventListener('notificationclick', (event) => {
        if(data.link) {
            event.notification.close()
            clients.openWindow("https://youtu.be/PAvHeRGZ_lA")
        }
    })

    self.registration.showNotification(notification)
})