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
                return
            }
            this.cfx.query('select max(id) as mxid from post where ' + author_query)
            .then(r => {
                start = r[0].mxid
                resolve()
            })
        })
        .then(() => {
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

    getPost(id) {
        return this.cfx.query(`select p.*, f.id as file_id, f.name as file_name, f.mimetype 
        as file_mimetype from post p left join file f on f.bundle_id=p.bundle_id where id=?`, [id])
        .then(raw_post => {
            return utils.parseArrayOutput(raw_post, 'files', {
                file_mimetype: 'mimetype',
                file_id: 'id',
                file_name: 'name'
            })
        })
    }

    hasPermissions(userid, postid) {
        return new Promise((resolve) => {
            this.cfx.auth.getUser(userid)
            .then(user => {
                if(user.admin)
                    resolve(true)
                return this.getPostInfo(postid)
            })
            .then(post => {
                if(!post)
                    throw Error('Invalid post')
                resolve(post.author_id == userid)
            })
        })
    }

    deletePost(postid) {
        return this.getPostInfo(postid)
        .then(post => {
            if(!post)
                throw Error('Invalid post')
            return post.bundle_id? this.cfx.files.deleteBundle(post.bundle_id)
                : null
        }).then(() => {
            return this.cfx.query(`delete from post where id=?`, [postid])
        })
    }

    getPostInfo(id) {
        return this.cfx.query(`select * from post where id=?`, [id])
        .then(r => r[0])
    }

    addComment(post_id, author_id, text) {
        return this.cfx.query(`insert into post_comment(post_id, author_id, text, datetime)
            values(?, ?, ?, now())`, [post_id, author_id, utils.mysql_escape(text)])
    }

    getComments(post_id, start, count) {
        return new Promise((resolve) => {
            if(start > 0) {
                resolve(start)
                return
            }
            this.cfx.query('select max(id) as k from post_comment where post_id=?', [post_id])
            .then(w => {
                resolve(w[0].k ?? 0)
            })
        })
        .then(s => {
            return this.cfx.query(`select c.*, u.name as author_name, 
                u.id as author_id, u.tag as author_tag from post_comment c 
                left join user u on u.id=c.author_id where post_id=? and c.id<=? order by c.id desc limit ?`, [post_id, s, count])
        })
    }

    getComment(comment_id) {
        return this.cfx.query(`select * from post_comment where id=?`, [comment_id])
        .then(r => r[0])
    }

    deleteComment(comment_id) {
        return this.cfx.query(`delete from post_comment where id=?`, [comment_id])
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
        (data, erf, user) => {
            if (!utils.strweight(data.text) && !utils.strweight(data.html) && !data.files)
                erf('text', 'Нет информации');
        },
        (data, user, vd) => {
            if(!user)
                return;
            cfx.files.saveFiles(data.files, -1)
            .then(r => {
                return cfx.posts.addPost(user.id, 
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

    cfx.core.safeGet('/deletepost', (u, req, res) => {
        return cfx.posts.hasPermissions(u.id, req.query.id)
        .then(w => {
            if(!w)
                throw Error('Lack permissions')
            return cfx.posts.deletePost(req.query.id)
        })
        .then(() => {
            return {
                success: 1
            }
        })
    }, true)

    cfx.core.safeGet('/getcomments', (u, req, res) => {
        return cfx.posts.getComments(
            parseInt(req.query.post_id),
            parseInt(req.query.start),
            parseInt(req.query.count))
    })

    cfx.core.safeGet('/addcomment', (u, req, res) => {
        return cfx.posts.addComment(
            parseInt(req.query.post_id),
            u.id, req.query.text)
        .then(r => {
            return {
                success:1,
                id: r.insertId
            }
        })
    }, true)

    cfx.core.safeGet('/deletecomment', (u, req, res) => {
        return cfx.posts.getComment(req.query.id)
        .then(comment => {
            if (comment.author_id != u.id)
                throw Error('Lack permissions')
            return cfx.posts.deleteComment(req.query.id)
        })
        .then(() => {
            return {
                success:1
            }
        })
    }, true)

}
