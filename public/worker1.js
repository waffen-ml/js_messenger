console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('CoffeeTox', {
            body: data.body ?? 'HEY',
            icon: data.icon ?? 'https://coffeetox.ru/public/coffee.png',
            tag: data.tag,
            silent: false,
            dir: 'ltr',
            link: data.link
        })
    )
})

self.addEventListener('notificationclick', function(event) {
    alert('hey')
    if (!event.notification.link)
        return

    event.waitUntil(
        self.clients.matchAll().then(function(clientList) {
            if (clientList.length > 0) {
                return clientList[0].focus()
            } 
            return self.clients.openWindow(event.notification.link);
        })
    )
})