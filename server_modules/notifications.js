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

    checkUnread(name, userid) {
        return Promise.resolve(this.unreadCheckers[name](userid))
    }

    checkAllUnread(userid) {
        let unread = {}
        return Promise.all(
            Object.keys(this.unreadCheckers).map(name => {
                return this.checkUnread(name, userid)
                .then(w => {
                    unread[name] = w
                })
            })
        )
        .then(() => {
            return unread
        })
    }

    

}




exports.init = (cfx) => {
    if(!cfx.files)
        return true

    cfx.notifications = new Notifications(cfx)

    webpush.setVapidDetails('mailto:mrkostinilya@gmail.com', publicVapidKey, privateVapidKey)

    cfx.core.app.post('/subnotif', cfx.core.upload.none(), (req, res) => {
        const subscription = req.body
        console.log(subscription)

        // 201 --> success
        res.status(201).json({})

        // Payload

        const payload = JSON.stringify({title: 'Push CFX Test'})

        webpush.sendNotification(subscription, payload)
        .catch(err => {
            console.log(err)
        })

    })


}