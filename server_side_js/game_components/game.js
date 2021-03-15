module.exports = Game;

const PriorityQueue = require('fastpriorityqueue');
const Order = require('./order');
const {ACTIONS} = require('../../shared_js/constants')
const Convert = require('../convert');
const PlayerActions = require("../playerActions");
const MessageTypes = require("../../shared_js/MessageTypes");
const {rollDice} = require("../dice");

function Game(gameMessenger) {
    this.players = [];
    this.playerPostfix = [false, false, false, false, false];
    this.playerCount = 0;

    this.servers = [];
    this.serversOwned = 0;

    this.keys = [];

    this.playerOrders = [];
    this.playerOrdersCount = 0;
    this.allPlayerOrders = new PriorityQueue(function (a, b) {
        if (a.action === b.action) {
            return rollDice();
        }
        return a.action > b.action;
    });

    this.gameMessenger = gameMessenger

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
        let game = this;
        for (let sessionId in this.players) {
            if (sessionId === undefined) {
                continue;
            }
            this.playerOrders[sessionId].forEach(function (order) {
                if (!(order == null || order.action == null || order.object == null)) {
                    game.allPlayerOrders.add(new Order(order, sessionId));
                }
            })
        }

        this.allPlayerOrders.trim();

        while (!this.allPlayerOrders.isEmpty()) {
            let order = this.allPlayerOrders.poll();

            if (order === null) {
                return;
            }

            let idLetter = Convert.idLetterToNumber(order.object.substr(0, 1));
            let idNum = order.object.substr(1);
            let server = this.servers[idLetter][idNum];

            switch (order.action) {
                case ACTIONS.DEFEND:
                    PlayerActions.defendServer(this.players[order.sessionId], server);
                    break;
                case ACTIONS.ACQUIRE:
                    PlayerActions.acquireServer(this.players[order.sessionId], server, this);
                    break;
                case ACTIONS.RANSOM:
                    PlayerActions.deployRansomware(this.players[order.sessionId], server, this);
                    break;
                case ACTIONS.PAY_RANSOM:
                    PlayerActions.payRansom(this.players[order.sessionId], server, this);
                    break;
                case ACTIONS.WIPE_SERVER:
                    PlayerActions.wipeServer(this.players[order.sessionId], server, this);
                    break;
                case ACTIONS.SCAN:
                    PlayerActions.scanServer(this.players[order.sessionId], server);
                    break;
            }
        }

        this.resetPlayerOrders();
    };

    this.findKeys = function (order, socketId) {
        let player = this.players[socketId];

        if (order != null) {
            if (order.object.toLowerCase() === "local") {
                gameMessenger.sendMessageToPlayer(player.sessionId, false.toString(), MessageTypes.FIND_KEY)
                return;
            }
            let idLetter = Convert.idLetterToNumber(order.object.substr(0, 1));
            let idNum = order.object.substr(1);
            let server = this.servers[idLetter][idNum];

            if ((server.owner === player.playerId && !server.ransom.isRansomed) || server.ransom.playerId === player.playerId) {
                if (server.hasKey && player.playerId === server.owner) {
                    server.keys[0].isFound = true
                }

                gameMessenger.sendMessageToPlayer(player.sessionId, server.hasKey, MessageTypes.FIND_KEY);
            } else {
                gameMessenger.sendMessageToPlayer(player.sessionId, MessageTypes.FIND_KEY + ": cannot open " + server.id + " filesystem: Permission denied", MessageTypes.TERMINAL_MESSAGE);
            }
        }
    }

    this.moveKeys = function (order, socketId) {
        if (order != null) {
            if (order.object.toLowerCase() === "local") {
                return;
            }
            let idLetter = Convert.idLetterToNumber(order.object.substr(0, 1));
            let idNum = order.object.substr(1, 1);
            let server = this.servers[idLetter][idNum];

            let secondIdLetter = Convert.idLetterToNumber(order.object.substr(3, 1));
            let secondIdNum = order.object.substr(4, 1);
            let server2 = this.servers[secondIdLetter][secondIdNum];

            let player = this.players[socketId];
            if (server.owner === player.playerId && !server.ransom.isRansomed) {
                if (server.hasKey) {
                     PlayerActions.moveKeys(server, server2);
                }

                this.gameMessenger.sendMessageToPlayer(player.sessionId, server.hasKey.toString());
            } else if (server.ransom.playerId === player.playerId) {
                gameMessenger.sendMessageToPlayer(player.sessionId, MessageTypes.MOVE_KEY + ": cannot write " + server.id + " filesystem: Read-only", MessageTypes.TERMINAL_MESSAGE);
            } else {
                gameMessenger.sendMessageToPlayer(player.sessionId, MessageTypes.MOVE_KEY + ": cannot open " + server.id + " filesystem: Permission denied", MessageTypes.TERMINAL_MESSAGE)
            }
        }
    }

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
    };

    this.randomServer = function () {
        return this.servers[random(0, 3)][random(0, 9)];
    };
}