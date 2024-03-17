console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()
    
    let notification = new Notification(data.title ?? 'CoffeeTox', {
        body: data.body ?? 'HEY',
        icon: data.icon ?? 'https://coffeetox.ru/public/coffee.png',
        silent: false,
        dir: 'ltr'
    })

    notification.onclick = () => {
        alert('hey')
    }

    self.registration.showNotification(notification)
})