const Random = require('pseudo-random');

module.exports = {
    random: function (min, max) {
        return Math.floor(Random((new Date()).getTime()).random() * (max - min + 1) + min);
    }
}