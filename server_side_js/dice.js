const Random = require('random');

const random = Random.uniform();

module.exports = {
    rollPercentDice: function (percent = 0.50) {
        let rand = random();
        return  rand < percent;
    },

    rollDice: function (aRolls = 2, bRolls = 2) {
        let a = 0;
        let b = 0;

        for (let i = 0; i < aRolls; ++i) {
            a += random();
        }

        for (let i = 0; i < bRolls; ++i) {
            b += random();
        }

        return a > b;
    },
}