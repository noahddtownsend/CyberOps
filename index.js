const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const Player = require('./server_side_js/game_components/player')
const Game = require('./server_side_js/game_components/game')

const MessageTypes = require('./shared_js/MessageTypes')

const {serverFactory} = require("./server_side_js/game_components/server");

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

let gameMessenger = new GameMessenger();
let game = new Game(gameMessenger);

io.on('connection', function (socket) {
    let game = getGame(socket.id);

    socket.on(MessageTypes.SUBMIT_ORDERS, function (json) {
        io.to(socket.id).emit(MessageTypes.GAME_MESSAGE, 'Orders Received');

        let incomingOrders = JSON.parse(json);

        game.addPlayerOrders(socket.id, incomingOrders);

        if (game.playerOrdersCount === game.playerCount) {
            game.executeOrders();
            game.updateAllPlayers(io);
            for (let i in game.players) {
                io.to(i).emit(MessageTypes.UPDATE_BOARD_MSG, JSON.stringify(game.getServesForUpdate(i)));
                io.to(i).emit(MessageTypes.GAME_MESSAGE, "Orders Executed")
            }

            let keyOwner = game.keys[0].owner;
            let numFound = 0;
            game.keys.forEach(function (key) {
                if (keyOwner === key.owner && key.isFound) {
                    ++numFound
                }
            });
            if (numFound === game.keys.length) {
                io.to(socket.id).emit(MessageTypes.GAME_MESSAGE, game.getPlayerByPId(keyOwner).name + ' Won!');
            }
        }
    });

    socket.on(MessageTypes.FIND_KEY, function (json) {
        let order = JSON.parse(json);

        getGame(socket.id).findKeys(order, socket.id);
    });

    socket.on(MessageTypes.MOVE_KEY, function (json) {
        let order = JSON.parse(json);

        getGame(socket.id).moveKeys(order, socket.id);
    });

    socket.on('disconnect', function () {
        game.removePlayer(getPlayer(socket.id));
    });

    socket.on(MessageTypes.REQUEST_UPDATE, function () {
        fullUpdate(socket)
    });

    new Player("HackAttack", socket.id, getGame(socket.id), gameMessenger);
    getPlayer(socket.id).updatePlayer(socket);
    serverFactory(socket.id, game, gameMessenger).then(_ =>
        fullUpdate(socket)
    )
});

function fullUpdate(socket) {
    gameMessenger.sendMessageToPlayer(socket.id, JSON.stringify(getPlayer(socket.id), MessageTypes.UPDATE_PLAYER_MSG));
    gameMessenger.sendMessageToPlayer(socket.id, JSON.stringify(getGame(socket.id).getServesForUpdate(socket.id), MessageTypes.UPDATE_BOARD_MSG));
}

function getPlayer(sessionId) {
    return game.players[sessionId];
}

function getGame(sessionId) {
    return game;
}

function GameMessenger() {
    this.sendMessageToPlayer = function (sessionId, message, channel) {
        io.to(sessionId).emit(channel, message);
    }
}