const button = document.querySelector('#hey')

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

        this.setPosition(options.pos ?? {})
    }

    setPosition(pos) {
        ['top', 'left', 'right', 'bottom'].forEach(dir => {
            if (pos[dir])
                this.window.style[dir] = pos[dir] + 'px'
        })
    }

    open() {
        this.window.style.display = 'block'
        this.window.style.animation = 'cw-open-lt 400ms ease-in-out'
    }

}