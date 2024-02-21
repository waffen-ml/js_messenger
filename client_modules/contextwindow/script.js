const button = document.querySelector('#hey')

let openedCW = null


function cwTest() {
    let w = {};

    ['hey', 'hi', 'vovapidr'].forEach(msg => {
        w[msg] = () => console.log(msg)
    })

    let brect = button.getBoundingClientRect()

    let cw = makeButtonsCW(w, {
        top: brect.top + brect.height,
        left: brect.left
    })

    cw.open()

}

function makeButtonsCW(buttons, pos) {
    let cw = new ContextWindow({
        html: templateManager.createHTML('buttons-cw', {
            labels: Object.keys(buttons)
        }),
        pos: pos ?? {}
    })
    
    return cw

}

class ContextWindow {

    constructor(options) {
        this.window = templateManager.createElement('context-window', {
            html: options.html ?? ''
        })
        this.parent = options.parent ?? document.body
        this.parent.appendChild(this.window)
        this.animLength = options.animLength ?? 300
        this.destroyOnClose = options.destroyOnClose ?? true
        this.window.style.transformOrigin = options.transformOrigin ?? 'top left'
        this.setPosition(options.pos ?? {})
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
        if (openedCW == this)
            openedCW = null
        return new Promise((resolve) => {
            if (instantly) {
                resolve()
                return
            }
            this.window.style.animation = `cw-close ${this.animLength}ms ease-in-out`
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