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

const publicVapidKey = 'BFz5DJhb3Fxpj5UB855BnYqXV6HCi2_UJyYGsgEFZRBAGCrm9XThi18-BFxb_cv7lgcrH0Lguj3J6SWfv3E02E8'

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function send() {
    const register = navigator.serviceWorker.register('/public/worker.js', {
        
    })
    const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    })

    await fetch('/subnotif', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
            'content-type': 'application/json',
            'credentials': 'same-origin'
        }
    })
}

