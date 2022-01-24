export function getEmails (/* context */) {
    console.log(this)
    this.$axios.get(this.$api + "/emails")
            .then(response => {
                this.commit('example/SET_EMAILS', JSON.parse(JSON.stringify(response.data)))
            })
}
