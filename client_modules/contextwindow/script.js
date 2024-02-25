let openedCW = null

document.addEventListener('click', (e) => {
    if(!openedCW)
        return

    if(openedCW.window.contains(e.target) || openedCW.attachedTo 
        && openedCW.attachedTo.contains(e.target))
        return
    
    openedCW.close(true)
})

function buttonsCWCaller(caller, buttons, options) {

    let cw = null

    if(!options.pos) {
        let brect = caller.getBoundingClientRect()
        options.pos = {
            right: document.body.clientWidth - brect.right,
            top: brect.top + brect.height
        }
    }

    options.attachedTo = caller
    options.transformOrigin ??= 'top right'

    caller.addEventListener('click', () => {
        if(cw && cw.isOpened()) {
            cw.close()
            cw = null
            return
        }
        cw = makeButtonsCW(buttons, options)
        cw.open()
    })

}

function makeButtonsCW(buttons, options) {
    let cw = new ContextWindow({
        html: templateManager.createHTML('buttons-cw', {
            labels: Object.keys(buttons)
        }),
        className: 'cw-buttons',
        ...options
    })
    let buttonElements = cw.window.querySelectorAll('.button')

    Object.values(buttons).forEach((f, i) => {
        buttonElements[i].addEventListener('click', () => {
            f()
            cw.close()
        })
    })

    return cw
}

class ContextWindow {

    constructor(options) {
        this.window = templateManager.createElement('context-window', {
            html: options.html ?? ''
        })
        this.attachedTo = options.attachedTo ?? null
        this.parent = options.parent ?? document.body
        this.parent.appendChild(this.window)
        this.animLength = options.animLength ?? 300
        this.destroyOnClose = options.destroyOnClose ?? true
        this.window.style.transformOrigin = options.transformOrigin ?? 'top left'

        if (options.className)
            this.window.classList.add(options.className)

        this.setPosition(options.pos ?? {})

        this.parent.addEventListener('scroll', () => {
            this.close(true)
        })

        this.parent.addEventListener('resize', () => {
            this.close(true)
        })
    }

    isOpened() {
        return this == openedCW
    }

    setPosition(pos) {
        ['top', 'left', 'right', 'bottom'].forEach(dir => {
            if (pos[dir])
                this.window.style[dir] = pos[dir] + 'px'
        })
    }

    open() {
        if(openedCW)
            openedCW.close(true)
        openedCW = this
        this.window.style.display = 'block'
        this.window.style.animation = `cw-open ${this.animLength}ms ease-in-out`

        return new Promise((r) => setTimeout(() => r(), this.animLength))
    }

    close(instantly) {
        if (openedCW != this)
            return Promise.resolve()
        
        openedCW = null

        return new Promise((resolve) => {
            if (instantly) {
                resolve()
                return
            }
            this.window.style.animation = `cw-close ${this.animLength}ms ease-in-out forwards`
            setTimeout(() => {
                resolve()
            }, this.animLength)
        }).then(() => {
            this.window.style.display = 'none'
            if (this.destroyOnClose)
                this.parent.removeChild(this.window)
        })
    }

}