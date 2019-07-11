const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PriorityQueue = require('fastpriorityqueue');

const UPDATE_BOARD_MSG = "updateServerBoard";
const UPDATE_PLAYER_MSG = "updatePlayer";
const GAME_MESSAGE = "message";
const GLOBAL_MESSAGE = "globalMessage";

const ACTIONS = {
    "DEFEND": 0,
    "ACQUIRE": 1,
    "RANSOM": 2,
    "PAY_RANSOM": 3,
    "SCAN": 100
};

app.use(express.static('public'));

app.get(/\/images\/.*/, function (req, res) {
    res.sendFile(__dirname + req.url);
});

app.get(/\/css\/.*/, function (req, res) {
    res.sendFile(__dirname + req.url);
});

app.get(/\/js\/.*/, function (req, res) {
    res.sendFile(__dirname + req.url);
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});


//TODO: update everywhere to use getGame() instead
let game = new Game();

io.on('connection', function (socket) {
    socket.on('submitOrders', function (json) {
        io.to(socket.id).emit('message', 'Orders Received');

        let incomingOrders = JSON.parse(json);

        getGame(socket.id).addPlayerOrders(socket.id, incomingOrders);

        if (getGame(socket.id).playerOrdersCount === getGame(socket.id).playerCount) {
            game.executeOrders();
            game.updateAllPlayers(io);
            for (let i  in getGame(socket.id).players) {
                io.to(i).emit(UPDATE_BOARD_MSG, JSON.stringify(game.getServesForUpdate(i)));
            }
        }
    });

    socket.on('terminalCommand', function (json) {
        let game = getGame(socket.id);

        let order = JSON.parse(json);

        if (order != null) {
            if (order.object.substr(0, 1) === "local") {
                return;
            }
            let idLetter = idLetterToNumber(order.object.substr(0, 1));
            let idNum = order.object.substr(1);
            let server = game.servers[idLetter][idNum];

            io.to(socket.id).emit(GAME_MESSAGE, server.hasFile ? "Key found!" : "Key not found");
        } else {
            io.to(socket.id).emit(GAME_MESSAGE, json);
        }
    });

    socket.on('disconnect', function () {
        getGame(socket.id).removePlayer(getPlayer(socket.id));
    });

    socket.on('requestUpdate', function () {
        socket.emit(UPDATE_BOARD_MSG, JSON.stringify(getGame(socket.id).getServesForUpdate(socket.id)));
        socket.emit(UPDATE_PLAYER_MSG, JSON.stringify(getPlayer(socket.id)));
    });

    serverFactory(socket.id);
    new Player("HackAttack", socket.id);
    getPlayer(socket.id).updatePlayer(socket);
    fullUpdate(socket);
});

function defendServer(sessionId, server) {
    let defendCost = 3;
    if (getPlayer(sessionId).roundComputingPower >= defendCost && server.computingPower < 31) {
        server.computingPower += defendCost;
        getPlayer(sessionId).roundComputingPower -= defendCost;
    }
}

function acquireServer(sessionId, server) {
    if (server.ransom.isRansomed) {
        return;
    }

    let acquireCost = 5;

    let player = getPlayer(sessionId);
    let game = getGame(sessionId);

    if (player.roundComputingPower >= acquireCost) {
        if (server.owner === null) {
            server.owner = rollDice(player.computingPower, (((getGame().serversOwned + 1) * 0.01) + player.serverCount) + player.computingPower * ((Math.floor(Math.random() * (11 - 8)) + 8) / 10)) ? player.playerId : null;
            getGame().serversOwned += server.owner === null ? 0 : 1;
            game.players[sessionId].winningServerCount += game.winningServers.includes(server.id) ? 1 : 0;
        } else if (server.owner !== player.playerId) {
            server.owner = rollPercentDice(0.45 - calcCompPowerPercentage(player.computingPower, game.getPlayerByPId(server.owner).computingPower + server.computingPower)) ? player.playerId : server.owner;
        }

        calculateCanSee(getGame(sessionId));
        player.roundComputingPower -= acquireCost;
    }
}

function deployRansomware(sessionId, server) {
    let ransomCost = 6;
    let player = getPlayer(sessionId);
    if (player.roundComputingPower >= ransomCost && server.owner !== null && server.owner !== getPlayer(sessionId).playerId) {
        server.ransom = rollPercentDice(0.60 - calcCompPowerPercentage(player.computingPower, game.getPlayerByPId(server.owner).computingPower + server.computingPower)) ? new Ransom(sessionId) : new Ransom(null, false);
        player.roundComputingPower -= ransomCost;
    }
}

