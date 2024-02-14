const urlParams = new URLSearchParams(window.location.search);

document.querySelectorAll('a[recurrent]').forEach((link) => {
    let url = new URL(link.href);
    let next = urlParams.get('next') || window.location.pathname + window.location.search;
    url.searchParams.append('next', next);
    link.href = url.toString();
});

function getHidden(id) {
    return document.querySelector('hidden#' + id).innerHTML
}

class TemplateManager {
    constructor() {
        this.templates = {}
    }

    addTemplate(id) {
        let element = document.querySelector(`script[template="${id}"]`)
        if (!element)
            return false
        this.templates[id] = ejs.compile(element.innerHTML)
        return true
    }

    getTemplate(id) {
        if (!this.templates[id] && !this.addTemplate(id))
            return null
        return this.templates[id] ?? null
    }

    createHTML(id, data) {
        let temp = this.getTemplate(id)
        if (!temp)
            return null
        return temp(data ?? {})
    }

    createElement(id, data) {
        let div = document.createElement('div')
        div.innerHTML = this.createHTML(id, data)
        return div.querySelector('*')
    }

    apply(id, data) {
        return this.createHTML(id, data)
    }
}

const templateManager = new TemplateManager();



