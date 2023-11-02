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

    getLastPosts(n) {
        return this.cfx.query('select p.id as post_id, p.author_id, p.text, p.html, p.title, '
            + 'p.datetime, u.name as author_name, u.tag as author_tag, f.name as file_name,'
            + `f.mimetype as file_mimetype from (select * from post order by id desc limit ${n}) `
            + 'p left join user u on p.author_id = u.id left join file f on f.bundle_id = p.bundle_id')
        .then((arr) => {
            if(!arr.length)
                return [];
            
            let result = [];
            let post = arr[0];
            post.content = utils.createContent(post.text, post.html);
    
            for(let i = 0; i < arr.length; i++) {
                if(arr[i].post_id != post.post_id) {
                    result.push(post);
                    post = arr[i];
                    post.content = utils.createContent(post.text, post.html);
                }
                if(arr[i].file_name) {
                    post.content[arr[i].file_mimetype].push(arr[i].file_name);
                }
            }

            result.push(post);
            
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
            cfx.files.addFilesInBundle(data.files)
            .then(b => {
                return cfx.posts.addPost(cfx.user().id, 
                    b, data.text, data.html, data.title);
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