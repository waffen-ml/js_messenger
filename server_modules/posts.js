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

    getLastPosts(n, author_id) {
        return this.cfx.db.executeFile('getlastposts', {
            limit: n,
            author: author_id? `where author_id=${author_id}` : ''
        })
        .then((arr) => {
            if(!arr.length)
                return [];
            
            let result = [];
            let post = {id:-1}
    
            for(let i = 0; i < arr.length; i++) {
                if(arr[i].id != post.id) {
                    result.push(post);
                    post = arr[i];
                    post.content = utils.createContent(post.text, post.html);
                }
                if(arr[i].file_id) {
                    post.content[arr[i].file_mimetype].push({
                        file_id: arr[i].file_id,
                        file_name: arr[i].file_name,
                        file_fullname: arr[i].file_name + '.' + arr[i].file_extension
                    });
                }
            }

            result.push(post);
            result.shift()
            
            return result;
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
            cfx.files.saveFiles(data.files, null, -1)
            .then(r => {
                return cfx.posts.addPost(cfx.user().id, 
                    r.bundle, data.text, data.html, data.title);
            })
        }
    ))

    cfx.core.app.get('/create_post', (req, res) => {
        if(!cfx.core.login(req, res, true)) return;
        cfx.core.render(req, res, 'create_post', {
            form: cfx.forms.getForm('create_post')
        });
    })

    cfx.core.app.get('/', (req, res) => {
        cfx.posts.getLastPosts(10)
        .then(posts => {
            cfx.core.render(req, res, 'main', {
                posts: posts,
                utils: utils
            })
        })
    })

}