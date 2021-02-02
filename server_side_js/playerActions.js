const Ransom = require("./game_components/ransom");
const {rollDice} = require("./dice");
const {rollPercentDice} = require("./dice");
module.exports = {
    defendServer: function (player, server) {
        let defendCost = 3;
        if (player.roundComputingPower >= defendCost && server.computingPower < 31) {
            server.computingPower += defendCost;
            player.roundComputingPower -= defendCost;
        }
    },

    acquireServer: function (player, server, game) {
        if (server.ransom.isRansomed && server.ransom.playerId !== player.playerId) {
            return;
        }

        let acquireCost = 5;

        if (player.roundComputingPower >= acquireCost) {
            if (server.owner === null) {
                server.owner = rollDice(player.computingPower, ((((game.serversOwned * 1) + 1) * 0.01) + player.serverCount) + player.computingPower * ((Math.floor(Math.random() * (11 - 8)) + 8) / 10)) ? player.playerId : null;
                game.serversOwned += server.owner === null ? 0 : 1;
            } else if (server.owner !== player.playerId) {
                server.owner = rollPercentDice(0.45 - calcCompPowerPercentage(player.computingPower, game.getPlayerByPId(server.owner).computingPower + server.computingPower)) ? player.playerId : server.owner;
            }

            if (server.hasKey && server.owner === player.playerId) {
                server.keys.forEach(function (key) {
                        key.owner = player.playerId;
                    }
                )
            }

            calculateCanSee(game);
            player.roundComputingPower -= acquireCost;
        }
    },

    deployRansomware: function (player, server, game) {
        let ransomCost = 6;
        if (player.roundComputingPower >= ransomCost && server.owner !== null && server.owner !== player.playerId) {
            server.ransom = rollPercentDice(0.60 - calcCompPowerPercentage(player.computingPower, game.getPlayerByPId(server.owner).computingPower + server.computingPower)) ? new Ransom(player.playerId) : new Ransom(null, false);
            player.roundComputingPower -= ransomCost;
        }
    },

    payRansom: function (player, server, game) {
        let ransomCost = Math.ceil(server.computingPower * 0.5) + 7;
        if (player.roundComputingPower >= ransomCost && server.ransom.isRansomed && server.owner === player.playerId) {
            player.tempComputingPower -= ransomCost;
            game.getPlayerByPId(server.ransom.playerId).tempComputingPower += ransomCost;
            server.ransom = new Ransom(null, false);
            player.roundComputingPower -= ransomCost;
        }
    },

    wipeServer: function (player, server, game) {
        if (server.owner === player.playerId) {
            server.ransom = new Ransom(null, false);
            server.owner = null;
            --game.serversOwned;

            let keys = server.removeKeys();

            for (let i = 0; i < keys.length; ++i) {
                let key = keys[i];
                let newKeyServer = game.randomServer();
                while (newKeyServer.hasKey) {
                    newKeyServer = game.randomServer();
                }

                key.reset();
                newKeyServer.addKey(key);
            }
        }
    },

    scanServer: function (player, server) {
        let scanCost = 6;
        if (player.roundComputingPower >= scanCost) {
            if (!server.isRansomed.isRansomed) {
                server.canSee.push(player.sessionId);
            } else {
                player.messages.push("Scan on Server " + server.id + " Failed.");
            }
            player.roundComputingPower -= scanCost;
        }
    },

    moveKeys: function (serverFrom, serverTo) {
    let keys = serverFrom.removeKeys();

    keys.forEach(function (key) {
        serverTo.addKey(key);
    });
}
}

function calculateCanSee(game) {
    for (let i = 0; i < game.servers.length; ++i) {
        for (let j = 0; j < game.servers[i].length; ++j) {
            let server = game.servers[i][j];
            for (let k = 0; k < neighbors[j].length; ++k) {
                let neighbor = game.servers[i][neighbors[j][k]];
                if (neighbor.owner != null) {
                    server.canSee.push(game.getPlayerByPId(neighbor.owner).sessionId);
                }
            }
        }
    }
}

function calcCompPowerPercentage(compA, compB) {
    if (compA > compB) {
        return (Math.log10(compA / compB) / 3);
    }

    return -(Math.log10(compB / compA) / 3);
}

let neighbors = [
    [0, 1, 4],
    [1, 0, 2, 4, 5],
    [2, 1, 3, 5, 6],
    [3, 2, 6],
    [4, 0, 1, 5, 7],
    [5, 1, 2, 4, 6, 7, 8],
    [6, 2, 3, 5, 8],
    [7, 4, 5, 8, 9],
    [8, 5, 6, 7, 9],
    [9, 7, 8]
];