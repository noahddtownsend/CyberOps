const Random = require('random');

const random = Random.uniform();

module.exports = {
    random: function (min, max) {
        return Math.floor(random() * (max - min + 1) + min);
    },

    sleep: function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}