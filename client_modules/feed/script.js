const loadBatchSize = 15
const loadDistance = 500


class FeedHolder {
    constructor(hideAuthor, holder, scrollPage) {
        this.scrollPage = scrollPage
        this.holder = holder
        this.loadedAll = false
        this.loadingMore = false
        this.hideAuthor = hideAuthor
    }

    initLoadFeedFunction(load) {
        this.scrollPage.addEventListener('scroll', (e) => {
            if(this.loadedAll || this.loadingMore)
                return
            
            let reminder = this.scrollPage.scrollHeight - 
                this.scrollPage.scrollTop - this.scrollPage.clientWidth

            if (reminder < loadDistance) {
                this.loadingMore = true
                load().then(() => {
                    this.loadingMore = false
                })
            }
        })
    }

    onReaction(react) {
        this.react = react    
    }

    updatePostReactions(post) {
        let postElement = this.holder.querySelector('#post' + post.id)
        let dislike = postElement.querySelector('.dislike')
        let like = postElement.querySelector('.like')

        like.textContent = (post.like_count > 0? post.like_count : '') + '👍'
        dislike.textContent = (post.dislike_count > 0? post.dislike_count : '') + '👎'

        like.classList.remove('chosen')
        dislike.classList.remove('chosen')

        if (post.my_reaction === 0)
            dislike.classList.add('chosen')
        else if(post.my_reaction === 1)
            like.classList.add('chosen')
    }

    addPosts(posts) {
        posts.forEach(post => {
            let element = templateManager.createElement('post', {
                data: post,
                hide_author: this.hideAuthor})
            
            setupInspectObjects(element)

            element.querySelector('.like').onclick = () => this.react(post, 1)
            element.querySelector('.dislike').onclick = () => this.react(post, 0)
            
            //let iframe = element.querySelector('.html iframe')
            //if (iframe && false)
            //    iframe.srcdoc = templateManager.createHTML('html-srcdoc', {html: post.html})

            this.holder.appendChild(element)
            this.updatePostReactions(post)
        })
    }

}

class Feed {
    constructor(me, authorId, holder, scrollPage) {
        this.authorId = authorId
        this.holder = new FeedHolder(Boolean(authorId), holder, scrollPage)
        this.feed = []
        this.me = me
        this.holder.initLoadFeedFunction(() => this.loadBatch())
        this.holder.onReaction((p, r) => this.react(p, r))
        this.loadBatch()
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
            post.my_reaction = reaction
            fetch(`/set_reaction?post_id=${post.id}&reaction=${reaction}`)
        }

        this.holder.updatePostReactions(post)
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
