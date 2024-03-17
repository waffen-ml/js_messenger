console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()

    e.waitUntil(
        self.registration.showNotification('2', {
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

            cfxClient = cfxClient ?? self.clients.openWindow('https://youtube.com')

            cfxClient.postMessage('hey')

        })
    )
})