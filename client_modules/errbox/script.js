
class ErrorBox {
    constructor(wrapper, constSize) {
        this.wrapper = wrapper
        this.wrapper.classList.add('error-box')
        this.target = wrapper.firstChild
        this.constSize = constSize
        this.errorSpan = document.createElement('span')
        this.errorSpan.classList.add('error-span')
        this.wrapper.appendChild(this.errorSpan)

        if (constSize)
            this.errorSpan.classList.add('const-size')

        this.removeError()
    }

    removeError() {
        this.target.classList.remove('incorrect')
        this.errorSpan.textContent = ''
        if (!this.constSize)
            this.errorSpan.style.display = 'none'
    }

    setError(err) {
        this.target.classList.add('incorrect')
        this.errorSpan.style.display = 'block'
        this.errorSpan.textContent = err
    }
}