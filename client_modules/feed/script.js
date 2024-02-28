const loadBatchSize = 15
const loadDistance = 500
const commentLoadBatchSize = 4


class Post {
    constructor(data, feed) {
        this.data = data
        this.id = data.id
        this.feed = feed
        this.element = templateManager.createElement('post', {
            data: data,
            me: feed.me
        })
        this.commentHolder = this.element.querySelector('.comments')
        this.commentLoadStart = -1

        this.setupElement()
    }

    toggleLoadCommentsButton(state) {
        let button = this.element.querySelector('.comment-section .load-more')
        button.style.display = state? 'block' : 'none'
    }

    loadCommentBatch() {
        this.toggleLoadCommentsButton(false)

        return this.feed.loadComments(this.id, this.commentLoadStart, commentLoadBatchSize + 1)
        .then(comments => {
            console.log(comments)

            if(!comments.length)
                return

            if (comments.length > commentLoadBatchSize) {
                this.toggleLoadCommentsButton(true)
                comments.pop()
            }
            this.commentLoadStart = comments[comments.length - 1].id - 1
            comments.reverse().forEach(c => {
                c.datetime = new Date(c.datetime)
                this.addComment(c, true)
            })
        })
    }

    addComment(data, before) {
        let commentElement = templateManager.createElement('post-comment', data)
        if(before)
            this.commentHolder.insertBefore(commentElement, this.commentHolder.firstChild)
        else
            this.commentHolder.appendChild(commentElement)
    }

    setupCommentSection() {
        let addCommentButton = this.element.querySelector('.add-comment .button')
        let commentInput = this.element.querySelector('.add-comment input')

        const sendComment = () => {
            this.feed.addComment(this.id, commentInput.value)
            .then(w => {
                if(!w)
                    return
                this.addComment({
                    author_id: this.feed.me.id,
                    author_name: this.feed.me.name,
                    datetime: new Date(),
                    text: commentInput.value
                })
                commentInput.value = ""
                commentInput.blur()
            })
        }

        addCommentButton.addEventListener('click', () => sendComment())
        commentInput.addEventListener('keydown', (e) => {
            if(e.key == 'Enter') {
                e.preventDefault()
                sendComment()
            }
        })

        this.element.querySelector('.load-more').addEventListener('click', () => {
            this.loadCommentBatch()
        })

        this.loadCommentBatch()
    }

    setupElement() {
        setupInspectObjects(this.element)

        this.element.querySelector('.like').onclick = () => this.feed.react(this.data, 1)
        this.element.querySelector('.dislike').onclick = () => this.feed.react(this.data, 0)

        let donate = this.element.querySelector('.donate')

        donate.addEventListener('change', () => {
            if (donate.value == 'cancel')   
                donate.value = 'default'
            else if(donate.value !=' default') {
                let amount = parseInt(donate.value)
                donate.style.pointerEvents = 'none'
                this.feed.donate(this.data, amount)
            }
        })

        if (this.data.author_id == this.feed.me.id || !this.feed.me.id) 
            donate.style.display = 'none'

        let iframe = this.element.querySelector('.html iframe')
        if (iframe && false)
            iframe.srcdoc = templateManager.createHTML('html-srcdoc', {html: this.data.html})

        this.feed.holder.element.appendChild(this.element)
        this.updateReactions()

        let dots = this.element.querySelector('.dots')

        buttonsCWCaller(dots, {
            'Реакции': () => this.feed.inspectReactions(this.id),
            'Редактировать': () => {},
            'Удалить': () => this.feed.deletePost(this.id)
        }, {parent: this.feed.holder.scrollPage})

        this.setupCommentSection()
    }

    destroy() {
        this.feed.holder.element.removeChild(this.element)
    }

    resetDonate() {
        let donate = this.element.querySelector('.donate')
        donate.value = 'default'
        donate.style.pointerEvents = 'all'
    }

    updateReactions() {
        let dislike = this.element.querySelector('.dislike')
        let like = this.element.querySelector('.like')

        like.textContent = '👍' + (this.data.like_count > 0? this.data.like_count : '')
        dislike.textContent = '👎' + (this.data.dislike_count > 0? this.data.dislike_count : '')

        like.classList.remove('chosen')
        dislike.classList.remove('chosen')

        if (this.data.my_reaction === 0)
            dislike.classList.add('chosen')
        else if(this.data.my_reaction === 1)
            like.classList.add('chosen')
    }

    updateDonate(amount) {
        let donate = this.element.querySelector('.donate')
        donate.style.pointerEvents = 'none'
        donate.querySelector('option[value="default"]').textContent = '✅' + amount + 'EBL'
        donate.value = 'default'
    }

}


