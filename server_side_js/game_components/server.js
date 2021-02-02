const Convert = require("../convert");
const MessageTypes = require("../../shared_js/MessageTypes");
const Ransom = require("./ransom");
const Key = require("./key");
const {rollPercentDice} = require("../dice");
const {rollDice} = require("../dice");
module.exports = {
    Server,

    stringIsValidServer: function (string) {
        return string === "local"
            || (string.length === 2)
            && /[a-d][0-9]/.test(string.toLowerCase().substr(1))
    },

    serverFactory: function (sessionId, game, gameMessenger) {
        if (game.servers.length < 1) {
            let servers = [];
            for (let i = 0; i < 4; ++i) {
                servers[i] = [];
                let id = Convert.idNumberToLetter(i);

                let blockNeedsFile = true;

                for (let j = 0; j < 10; ++j) {
                    servers[i][j] = new Server();
                    servers[i][j].id = id + j;
                    servers[i][j].isRansomed = new Ransom("", false);

                    if (blockNeedsFile && (j === 9 || rollPercentDice(0.50))) {
                        blockNeedsFile = false;

                        let key = new Key();

                        servers[i][j].addKey(key);
                        game.keys.push(key);
                    }
                }
            }

            game.servers = servers;
        }

        gameMessenger.sendMessageToPlayer(sessionId, JSON.stringify(game.getServesForUpdate(sessionId)), MessageTypes.UPDATE_BOARD_MSG)
    }
}

const {random} = require("../util");

function Server() {
    let MIN_RAND_COMP_POWER = 4;
    let MAX_RAND_COMP_POWER = 8;
    this.owner = null;
    this.id = null;
    this.computingPower = random(MIN_RAND_COMP_POWER, MAX_RAND_COMP_POWER);
    this.ransom = false;
    this.hasKey = false;
    this.keys = [];
    this.canSee = [];

    this.addKey = function (key) {
        this.keys.push(key);
        this.hasKey = true;
    };

    this.removeKeys = function () {
        let keysToReturn = [];

        this.keys.forEach(function (key) {
            keysToReturn.push(key);
        });

        this.keys = [];
        this.hasKey = false;
        return keysToReturn;
    };

    this.getServerForPlayer = function (sessionId) {
        if (this.canSee.includes(sessionId)) {
            return this;
        }

        let serverToReturn = new Server();
        serverToReturn.computingPower = 0;
        serverToReturn.owner = null;
        serverToReturn.id = this.id;
        return serverToReturn;
    }
}