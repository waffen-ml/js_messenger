console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('1552342346', {
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
                if (url.hostname == 'coffeetox.ru') {
                    cfxClient = client
                    return false
                }
                return true
            })

            const notif = event.notification;
            notif.close()

            if(cfxClient) {
                return cfxClient.focus()
                .then(() => cfxClient.postMessage({
                    action: 'navigate',
                    url: notif.data.link
                }))
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