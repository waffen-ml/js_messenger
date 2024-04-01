class UserChecklist {
    constructor(users, block) {
        this.users = users
        this.checked = new Array(users.length).fill(false)
        this.element = templateManager.createElement('user-checklist', {users: users, block: block})
        this.onchange = () => {}

        this.element.querySelectorAll('a.button').forEach((button, i) => {
            let checkbox = button.querySelector('input')

            button.addEventListener('click', () => {
                this.checked[i] = !this.checked[i]
                checkbox.checked = this.checked[i]
                this.onchange(this.checked)
            })
        })
    }

    getChecked() {
        return this.checked
    }
}