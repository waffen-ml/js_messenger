function _getSrc(obj, tag) {
    if (obj.tagName == tag)
        return obj.src;
    const inner = obj.querySelector(tag);
    return inner? inner.src : null;
}

function getElementMedia(obj) {
    const imgSrc = _getSrc(obj, 'IMG');
    if (imgSrc) return {type: 'image', src: imgSrc};
    const vidSrc = _getSrc(obj, 'VIDEO');
    if (vidSrc) return {type: 'video', src: vidSrc};
    return {};
}

class Inspect {
    constructor(mediaCollection, start) {
        this.popup = new Popup({
            closable: true,
            html: templateManager.createHTML('inspect')
        })
        this.mediaCollection = mediaCollection
        this.current = start ?? 0
        this.inspect = this.popup.querySelector('.inspect')
        this.mediaWrapper = this.popup.querySelector('.media')
        this.lb = this.popup.querySelector('.left')
        this.rb = this.popup.querySelector('.right')
        
        this.rb.onclick = () => this.next()
        this.lb.onclick = () => this.prev()
        
        this.updateCurrentMedia()
        this.updateTransitionButtons()
        
    }

    constructMediaHTML(media) {
        switch(media.type) {
            case 'image':
                return `<img src="${media.src}" alt="inspect-img">`;
            case 'video':
                return `<video controls><source src="${media.src}"></video>`;
            default:
                return '';
        }
    }

    updateCurrentMedia() {
        let media = this.mediaCollection[this.current]
        this.mediaWrapper.innerHTML = this.constructMediaHTML(media)
    }

    updateTransitionButtons() {
        if (this.current == this.mediaCollection.length - 1)
            this.inspect.classList.remove('next')
        else
            this.inspect.classList.add('next')

        if (this.current == 0)
            this.inspect.classList.remove('prev')
        else
            this.inspect.classList.add('prev')
    }

    next() {
        if (this.current < this.mediaCollection.length - 1)
            this.current++
        updateCurrentMedia()
        updateTransitionButtons()
    }

    prev() {
        if (this.current > 0)
            this.current--
        updateCurrentMedia()
        updateTransitionButtons()
    }

    open() {
        this.popup.show()
    }

    close() {
        this.popup.close()
    }
}

function inspectMediaCollection(mediaCollection, start) {
    let inspect = new Inspect(mediaCollection, start)
    inspect.open()
    return inspect
}

function inspectSingle(obj) {
    let media = getElementMedia(obj)
    return inspectMediaCollection([media])
}

function inspectGroup(groupid, start) {
    let mediaCollection = Array.from(document.querySelectorAll(`[inspect-group="${groupid}"]`))
        .map(obj => getElementMedia(obj))
    console.log(mediaCollection)
    return inspectMediaCollection(mediaCollection, start)
}

let i = 0;

function setupInspectObjects(container) {
    console.log('setting up inspect objects...');

    container.querySelectorAll('[inspect]').forEach(obj => {
        obj.addEventListener('click', () => inspectSingle(obj));
        obj.setAttribute('inspect', 1);
    });
    
    container.querySelectorAll('[inspect-group]').forEach(group => {
        const gid = i++;
        group.setAttribute('inspect-group', gid);
        [...group.children].forEach((child, j) => {
            child.setAttribute('inspect-parent', gid);
            child.setAttribute('inspect-index', j);
            child.addEventListener('click', () => inspectGroup(gid, j));
        });
    });
}

setupInspectObjects(document);