class FeedHolder {
    constructor(feed, element, scrollPage) {
        this.scrollPage = scrollPage
        this.element = element
        this.loadedAll = false
        this.loadingMore = false
        this.feed = feed
        this.posts = {}

        this.setupScrollLoad()
    }

    setupScrollLoad() {
        this.scrollPage.addEventListener('scroll', (e) => {
            if(this.loadedAll || this.loadingMore)
                return
            
            let reminder = this.scrollPage.scrollHeight - 
                this.scrollPage.scrollTop - this.scrollPage.clientWidth

            if (reminder < loadDistance) {
                this.loadingMore = true
                this.feed.loadBatch().then(() => {
                    this.loadingMore = false
                })
            }
        })
    }

    getPost(id) {
        return this.posts[id]
    }

    destroyPost(id) {
        this.getPost(id).destroy()
    }

    addPosts(dataArr) {
        dataArr.forEach(data => {
            this.posts[data.id] = new Post(data, this.feed)
        })
    }

}

class Feed {
    constructor(me, authorId, holder, scrollPage) {
        this.authorId = authorId
        this.holder = new FeedHolder(this, holder, scrollPage)
        this.feed = []
        this.me = me
        this.loadBatch()
    }

    isAuthorized() {
        return this.me && this.me.id
    }

    loadComments(post_id, start, count) {
        return fetch(`/getcomments?post_id=${post_id}&start=${start}&count=${count}`)
        .then(r => r.json())
    }

    addComment(post_id, text) {
        return new Promise((resolve) => {
            if (!utils.strweight(text)) {
                resolve(false)
                return
            } else if(!this.isAuthorized()) {
                alert('Войдите в аккаунт!')
                resolve(false)
                return
            }

            fetch(`/addcomment?post_id=${post_id}&text=${encodeURI(text)}`)
            .then(r => r.json())
            .then(r => {
                if(r.success)
                    resolve(true)
                else {
                    alert('Ошибка!')
                    resolve(false)
                }
            })
        })
    }

    deletePost(id) {
        if(!confirm('Подтвердите удаление.'))
            return
        
        fetch(`/deletepost?id=${id}`)
        .then(r => r.json())
        .then(r => {
            if (!r.success) {
                alert('Ошибка: ' + r.error)
                return
            }
            this.holder.destroyPost(id)
        })
    }

    inspectReactions(id) {
        fetch('/getpostreactions?id=' + id)
        .then(r => r.json())
        .then(r => {
            let popup = new Popup({
                html: templateManager.createHTML('post-reactions', {reactions: r}),
                closable: true,
                title: 'Реакции'
            })
            popup.open()
        })
    }

    donate(post, amount) {
        if(!this.me || !this.me.id) {
            alert('Войдите в аккаунт!')
            return
        }
        let to_id = post.author_id
        fetch(`/maketransaction?id=${to_id}&comment=Пожертвование&amount=${amount}`)
        .then(r => r.json())
        .then(r => {
            let postObj = this.holder.getPost(post.id)

            if (r.success) {
                postObj.updateDonate(amount)
                return
            }
            postObj.resetDonate()

            if (r.error == 'LACKING_BALANCE')
                alert('Недостаточно средств.')
            else
                alert('Ошибка: ' + r.error)
        })
    } 

    react(post, reaction) {
        if (!this.me || !this.me.id) {
            alert('Войдите в аккаунт!')
            return
        }

        if (post.my_reaction === reaction) {
            if (reaction === 0)
                post.dislike_count -= 1
            else
                post.like_count -= 1

            post.my_reaction = null
            fetch('/remove_reaction?post_id=' + post.id)
        }
        else {
            if (post.my_reaction === 0)
                post.dislike_count -= 1
            else if(post.my_reaction === 1)
                post.like_count -= 1

            if(reaction === 0)
                post.dislike_count += 1
            else if (reaction === 1)
                post.like_count += 1
            
            post.my_reaction = reaction
            fetch(`/set_reaction?post_id=${post.id}&reaction=${reaction}`)
        }

        this.holder.getPost(post.id).updateReactions()
    }

    loadBatch() {
        let start = this.feed.length?
            this.feed[this.feed.length - 1].id - 1 : -1
        let authorId = this.authorId ?? ''
        return fetch(`/getfeed?start=${start}&count=${loadBatchSize}&author_id=${authorId}`)
        .then(r => r.json())
        .then(posts => {
            if (posts.length < loadBatchSize)
                this.holder.loadedAll = true

            posts.forEach(post => {
                post.datetime = new Date(post.datetime)
                utils.distributeFiles(post, 'mimetype')
            })

            this.feed.push(...posts)
            this.holder.addPosts(posts)
        })
    }
}
