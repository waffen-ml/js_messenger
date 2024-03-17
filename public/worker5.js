console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('32123123', {
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
            includeUncontrolled: true
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
                return cfxClient.focus().then(() => cfxClient.navigate('https://coffeetox.ru'))
            else
                return self.clients.openWindow('https://youtube.com')

        })
    )
})