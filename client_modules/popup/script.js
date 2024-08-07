const animlength = 300;
let lastPopup = null


function createUserListPopup(users, ...options) {
    return new Popup({
        html: templateManager.createHTML('user-list', {users: users}),
        closable: true,
        ...options
    })
}


class Popup {
    // shown, hidden

    constructor(config) {
        this.closable = config.closable ?? false
        this.popup = templateManager.createElement('popup', {
            html: config.html ?? ''
        })

        if (config.className)
            this.popup.classList.add(config.className)
        
        this.window =  this.popup.querySelector('.window')
        this.content = this.window.querySelector('.content')
        this.removeOnClose = config.removeOnClose ?? true
        this.optionHolder = this.window.querySelector('.buttons');
        this.isOpened = false
        this.events = {}

        this.windowAnimation = config.windowAnimation ?? {}
        this.windowAnimation.open ??=  `open-window ${animlength}ms ease-in-out forwards`
        this.windowAnimation.close ??= `close-window ${animlength}ms ease-in-out forwards`

        this.setTitle(config.title)

        let cbtn = this.window.querySelector('.close-btn');
        cbtn.style.display = this.closable? 'block' : 'none';
        cbtn.addEventListener('click', () => this.close())
        
        this.popup.addEventListener('click', (e) => {
            if (this.isOpened && this.closable && e.target == this.popup)
                this.close()
        });

        document.body.appendChild(this.popup)

    }

    querySelector(selector) {
        return this.popup.querySelector(selector)
    }

    remove() {
        this.popup.remove()
    }

    on(name, evfunc) {
        this.events[name] = evfunc
    }

    _fireEvent(name) {
        if(this.events[name])
            this.events[name]()
    }

    clearOptions() {
        this.optionHolder.innerHTML = ''
        this.optionHolder.style.display = 'none'
    }

    addOption(text, onclick) {
        this.optionHolder.style.display = 'flex'
        
        let btn = document.createElement('button')
        btn.classList.add('button')
        btn.textContent = text
        btn.addEventListener('click', () => {
            if(onclick())
                this.close()
        })

        this.optionHolder.insertBefore(btn, this.optionHolder.firstChild)
    }

    removeOption(text) {
        this.optionHolder.querySelectorAll('button')
        .forEach(butt => {
            if(butt.textContent === text)
                this.optionHolder.removeChild(butt)
        })
    }

    togglePointerEvents(state) {
        this.popup.style.pointerEvents = state? 'all' : 'none';
    }

    setHTML(html) {
        this.content.innerHTML = html
    }

    setTitle(title) {
        let element = this.window.querySelector('.page-title')
        if(!title)
            element.style.display='none'
        else {
            element.style.display='block'
            element.textContent=title
        }
        
    }

    open(instantly) {
        this.togglePointerEvents(false);
        this.popup.style.display = 'flex';
        this.isOpened = true
        lastPopup = this
        
        let onShown = () => {
            this.togglePointerEvents(true)
            this._fireEvent('shown')
        }

        if(instantly)
            onShown()
        else {
            this.popup.style.animation = `popup-appear ${animlength}ms ease-in-out forwards`
            this.window.style.animation = this.windowAnimation.open
            setTimeout(() => onShown(), animlength)
        }
    }

    close(instantly) {
        if(!this.isOpened)
            return

        this.togglePointerEvents(false);
        this.isOpened = false

        let onHidden = () => {
            this.popup.style.display = 'none';
            this._fireEvent('hidden')
            if (this.removeOnClose)
                this.remove()
        }

        if (instantly)
            onHidden()
        else {
            this.popup.style.animation = `popup-disappear ${animlength}ms ease-in-out forwards`
            this.window.style.animation = this.windowAnimation.close
            setTimeout(() => onHidden(), animlength)
        }
    }

    replace(newPopup) {
        this.close(true)
        newPopup.open(true)
    }

}

document.addEventListener('keydown', (e) => {
    if (e.key == 'Escape' && lastPopup && lastPopup.closable && lastPopup.isOpened) {
        e.preventDefault();
        lastPopup.close()
    }
});

