const button = document.querySelector('#hey')

function cwTest() {
    let w = {};

    ['hey', 'hi', 'vovapidr'].forEach(msg => {
        w[msg] = () => console.log(msg)
    })

    makeButtonsCW(w, {
        top: button.clientTop,
        left: button.clientLeft
    })

}

function makeButtonsCW(buttons, pos) {
    pos ??= {}

    let cw = new ContextWindow({
        html: templateManager.createHTML('buttons-cw', {
            labels: Object.keys(buttons)
        })
    })

    return cw

}

class ContextWindow {

    constructor(options) {

        this.window = templateManager.createElement('context-window', {
            html: options.html ?? ''
        })
        this.parent = options.parent ?? document.body
        console.log(this.window)
        this.parent.appendChild(this.window)

        this.setPosition(options.pos ?? {})
    }

    setPosition(pos) {
        ['top', 'left', 'right', 'bottom'].forEach(dir => {
            if (pos[dir])
                this.window.style[dir] = pos[dir] + 'px'
        })
    }

}