function payRansom(sessionId, server) {
    let ransomCost = Math.ceil(server.computingPower * 0.5) + 7;
    let player = getPlayer(sessionId);
    if (player.roundComputingPower >= ransomCost && server.ransom.isRansomed && server.owner === player.playerId) {
        player.tempComputingPower -= (Math.ceil(server.computingPower * 0.5) + 7);
        getPlayer(server.ransom.playerId).tempComputingPower += Math.ceil(server.computingPower * 0.5) + 7;
        server.ransom = new Ransom(null, false);
        player.roundComputingPower -= ransomCost;
    }
}

function scanServer(sessionId, server) {
    let scanCost = 6;
    if (getPlayer(sessionId).roundComputingPower >= scanCost) {
        if (!server.isRansomed.isRansomed) {
            server.canSee.push(sessionId);
        } else {
            getPlayer(sessionId).messages.push("Scan on Server " + server.id + " Failed.");
        }
        getPlayer(sessionId).roundComputingPower -= scanCost;
    }
}

function fullUpdate(socket) {
    io.to(socket.id).emit(UPDATE_PLAYER_MSG, JSON.stringify(getPlayer(socket.id)));
    io.to(socket.id).emit(UPDATE_BOARD_MSG, JSON.stringify(getGame(socket.id).getServesForUpdate(socket.id)));
}

function serverFactory(sessionId) {
    if (getGame(sessionId).servers.length < 1) {
        let servers = [];
        for (let i = 0; i < 4; ++i) {
            servers[i] = [];
            let id = idNumberToLetter(i);

            let blockNeedsFile = true;

            for (let j = 0; j < 10; ++j) {
                servers[i][j] = new Server();
                servers[i][j].id = id + j;
                servers[i][j].isRansomed = new Ransom("", false);

                if (blockNeedsFile && (j === 9 || rollDice(2, 2))) {
                    blockNeedsFile = false;
                    servers[i][j].hasFile = true;
                    getGame(sessionId).winningServers.push(servers[i][j].id);
                }
            }
        }

        game.servers = servers;
    }

    io.to(sessionId).emit(UPDATE_BOARD_MSG, JSON.stringify(getGame(sessionId).getServesForUpdate(sessionId)));
}

function getPlayer(sessionId) {
    return game.players[sessionId];
}

function getGame(sessionId) {
    return game;
}

function idNumberToLetter(i) {
    switch (i) {
        case 0:
            return 'A';
            break;
        case 1:
            return 'B';
            break;
        case 2:
            return 'C';
            break;
        case 3:
            return 'D';
    }
}

function idLetterToNumber(letter) {
    switch (letter) {
        case 'A':
            return 0;
            break;
        case 'B':
            return 1;
            break;
        case 'C':
            return 2;
            break;
        case 'D':
            return 3;
    }
}

function calcCompPowerPercentage(compA, compB) {
    if (compA > compB) {
        return (Math.log10(compA / compB) / 3);
    }

    return -(Math.log10(compB / compA) / 3);
}

function rollPercentDice(percent = 0.50) {
    return Math.random() < percent;
}

