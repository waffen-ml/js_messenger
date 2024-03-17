console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('1556', {
            body: data.body ?? 'HEY',
            icon: data.icon ?? 'https://coffeetox.ru/public/coffee.png',
            tag: data.tag,
            silent: false,
            dir: 'ltr',
            data: data
        })
    )
})

self.addEventListener('notificationclick', function(event) {
    event.waitUntil(
        self.clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        }).then((clientList) => {
            let cfxClient = null

            clientList.every(client => {
                let url = new URL(client.url)
                if (url.hostname == 'coffeetox.ru' && 'navigate' in client) {
                    cfxClient = client
                    return false
                }
                return true
            })

            const notif = event.notification;
            notif.close()

            if(cfxClient) {
                return cfxClient.navigate(notif.data.link)
                .then(() => cfxClient.focus())
            }
            else
                return self.clients.openWindow(notif.data.link)
        })
        .catch(err => {
            return self.registration.showNotification('ERROR', {
                body: err.message
            })
        })
    )
})