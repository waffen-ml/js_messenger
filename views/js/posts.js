const loadBatchSize = 15


class FeedHolder {
    constructor() {
        this.holder = document.querySelector('.posts')
        this.loadedAll = false
        this.loadingMore = false
    }

    initLoadFeedFunction(load) {
        this.holder.addEventListener('scroll', (e) => {
            if(this.loadedAll || this.loadingMore)
                return

            let reminder = this.holder.scrollHeight - this.holder.scrollTop - this.holder.clientWidth

            if (reminder < 50) {
                this.loadingMore = true
                load().then(() => {
                    this.loadingMore = false
                })
            }
        })
    }

    addPosts(posts) {
        posts.forEach(post => {
            let element = templateManager.createElement('post', post)
            setupInspectObjects(element)
            this.holder.appendChild(element)
        })
    }

}

class Feed {
    constructor() {
        this.holder = new FeedHolder()
        this.feed = []

        this.holder.initLoadFeedFunction(() => this.loadBatch())
        this.loadBatch()
    }

    loadBatch() {
        let start = this.feed.length?
            this.feed[this.feed.length - 1].id - 1 : -1
        return fetch(`/getfeed?start=${start}&count=${loadBatchSize}`)
        .then(r => r.json())
        .then(posts => {
            if (posts.length < loadBatchSize)
                this.holder.loadedAll = true
            this.feed.push(...posts)
            this.holder.addPosts(posts)
        })
    }
}

let feed = new Feed()