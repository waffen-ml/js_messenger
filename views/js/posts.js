const loadBatchSize = 15


class FeedHolder {
    constructor() {
        this.holder = document.querySelector('.posts')


    }


}

class Feed {
    constructor() {
        this.holder = new FeedHolder()
        this.posts = []
        this.loadBatch()
    }

    loadBatch() {
        let start = this.posts.length?
            this.posts[this.posts.length - 1].id - 1 : -1
        fetch(`/getfeed?start=${start}&count=${loadBatchSize}`)
        .then(r => r.json())
        .then(feed => {

            console.log(feed)

        })


    }
}

let feed = new Feed()