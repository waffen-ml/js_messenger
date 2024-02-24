console.log('Service worker loaded!')

self.addEventListener('push', e => {
    let data = e.data.json()
    self.registration.showNotification(data.title, {
        body: data.body ?? 'HEY',
        icon: 'https://coffeetox.ru/public/coffee.png',
        silent:false,
        dir:'ltr'
    })
})