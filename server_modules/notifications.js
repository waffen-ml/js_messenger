const webpush = require('web-push')
const publicVapidKey = 'BFz5DJhb3Fxpj5UB855BnYqXV6HCi2_UJyYGsgEFZRBAGCrm9XThi18-BFxb_cv7lgcrH0Lguj3J6SWfv3E02E8'
const privateVapidKey = 'gwlKxiLjbiVMeUWHwMUOjDM-uIMrueb5B6D-tLyXq4s'


class Notifications {
    constructor(cfx) {
        this.cfx = cfx
        this.unreadCheckers = {}
    }

    addUnreadChecker(name, f) {
        this.unreadCheckers[name] = f
    }

    getUnread(name, userid) {
        return Promise.resolve(this.unreadCheckers[name](userid))
    }

    getAllUnread(userid) {
        let unread = {}
        return Promise.all(
            Object.keys(this.unreadCheckers).map(name => {
                return this.getUnread(name, userid)
                .then(w => {
                    unread[name] = w
                })
            })
        )
        .then(() => {
            return unread
        })
    }

    notify(userid, data) {
        const payload = JSON.stringify(data)

        this.cfx.core.sessionStorage.all((sessions) => {
            console.log(sessions)
            let subs = sessions.filter(s => s.user && s.user.id == userid).filter(s => s.notificationSubscription)
                .map(s => s.notificationSubscription)
            
            subs.forEach(sub => {
                webpush.sendNotification(sub, payload)
                .catch(err => {
                    console.log('Error with sending a notification:')
                    console.log(err)
                })
            })
        })

    }
}

exports.init = (cfx) => {
    if(!cfx.files)
        return true

    cfx.notifications = new Notifications(cfx)

    webpush.setVapidDetails('mailto:mrkostinilya@gmail.com', publicVapidKey, privateVapidKey)

    cfx.core.app.post('/subnotif', cfx.core.upload.none(), (req, res) => {
        const subscription = JSON.parse(req.body.subscription)
        req.session.notificationSubscription = subscription
        res.status(201).json({})
    })

    cfx.core.app.get('/unsubnotif', (req, res) => {
        req.session.notificationSubscription = null
    })

    cfx.notifications.notify(94, {title: 'ХЕРЕС', body: 'ХЕРЕС ХЕРЕС'})

}