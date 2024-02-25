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

    cfx.core.safeGet('/getfeed', (user, req, res) => {
        let start = parseInt(req.query.start)
        let count = parseInt(req.query.count)
        let author_id = req.query.author_id
        let observer_id = user? user.id : -1
        
        return cfx.posts.getFeed(start, count, observer_id, author_id)
    })

    cfx.core.safeRender('/create_post', (user, req, res) => {
        return {
            render: 'create_post',
            form: cfx.forms.getForm('create_post')
        }
    }, true)

    cfx.core.safeGet('/set_reaction', (user, req, res) => {
        return cfx.posts.setReaction(user.id, req.query.post_id, req.query.reaction)
        .then(() => {
            return {success:1}
        })
    }, true)
    
    cfx.core.safeGet('/remove_reaction', (user, req, res) => {
        return cfx.posts.removeReaction(user.id, req.query.post_id, req.query.reaction)
        .then(() => {
            return {success:1}
        })
    }, true)

    cfx.core.safeRender('/', (user, req, res) => {
        return {
            render: 'main'
        }
    })

    cfx.core.safeGet('/getpostreactions', (_, req, res) => {
        return cfx.query(`select u.id as user_id, u.name as user_name, u.tag as user_tag,
            r.type from post_reaction r join user u on r.user_id=u.id where r.post_id=?`, [req.query.id])
    })

}
