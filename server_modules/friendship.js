class Friendship {
    constructor(cfx) {
        this.cfx = cfx;
    }

    getFriends(userid) {
        return this.cfx.query(`select u.* from friendship f left join user u on 
            (u.id=f.first_id or u.id=f.second_id) and u.id!=${userid} where f.first_id=${userid} or f.second_id=${userid}`);
    }

    areFriends(a, b) {
        return this.cfx.query(`select id from friendship where first_id=${a} and second_id=${b} or first_id=${b} and second_id=${a}`)
        .then(r => r.length > 0)
    }

    doesFriendRequestExist(from_id, to_id) {
        return this.cfx.query(`select * from friend_request where from_id=${from_id} and to_id=${to_id} limit 1`)
        .then(result => {
            return result.length > 0
        })
    }

    getFriendRequests(userid) {
        return this.cfx.query(`select r.id as request_id, r.from_id as author_id, u.id as to_id, name, tag from friend_request 
            r left join user u on (u.id=r.from_id or u.id=r.to_id) and u.id!=${userid} where r.from_id=${userid} or r.to_id=${userid}`)
        .then(requests => {
            let incoming = []
            let outgoing = []
            
            requests.forEach(r => {
                if (r.author_id == userid)
                    outgoing.push(r)
                else
                    incoming.push(r)
            })

            return {outgoing: outgoing, incoming: incoming}
        })
    }

    sendFriendRequest(from_id, to_id) {
        if (from_id == to_id)
            return new Promise();

        return this.areFriends(from_id, to_id)
        .then(result => {
            if (result)
                throw "are friends";
            
            return this.doesFriendRequestExist(to_id, from_id)
        })
        .then(result => {
            if (result)
                return this.deleteRequestsBetween(from_id, to_id)
                .then(() => {
                    return this.addFriendship(from_id, to_id)
                })
            return this.cfx.query(`insert into friend_request(from_id, to_id) select ${from_id}, ${to_id} 
            from dual where not exists(select * from friend_request where from_id=${from_id} and to_id=${to_id} limit 1)`)
        })
        .then(() => {
            return this.cfx.notifications.sendSpecificUnread(to_id, 'friends')
        })
    }

    deleteRequestsBetween(a, b) {
        return this.cfx.query(`delete from friend_request where from_id=${a} 
            and to_id=${b} or from_id=${b} and to_id=${a}`)
    }

    declineFriendRequest(decliner, sender) {
        return this.deleteRequestsBetween(decliner, sender)
        .then(r => {
            return this.cfx.notifications.sendSpecificUnread(decliner, 'friends')
        })
    }

    addFriendship(first, second) {
        return this.areFriends(first, second)
        .then(result => {
            if (result)
                return;
            return this.cfx.query(`insert into friendship(first_id, second_id) values(${first}, ${second})`)  
        })
    }

    removeFriendship(first, second) {
        return this.cfx.query(`delete from friendship where first_id=${first} and 
            second_id=${second} or first_id=${second} and second_id=${first}`)
    }

    acceptFriendRequest(accepter, sender) {
        return this.deleteRequestsBetween(accepter, sender)
        .then(r => {
            return this.addFriendship(accepter, sender);
        })
        .then(r => {
            return this.cfx.notifications.sendSpecificUnread(accepter, 'friends')
        })
    }

}

const Form = require('./forms').Form;
const addFriendForm = new Form(
    {name: 'addfriend'}, [
        {type: 'text', name: 'tag', title: 'Имя аккаунта'}
    ], (data, erf, cfx) => {
        return cfx.auth.getUserByTag(data.tag)
        .then(user => {
            if (user == null)
                erf('tag', 'Не найдено')
            else if (user.id == cfx.user().id)
                erf('tag', 'Запрос себе')
            else
                return user.id
        })
        
    }, (_, to_id, cfx) => {
        cfx.friendship.sendFriendRequest(cfx.user().id, to_id)
    }
)

exports.init = (cfx) => {
    if(!cfx.db || !cfx.forms || !cfx.notifications)
        return true;

    cfx.notifications.addUnreadChecker('friends', (userid) => {
        return cfx.query(`select count(*) as count From friend_request where to_id=?`, [userid])
        .then(r => r.length? r[0].count : 0)
    })

    cfx.core.app.get('/getfriends', (req, res) => {
        let user = cfx.core.login(req, res, false)
        if(!user) {
            res.send([])
            return
        }
        cfx.friendship.getFriends(user.id)
        .then(friends => res.send(friends))
    })

    cfx.core.app.get('/friends', (req, res) => {
        let user = cfx.core.login(req, res, true);
        
        if(!user)
            return;

        cfx.friendship.getFriends(user.id)
        .then(friends => {
            cfx.friendship.getFriendRequests(user.id)
            .then(requests => {

                cfx.core.render(req, res, 'friends', {
                    friends: friends,
                    requests: requests
                })

            })
        })
    })

    cfx.core.app.get('/answer_friend_request', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then(user => {
            return req.query.accept == 1?
                cfx.friendship.acceptFriendRequest(user.id, req.query.id)
                : cfx.friendship.declineFriendRequest(user.id, req.query.id)
        })
        .then(() => {
            res.send("ok")
        })
        .catch(() => {
            res.send("error")
        })
    })

    cfx.core.app.get('/cancel_friend_request', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then(user => {
            return cfx.friendship.deleteRequestsBetween(user.id, req.query.id)
        })
        .then(() => {
            res.send("ok")
        })
        .catch(() => {
            res.send("error")
        })
    })

    cfx.core.app.get('/send_friend_request', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then(user => {
            return cfx.friendship.sendFriendRequest(user.id, req.query.id)
        })
        .then(() => {
            res.send("ok")
        })
        .catch(() => {
            res.send("error")
        })
    })

    cfx.core.app.get('/remove_friend', (req, res) => {
        cfx.core.plogin(req, res, true)
        .then(user => {
            return cfx.friendship.removeFriendship(user.id, req.query.id)
        })
        .then(() => {
            res.send("ok")
        })
        .catch(() => {
            res.send("error")
        })
    })

    cfx.forms.addForm(addFriendForm)
    cfx.friendship = new Friendship(cfx);
}