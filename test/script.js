const linkRegex = /(([a-zA-Z]+:\/\/)?(([a-zA-Z0-9\-]+\.)+([a-zA-Z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(\/[a-zA-Z0-9_\-\.~]+)*(\/([a-zA-Z0-9_\-\.]*)(\?[a-zA-Z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/
const ytVideoRatio = 16 / 9
const ytShortRatio = 9 / 16
const ytVideoHeight = 300
const ytShortHeight = 400

function escapeHtml(unsafe) {
    return unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

class ContentCompiler {
    constructor() {
        this.funcs = {
            'yt': (s) => {
                let args = this.splitByComma(s)
                let yt = this.parseYoutubeLink(args[0])
                let height = parseInt(args[1])
                let width = parseInt(args[2])

                if(!yt)
                    return 'ERROR'
                else if(yt.shorts) {
                    height = height || ytShortHeight
                    width = width || height * ytShortRatio
                } else {
                    height = height || ytVideoHeight
                    width = width || height * ytVideoRatio
                }

                return this.makeEmbedYoutubeHTML(yt.id, height, width)
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

    makeEmbedYoutubeHTML(id, height=ytVideoHeight, width) {
        if(width === undefined)
            width = height * ytVideoRatio

        return `<iframe width="${width}" height="${height}" 
        src="https://www.youtube.com/embed/${id}"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media;
        gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe>`
    }

    compile(content) {
        content = escapeHtml(content)
        content = this.processTagWrapper(content, '**', 'b')
        content = this.processTagWrapper(content, '__', 'u')
        content = this.processTagWrapper(content, '~~', 's')
        content = this.processTagWrapper(content, '*', 'i')
        content = content.replace(/--/g, '—')
        content = content.replace('\n', '<br>')

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
        
        links.forEach(link => {
            let yt = this.parseYoutubeLink(link)
            if(!yt)
                return
            else if (yt.shorts)
                content += this.makeEmbedYoutubeHTML(yt.id, ytShortHeight, ytShortHeight * ytShortRatio)
            else
                content += this.makeEmbedYoutubeHTML(yt.id)
        })

        return content
    }
}

//**hey** hiii **hey *_* **  my god ** **

const contentCompiler = new ContentCompiler()

function compilePost() {
    let postContent = document.querySelector('.entry').value
    document.querySelector('.post').innerHTML = contentCompiler.compile(postContent)
}
