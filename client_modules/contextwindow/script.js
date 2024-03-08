let openedCW = null

document.addEventListener('click', (e) => {
    if(!openedCW)
        return

    if(openedCW.window.contains(e.target) || openedCW.attachedTo 
        && openedCW.attachedTo.contains(e.target))
        return
    
    openedCW.close(true)
})

window.addEventListener('resize', () => {
    console.log('hell')
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

        this.axis = options.axis ?? {top:0,left:0}

        if (options.transformOrigin)
            this.window.style.transformOrigin = options.transformOrigin
        else {
            axis = options.axis ?? {top:0,left:0}
            this.window.style.transformOrigin = `${this.axis.left}px ${this.axis.top}px`
        }

        this.animLength = options.animLength ?? 300
        this.destroyOnClose = options.destroyOnClose ?? true

        if (options.className)
            this.window.classList.add(options.className)

        this.setPosition(options.pos ?? {top:0, left:0})

        this.checkScroll.forEach(el => el.addEventListener('scroll', () => this.close(true)))

        document.body.appendChild(this.window)

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
                this.parent.removeChild(this.window)
        })
    }

}