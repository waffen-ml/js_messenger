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

    apply(id, data) {
        let temp = this.getTemplate(id)
        if (!temp)
            return null
        return temp(data)
    }
}

const templateManager = new TemplateManager();