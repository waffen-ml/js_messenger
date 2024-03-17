console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('CoffeeTox1', {
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

    event.waitUntil(
        self.clients.matchAll().then(function(clientList) {
            if (clientList.length > 0) {
                return clientList[0].focus()
            } 
            return self.clients.openWindow('https://youtube.com');
        })
    )
})