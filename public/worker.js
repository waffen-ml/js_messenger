console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('heyw', {
            body: data.body ?? 'HEY',
            icon: data.icon ?? 'https://coffeetox.ru/public/coffee.png',
            tag: data.tag,
            silent: false,
            dir: 'ltr'
        })
    )
})

self.addEventListener('notificationclick', function(event) {
    event.waitUntil(
        self.clients.matchAll({
            includeUncontrolled: true,
            type:'window'
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

            event.notification.close()

            if(cfxClient)
                return cfxClient.navigate('https://coffeetox.ru').then(c => c.focus())
            else
                return self.clients.openWindow('https://youtube.com')

        })
    )
})