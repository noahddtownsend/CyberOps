module.exports = Key;

function Key() {
    this.isFound = false;
    this.owner = null;

    this.reset = function () {
        this.owner = null;
        this.isFound = false;
    }
}