const Random = require('pseudo-random');

module.exports = {
    rollPercentDice: function (percent = 0.50) {
        return Random((new Date()).getTime()).random() < percent;
    },

    rollDice: function (aRolls = 2, bRolls = 2) {
        let a = 0;
        let b = 0;

        for (let i = 0; i < aRolls; ++i) {
            a += Random((new Date()).getTime()).random();
        }

        for (let i = 0; i < bRolls; ++i) {
            b += Random((new Date()).getTime()).random();
        }

        return a > b;
    },
}