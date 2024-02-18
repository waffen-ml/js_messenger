
fetch('/auth')
.then(r => r.text())
.then(r => {
    console.log(r)
    return
    let feed = new Feed(r, null, 
        document.querySelector('.feed'), 
        document.querySelector('main'))
})