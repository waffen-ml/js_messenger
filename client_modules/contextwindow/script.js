let openedCW = null

document.addEventListener('click', (e) => {
    if(!openedCW || openedCW.window.contains(e.target))
        return
    else if(openedCW.ignoreClicks.every(el => el.contains(e.target) || el === e.target))
        return

    openedCW.close(true)
})

window.addEventListener('resize', () => {
    if(openedCW)
        openedCW.close(true)
})

document.body.addEventListener('scroll', (e) => {
    if(openedCW)
        openedCW.close(true)
})

document.body.querySelector('main').addEventListener('scroll', e => {
    if(openedCW)
        openedCW.close(true)
})

function buttonsCWCaller(caller, buttons, options) {
    let cw = null
    options ??= {}

    options.attachedTo = caller
    options.transformOrigin ??= 'top right'

    caller.addEventListener('click', () => {
        if(cw && cw.isOpened()) {
            cw.close()
            cw = null
            return
        }

        let brect = caller.getBoundingClientRect()

        options.pos = {
            right: document.body.clientWidth - brect.right,
            top: brect.top + brect.height
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
        this.ignoreClicks = !options.ignoreClicks? [] : Array.isArray(options.ignoreClicks)? 
            options.ignoreClicks : [options.ignoreClicks]
        this.checkScroll = !options.checkScroll? [] : Array.isArray(options.checkScroll)?
            options.checkScroll : [options.checkScroll]

        if (options.transformOrigin)
            this.window.style.transformOrigin = options.transformOrigin
        else
            this.setAxis(options.axis ?? {top:0, left:0})

        this.animLength = options.animLength ?? 300
        this.destroyOnClose = options.destroyOnClose ?? true

        if (options.className)
            this.window.classList.add(options.className)

        this.checkScroll.forEach(el => el.addEventListener('scroll', () => this.close(true)))

        document.body.appendChild(this.window)

        this.setPosition(options.pos ?? {top:0, left:0})



    }

    isOpened() {
        return this == openedCW
    }

    setAxis(axis) {
        this.window.style.transformOrigin = `${axis.left}px ${axis.top}px`
    }

    setPosition(pos) {
        this.window.style.top = (pos.top ?? 0) + 'px'
        this.window.style.left = (pos.left ?? 0) + 'px'
    }

    open() {
        if(openedCW)
            openedCW.close(true)
        openedCW = this
        this.window.style.display = ''
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
                document.body.removeChild(this.window)
        })
    }

}