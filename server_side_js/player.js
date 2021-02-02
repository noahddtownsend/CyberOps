module.exports = Player;

MessageTypes = require('../shared_js/MessageTypes');

function Player(name, sessionId, game, gameControl) {
    this.name = name;
    this.sessionId = sessionId;
    this.playerId = '';
    this.computingPower = 20;
    this.roundComputingPower = this.computingPower;
    this.tempComputingPower = 0;
    this.serverCount = 0;
    this.winningServerCount = 0;
    this.messages = [];

    game.addPlayer(this);

    this.updatePlayer = function (io) {
        this.calculateComputingPower();
        this.tempComputingPower = 0;
        gameControl.sendMessageToPlayer(this.sessionId, JSON.stringify(this), MessageTypes.UPDATE_PLAYER_MSG);
    };

    this.calculateComputingPower = function () {
        this.serverCount = 0;
        this.computingPower = 20;
        for (let i = 0; i < game.servers.length; ++i) {
            for (let j = 0; j < game.servers[i].length; ++j) {
                let server = game.servers[i][j];
                if (server.owner === this.playerId && !server.ransom.isRansomed) {
                    ++this.serverCount;
                    this.computingPower += server.computingPower < 8 ? server.computingPower : 7;
                }
            }
        }

        this.computingPower += Math.ceil(Math.log2(this.serverCount > 0 ? this.serverCount : 1));
        this.computingPower += this.tempComputingPower;
        this.roundComputingPower = this.computingPower;
    }


}