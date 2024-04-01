class UserChecklist {
    constructor(users) {
        this.users = users
        this.checked = new Array(users.length).fill(false)
        this.element = templateManager.createElement('user-checklist', {users: users})
        this.onchange = () => {}

        this.element.querySelectorAll('a.button').forEach((button, i) => {
            let checkbox = button.querySelector('input')

            button.addEventListener('click', () => {
                this.checked[i] = !this.checked[i]
                checkbox.checked = this.checked[i]
                this.onchange(this.checked)
            })
        })
    }

    getChecked() {
        return this.checked
    }
}

class LazyLoadingList {
    constructor(holder, scrollPage, load, convert, batchSize, startBatchSize, loadDistance=200) {
        this.holder = holder
        this.scrollPage = scrollPage ?? holder
        this.isLoading = false
        this.allowLoading = false
        this.batchSize = batchSize
        this.startBatchSize = startBatchSize ?? batchSize
        this.load = load
        this.convert = convert
        this.items = []
        this.elements = []
        this.loadDistance = loadDistance
        this.onload = () => {}

        this.reload()

        this.scrollPage.addEventListener('scroll', () => {
            this.loadIfNeeded()
        })
    }

    toggleLoading(state) {
        this.allowLoading = state
        this.loadIfNeeded()
    }

    reload() {
        this.items = []
        this.holder.innerHTML = ''
        this.loadIfNeeded(this.startBatchSize)
    }

    loadIfNeeded() {
        let reminder = this.scrollPage.scrollHeight - 
                this.scrollPage.scrollTop - this.scrollPage.clientHeight
        
        if (reminder < this.loadDistance)
            this.loadBatch(this.batchSize)
    }

    async loadBatch(size) {
        if(this.isLoading || !this.allowLoading)
            return

        this.isLoading = true
        
        let newItems = await this.load(size)

        if (newItems.length < size)
            this.toggleLoading(false)

        this.items.push(...newItems)
        newItems.forEach(item => {
            let e = this.convert(item, this.elements.length)
            this.elements.push(e)
            this.holder.appendChild(e)
        })
        this.isLoading = false

        this.onload()
        this.loadIfNeeded()
    }
}

class LazyShowingList {
    constructor(items, holder, scrollPage, convert, batchSize, startBatchSize, loadDistance) {
        this.items = items
        this.nextToLoad = 0
        this.lazyList = new LazyLoadingList(holder, scrollPage,
            (count) => {
                let start = this.nextToLoad
                let end = Math.min(this.items.length - 1, start + count - 1)
                this.nextToLoad = end + 1
                return Promise.resolve(this.items.slice(start, end + 1))
            },
        convert, batchSize, startBatchSize, loadDistance)
    }

    restart(newItems) {
        this.lazyList.reload()
        this.items = newItems ?? this.items
        this.nextToLoad = 0
    }
}
