const menuPopup = new Popup({
    closable: true,
    className: 'menu',
    html: templateManager.createHTML('menu'),
    removeOnClose: false,
    windowAnimation: {
        open: 'menu-appear 300ms ease-in-out forwards',
        close: 'menu-disappear 300ms ease-in-out forwards'
    }
})

function callMenu() {
    menuPopup.open()   
}