function rollDice(aRolls = 2, bRolls = 2) {
    let a = 0;
    let b = 0;

    for (let i = 0; i < aRolls; ++i) {
        a += Math.random();
    }

    for (let i = 0; i < bRolls; ++i) {
        b += Math.random();
    }

    return a > b;
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

function Player(name, sessionId) {
    this.name = name;
    this.sessionId = sessionId;
    this.playerId = '';
    this.computingPower = 20;
    this.roundComputingPower = this.computingPower;
    this.tempComputingPower = 0;
    this.serverCount = 0;
    this.winningServerCount = 0;
    this.messages =[];

    game.addPlayer(this);

    this.updatePlayer = function (io) {
        this.calculateComputingPower();
        this.tempComputingPower = 0;
        io.to(this.sessionId).emit(UPDATE_PLAYER_MSG, JSON.stringify(this));
    };

    this.calculateComputingPower = function () {
        this.serverCount = 0;
        this.computingPower = 20;
        for (let i = 0; i < getGame(this.sessionId).servers.length; ++i) {
            for (let j = 0; j < getGame(this.sessionId).servers[i].length; ++j) {
                let server = getGame(this.sessionId).servers[i][j];
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

function Server() {
    this.owner = null;
    this.id = null;
    this.computingPower = Math.floor(Math.random() * (8 - 4 + 1) + 4);
    this.ransom = false;
    this.hasFile = false;
    this.canSee = [];

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

function Game() {
    this.players = [];
    this.playerPostfix = [false, false, false, false, false];
    this.playerCount = 0;

    this.servers = [];
    this.winningServers = [];
    this.serversOwned = 0;

    this.playerOrders = [];
    this.playerOrdersCount = 0;
    this.allPlayerOrders = new PriorityQueue(function (a, b) {
        if (a.action === b.action) {
            return rollDice();
        }
        return a.action > b.action;
    });

    this.getPlayerByPId = function (pid) {
        for (let key in this.players) {
            if (this.players[key].playerId === pid) {
                return this.players[key];
            }
        }

        return null;
    };

    this.getServesForUpdate = function (sessionId) {
        let servers = [];

        for (let i = 0; i < this.servers.length; ++i) {
            servers[i] = [];
            for (let j = 0; j < this.servers[i].length; ++j) {
                servers[i][j] = this.servers[i][j].getServerForPlayer(sessionId);
            }
        }

        return servers;
    };

    this.getServersOwnedBy = function (playerId) {
        let playerServers = [];
        for (let i in this.servers) {
            if (this.servers.owner === this.players[playerId].playerId) {
                playerServers.push(i);
            }
        }

        return playerServers;
    };

    this.addPlayerOrders = function (sessionId, playerOrders) {
        if (typeof this.playerOrders[sessionId] === 'undefined') {
            ++this.playerOrdersCount;
        }

        this.playerOrders[sessionId] = playerOrders
    };

    this.executeOrders = function () {
        for (let sessionId in this.players) {
            if (sessionId === undefined) {
                continue;
            }
            this.playerOrders[sessionId].forEach(function (order) {
                if (!(order == null || order.action == null || order.object == null)) {
                    getGame(sessionId).allPlayerOrders.add(new Order(order, sessionId));
                }
            })
        }

        this.allPlayerOrders.trim();

        while (!this.allPlayerOrders.isEmpty()) {
            let order = this.allPlayerOrders.poll();

            if (order === null) {
                return;
            }

            let idLetter = idLetterToNumber(order.object.substr(0, 1));
            let idNum = order.object.substr(1);
            let server = this.servers[idLetter][idNum];

            switch (order.action) {
                case ACTIONS.DEFEND:
                    defendServer(order.sessionId, server);
                    break;
                case ACTIONS.ACQUIRE:
                    acquireServer(order.sessionId, server);
                    break;
                case ACTIONS.RANSOM:
                    deployRansomware(order.sessionId, server);
                    break;
                case ACTIONS.PAY_RANSOM:
                    payRansom(order.sessionId, server);
                    break;
                case ACTIONS.SCAN:
                    scanServer(order.sessionId, server);
                    break;
            }
        }

        this.resetPlayerOrders();
    };

    this.resetPlayerOrders = function () {
        this.playerOrders = [];
        this.playerOrdersCount = 0;
    };

    this.addPlayer = function (player) {
        if (this.players[player.sessionId] === undefined) {
            ++this.playerCount;
            this.players[player.sessionId] = player;
            for (let i = 1; i < this.playerPostfix.length; ++i) {
                if (!this.playerPostfix[i]) {
                    this.playerPostfix[i] = true;
                    player.playerId = 'p' + i;
                    break;
                }
            }
        }
    };

    this.removePlayer = function (player) {
        if (this.players[player.sessionId] !== undefined) {
            this.playerPostfix[player.playerId.substr(1)] = false;
            delete this.players[player.sessionId];
            --this.playerCount;
        }
    };

    this.updateAllPlayers = function (io) {
        for (let key in this.players) {
            this.players[key].updatePlayer(io);
        }
    }
}

function Ransom(playerId, isRansomed = true) {
    this.isRansomed = isRansomed;
    this.playerId = playerId;
}

function Order(order, sessionId) {
    this.action = order.action;
    this.object = order.object;
    this.sessionId = sessionId;
}