const linkRegex = /(([a-zA-Z]+:\/\/)?(([a-zA-Z0-9\-]+\.)+([a-zA-Z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(\/[a-zA-Z0-9_\-\.~]+)*(\/([a-zA-Z0-9_\-\.]*)(\?[a-zA-Z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/

class ContentCompiler {
    constructor() {
        this.funcs = {
            'yt': (s) => {
                let yt = this.parseYoutubeLink(s)
                return this.makeEmbedYoutubeHTML(yt.id, yt.shorts)
            }
        }
    }

    splitByComma(s) {
        return s.split(',').map(w => w.trim())
    }

    insert(original, fragment, i, j) {
        return original.substring(0, i) + fragment + original.substring(j + 1)
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    processWrapper(content, wrapper, cb) {
        let wregex = this.escapeRegExp(wrapper)
        let regex = new RegExp(`${wregex}(((?!${wregex}).)*)${wregex}`, 'g')
        return content.replace(regex, (match, inner) => cb(inner))
    }

    processTagWrapper(content, wrapper, tag) {
        return this.processWrapper(content, wrapper, (inner) => `<${tag}>${inner}</${tag}>`)
    }

    completeLink(link) {
        if(link.match(/^[a-zA-Z]*:\/\//) === null)
            link = 'https://' + link
        return link
    }

    parseYoutubeLink(url){
        let match = url.match(/(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/)

        if (match == null)
            return null

        let id = match[3]

        if(id.length != 11)
            return null

        return {
            id: id,
            shorts: url.includes('shorts')
        }
    }

    makeEmbedYoutubeHTML(id, shorts) {
        let cls = shorts? 'shorts' : ''

        return `<div class="yt-wrapper block"><div class="yt-embed ${cls}"><div class="ratio-keeper"><iframe 
        src="https://www.youtube.com/embed/${id}"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media;
        gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe></div></div></div>`
    }

    escapeHTML(s) {
        return utils.escapeHTML(s)
    }

    compile(content, options) {
        options ??= {}

        content = this.escapeHTML(content)
        content = this.processTagWrapper(content, '**', 'b')
        content = this.processTagWrapper(content, '__', 'u')
        content = this.processTagWrapper(content, '~~', 's')
        content = this.processTagWrapper(content, '*', 'i')
        content = content.replace(/--/g, '—')
        content = content.replace(/\n/g, '<br>')

        let links = []

        content = content.replace(new RegExp(linkRegex, 'g'),
            (_, link) => {
                let completedLink = this.completeLink(link)
                links.push(completedLink)
                return `<a target="_blank" href="${completedLink}">${link}</a>`
            })

        content = content.replace(/\@([a-z0-9_]*)\b/g,
            '<a target="_blank" href="https://coffeetox.ru/user?tag=$1">@$1</a>')

        //funcs
        content = content.replace(/\/\/([a-z]*)\(([^\)]*)\)/g, (_, funcname, argument) => {
            try {
                return this.funcs[funcname](argument)
            } catch {
                return 'ERROR'
            }
        })

        content = content.replace(/\[([^\]]+)\]:\[([^\]]+)\]/g, '<a target="_blank" href="$2">$1</a>')
        
        if(!options.disableYT) {

            let videos = {
                normal: '',
                shorts: ''
            }

            links.forEach(link => {
                let yt = this.parseYoutubeLink(link)
                if(!yt)
                    return
                let html = this.makeEmbedYoutubeHTML(yt.id, yt.shorts)
                if(yt.shorts) videos.shorts += html
                else videos.normal += html
            })

            content += videos.normal? `<div class="yt-collection-wrapper">${videos.normal}</div>` : ''
            content += videos.shorts? `<div class="yt-collection-wrapper shorts">${videos.shorts}</div>` : ''
        }

        return content
    }
}

const contentCompiler = new ContentCompiler()

//function compilePost() {
//    let postContent = document.querySelector('.entry').value
//    document.querySelector('.post').innerHTML = contentCompiler.compile(postContent)
//}
