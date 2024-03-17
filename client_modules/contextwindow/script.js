let openedCW = null

document.addEventListener('click', (e) => {
    if(!openedCW || openedCW.window.contains(e.target))
        return
    else if(openedCW.ignoreClicks.some(el => (el.contains(e.target) || el === e.target)))
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


function makeButtonsCW(caller, buttons, options) {
    attachButtonToCW(() => {
        let cw = new ContextWindow({
            html: templateManager.createHTML('buttons-cw', {
                labels: Object.keys(buttons)
            }),
            className: 'cw-buttons',
            transformOrigin: 'top right',
            ...options
        })

        cw.setPosition({
            top: utils.bounds(caller).top + caller.clientHeight / 2,
            right: utils.bounds(caller).left + caller.clientWidth / 2
        })

        let buttonElements = cw.window.querySelectorAll('.button')

        Object.values(buttons).forEach((f, i) => {
            buttonElements[i].addEventListener('click', () => {
                f()
                cw.close()
            })
        })

        return cw
    }, caller)
}

function attachButtonToCW(makeCW, button) {
    let cw = null

    button.onclick = () => {
        if(cw && cw.isOpened()) {
            cw.close()
            cw = null
            return
        }
        Promise.resolve(makeCW())
        .then(cw_ => {
            cw = cw_
            if(cw.ignoreClicks.every(w => w != button))
                cw.ignoreClicks.push(button)
            cw.open()
        })
    }
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
        this.window.style.visibility='hidden'

        document.body.appendChild(this.window)

        this.setPosition(options.pos ?? {top:0, left:0})

    }

    isOpened() {
        return this == openedCW
    }

    setAxis(axis) {
        this.window.style.transformOrigin = `${axis.left}px ${axis.top}px`
    }

    setPosition(pos, borderElement, bottom=false, right=false) {
        let w = this.window.clientWidth
        let h = this.window.clientHeight

        let border = {
            top: borderElement? utils.bounds(borderElement).top : 0,
            left: borderElement? utils.bounds(borderElement).left : 0,
            right: borderElement? utils.bounds(borderElement).left + borderElement.clientWidth : window.innerWidth,
            bottom: borderElement? utils.bounds(borderElement).top + borderElement.clientHeight : window.innerHeight
        }

        let actual = {
            top: pos.top !== undefined? pos.top : pos.bottom !== undefined? pos.bottom - h : 0,
            left: pos.left !== undefined? pos.left : pos.right !== undefined? pos.right - w : 0
        }

        if(actual.top < border.top)
            actual.top = border.top
        else if (actual.top + h > border.bottom)
            actual.top = border.bottom - h

        if(actual.left < border.left)
            actual.left = border.left
        else if(actual.left + w > border.right)
            actual.left = border.right - w

        if (bottom)
            this.window.style.bottom = actual.top + h + 'px'
        else
            this.window.style.top = actual.top + 'px'
    
        if (right)
            this.window.style.right = actual.left + w + 'px'
        else
            this.window.style.left = actual.left + 'px'

        return actual
    }

    open() {
        if(openedCW)
            openedCW.close(true)
        openedCW = this
        this.window.style.visibility='visible'
        this.window.style.animation = ''
        void this.window.offsetWidth;
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
            this.window.style.visibility='hidden'
            if (this.destroyOnClose)
                document.body.removeChild(this.window)
        })
    }

}