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

    addPosts(posts) {
        posts.forEach(post => {
            let element = templateManager.createElement('post', {
                data: post,
                hide_author: this.hideAuthor})
            setupInspectObjects(element)

            let iframe = element.querySelector('.html iframe')
            if (iframe)
                iframe.srcdoc = templateManager.createHTML('html-srcdoc', {html: post.html})

            this.holder.appendChild(element)
        })
    }

}

class Feed {
    constructor(authorId, holder, scrollPage) {
        this.authorId = authorId
        this.holder = new FeedHolder(Boolean(authorId), holder, scrollPage)
        this.feed = []
        this.holder.initLoadFeedFunction(() => this.loadBatch())
        this.loadBatch()
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