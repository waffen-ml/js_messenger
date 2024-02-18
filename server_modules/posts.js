const forms = require('./forms');
const utils = require('./utils');

class Posts {
    constructor(cfx) {
        this.cfx = cfx;
    }

    addPost(author_id, bundle_id, text, html, title) {
        text = utils.mysql_escape(text)
        html = utils.mysql_escape(html)
        title = utils.mysql_escape(title)
        return this.cfx.query('insert into post (author_id, bundle_id, text, html, title, datetime)'
            + `values (${author_id}, ${bundle_id}, "${text}", "${html}", "${title}", now())`)
    }

    getFeed(start, count, observer_id, author_id) {
        let author_query = author_id? 'author_id=' + author_id : '1'

        return new Promise((resolve) => {
            if (start > -1) {
                resolve()
            }
            this.cfx.query('select max(id) as mxid from post where ' + author_query)
            .then(r => {
                start = r[0].mxid
                resolve()
            })
        }).then(() => {
            return this.cfx.db.executeFile('getfeed', {
                start: start,
                count: count,
                author_query: author_id? 'author_id=' + author_id : '1',
                observer_id: observer_id
            })
        })
        .then(feed => {
            return this.cfx.utils.parseArrayOutput(feed, 'files', {
                file_id: 'id',
                file_name: 'name',
                file_mimetype: 'mimetype'
            }, 'id')
        })
    }

    removeReaction(user_id, post_id) {
        return this.cfx.query('delete from post_reaction where user_id=? and post_id=?', [user_id, post_id])
    }

    setReaction(user_id, post_id, reaction) {
        return this.removeReaction(user_id, post_id)
        .then(() => {
            return this.cfx.query('insert into post_reaction(post_id, user_id, type) values(?,?,?)',
                [post_id, user_id, reaction])
        })
    }

}

exports.init = (cfx) => {
    if(!cfx.forms || !cfx.files)
        return true;

    cfx.posts = new Posts(cfx);

    cfx.forms.addForm(new forms.Form(
        {'name': 'create_post', 'title': 'Создать пост'},
        [
            {type: 'text', title: 'Заголовок', name: 'title', optional: true, placeholder: 'Ваш заголовок'},
            {type: 'textarea', title: 'Текст поста', name: 'text', optional: true },
            {type: 'file', title: 'Файлы', name: 'files', optional: true, limit: 10},
            {type: 'custom', title: 'HTML-код', name: 'html', optional: true}
        ],
        (data, erf, cfx) => {
            if (!utils.strweight(data.text) && !utils.strweight(data.html) && !data.files)
                erf('text', 'Нет информации');
        },
        (data, _, cfx) => {
            if(!cfx.user())
                return;
            cfx.files.saveFiles(data.files, -1)
            .then(r => {
                return cfx.posts.addPost(cfx.user().id, 
                    r.bundle, data.text, data.html, data.title);
            })
        }
    ))

    cfx.core.app.get('/getfeed', (req, res) => {
        let user = cfx.core.login(req, res, false)
        let start = parseInt(req.query.start)
        let count = parseInt(req.query.count)
        let author_id = req.query.author_id
        let observer_id = user? user.id : -1
        
        cfx.posts.getFeed(start, count, observer_id, author_id)
        .then(feed => {
            res.send(feed)
        })
    })

    cfx.core.app.get('/create_post', (req, res) => {
        if(!cfx.core.login(req, res, true)) return;
        cfx.core.render(req, res, 'create_post', {
            form: cfx.forms.getForm('create_post')
        });
    })

    cfx.core.app.get('/set_reaction', (req, res) => {
        let user = cfx.core.login(req, res, false)
        if(!user) return
        this.cfx.posts.setReaction(user.id, req.query.chat_id, req.query.reaction)
    })
    
    cfx.core.app.get('/remove_reaction', (req, res) => {
        let user = cfx.core.login(req, res, false)
        if(!user) return
        this.cfx.posts.removeReaction(user.id, req.query.chat_id)
    })


    cfx.core.app.get('/', (req, res) => {
        cfx.core.render(req, res, 'main', {})
    })

}
