
fetch('/auth')
.then(r => r.json())
.then(r => {
    let feed = new Feed(r, null, 
        document.querySelector('.feed'), 
        document.querySelector('main'))
})