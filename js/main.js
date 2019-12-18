const socket = io();
let player;
let currentCompPower = 0;
let playerOrders = [];
let servers = [];

const ACTIONS = {
    "DEFEND": 0,
    "ACQUIRE": 1,
    "RANSOM": 2,
    "PAY_RANSOM": 3,
    "SCAN": 100
};

socket.on('findKey', function (msg) {
    setTimeout(function () {
        if (msg === true.toString()) {
            printToTerminal("Key found!")
        } else {
            printToTerminal("Key not found")
        }
    }, Math.random() * 1000);
});

socket.on('message', function (msg) {
    showMessage(msg);
});

socket.on('terminal', function (msg) {
    printToTerminal(msg);
});

socket.on('updateServerBoard', function (json) {
    playerOrders = [];
    $("#orderHolder").html("");
    let html = "";

    let updatedServers = JSON.parse(json);

    let boardCount = 0;
    updatedServers.forEach(function (serverSection) {
        html += "<div class=\"hexBoard\" id=\"board" + boardCount + "\">";
        ++boardCount;

        let serverCount = 0;
        html += "<div class='hexRow0'>";
        serverSection.forEach(function (server) {
            servers[server.id] = server;
            let statusIcon = "";
            if (server.ransom.isRansomed) {
                statusIcon = "<img src='/images/ransomIcon.svg' width='100%' class='serverStatusIcon' alt='Ransom'>"
            }
            html += "<div class='hexBorder " + server.owner + "' id='" + server.id
                + "' onclick='showServerPanel(\"" + server.id + "\")' onmouseover='updateServerLabel(\""
                + server.id + "\")' onmouseleave='updateServerLabel(\"-1\")'><span class='hex'></span>"
                + statusIcon + "</div>";
            switch (serverCount) {
                case 3:
                    html += "</div><div class='hexRow1'>";
                    break;
                case 6:
                    html += "</div><div class='hexRow2'>";
                    break;
                case 8:
                    html += "</div><div class='hexRow3'>";
                    break;
            }
            ++serverCount;
        });

        html += "</div></div>";
    });

    html += "<div class='bigHexBorder'><span class='bigHex'></span></div></div>";
    $('#gameBoard').html(html);
});

socket.on('updatePlayer', function (json) {
    player = JSON.parse(json);
    currentCompPower = player.computingPower;
    updatePowerCircle(100, player.computingPower);
    $('#playerName').html(player.name);

    for (let i = 1; i < 5; ++i) {
        $("#playerIndicator").removeClass("p" + i);
    }

    $("#playerIndicator").addClass(player.playerId);
    updateTerminalServer()
});

function updateServerLabel(id) {
    if (id === "-1") {
        $("#mainServerLabel").html("&mdash;");
    } else {
        $("#mainServerLabel").html("Server " + id);
    }
}

function showMessage(message) {
    if (message.length > 0) {
        let messageFade = 500;
        let fadeoutCur = message;

        if (!$(".message").length) {
            fadeoutCur = 0;
        }

        $(".message").fadeOut(messageFade);
        setTimeout(
            function () {
                $(".message").remove();
                let html = "<div class='message'>" + message + "</div>";
                $("body").append(html);
                $(".message").fadeIn(messageFade);
                setTimeout(
                    function () {
                        $(".message").fadeOut(messageFade);
                        setTimeout(
                            function () {
                                $(".message").remove();
                            }, messageFade);
                    }, 5000);
            }, fadeoutCur);
    }
}

function showServerPanel(id) {
    let panelHtml = "<div class='serverPanel'>\n" +
        "    <div class='serverLabel'>Server " + id + "</div>\n" +
        "<div class=\"circlechart serverPanelCompPower\" id=\"computingPower\" unselectable=\"on\" onselectstart=\"return false;\"\n" +
        "             onmousedown=\"return false;\" data-percentage=\"63\">" + servers[id].computingPower + "</div>" +
        "    <div class='serverActions'>\n";

    if (servers[id].owner !== player.playerId) {
        let acquireDisabled = (servers[id].ransom.isRansomed && servers[id].ransom.playerId !== player.playerId)  ? "disabled" : "";
        let acquireFunction = (servers[id].ransom.isRansomed && servers[id].ransom.playerId !== player.playerId) ? "showMessage(\"Cannot acquire while held ransom\")" : "acquireServer(\"" + id + "\")";

        let ransomDisabled = servers[id].ransom.isRansomed ? "disabled" : "";
        let ransomFunction = servers[id].ransom.isRansomed ? "showMessage(\"Server is already held ransom\")" : "ransomServer(\"" + id + "\")";

        panelHtml +=
            "<div class='serverAction " + acquireDisabled + "' onclick='" + acquireFunction + "'>\n" +
            "            <img src='/images/acquireServerIcon.svg' class='serverActionIcon'>\n" +
            "            <br>\n" +
            "            <span class='serverActionText'>Acquire Server</span>\n" +
            "</div>\n";

        if (servers[id].owner != null) {
            panelHtml +=
                "<div class='serverAction " + ransomDisabled + "' onclick='" + ransomFunction + "'>\n" +
                "            <img src='/images/ransomIcon.svg' class='serverActionIcon'>\n" +
                "            <br>\n" +
                "            <span class='serverActionText'>Deploy Ransomware</span>\n" +
                "</div>";
        } else {
            panelHtml +=
                "<div class='serverAction' onclick='scanServer(\"" + id + "\")'>\n" +
                "            <img src='/images/scanServerIcon.svg' class='serverActionIcon'>\n" +
                "            <br>\n" +
                "            <span class='serverActionText'>Scan Server</span>\n" +
                "</div>";
        }
    }

    if (servers[id].owner === player.playerId) {
        if (servers[id].ransom.isRansomed) {
            panelHtml +=
                "<div class='serverAction' onclick='payRansom(\"" + id + "\")'>\n" +
                "            <img src='/images/payRansomIcon.svg' class='serverActionIcon'>\n" +
                "            <br>\n" +
                "            <span class='serverActionText'>Pay Ransom</span>\n" +
                "</div>\n";
        } else {
            panelHtml +=
                "<div class='serverAction' onclick='defendServer(\"" + id + "\")'>\n" +
                "            <img src='/images/defendServerIcon.svg' class='serverActionIcon'>\n" +
                "            <br>\n" +
                "            <span class='serverActionText'>Defend Server</span>\n" +
                "</div>\n";
        }
    }

    panelHtml += "</div>\n<input type='button' value='CANCEL' onclick='hideServerPanel()'></div>";
    $("body").append(panelHtml);
    $(".serverPanel").css("width", "80vw");

    $('.serverPanelCompPower').html(makesvg(servers[id].computingPower / 30, servers[id].computingPower));
    $('.serverPanelCompPower').css("display", "block");
}

function hideServerPanel() {
    $(".serverPanel").css("width", "0vw");
    setTimeout(
        function () {
            $(".serverPanel").remove();
        }, 210);
}

function defendServer(id) {
    hideServerPanel();
    if (currentCompPower > 2) {
        playerOrders.push(new Order(ACTIONS.DEFEND, id));
        let orderId = playerOrders.length;
        currentCompPower -= 3;
        updatePowerCircle(currentCompPower / player.computingPower, currentCompPower);

        createOrderCard(ACTIONS.DEFEND, 3, orderId, id)
    } else {
        showMessage("Not enough computing power for this action!");
    }
}

function acquireServer(id) {
    hideServerPanel();
    if (currentCompPower > 4) {
        playerOrders.push(new Order(ACTIONS.ACQUIRE, id));
        let orderId = playerOrders.length;
        currentCompPower -= 5;
        updatePowerCircle(currentCompPower / player.computingPower, currentCompPower);

        createOrderCard(ACTIONS.ACQUIRE, 5, orderId, id)
    } else {
        showMessage("Not enough computing power for this action!");
    }
}

function ransomServer(id) {
    hideServerPanel();
    if (!servers[id].ransom.isRansomed && servers[id].owner !== player.playerId) {
        if (currentCompPower > 6) {
            playerOrders.push(new Order(ACTIONS.RANSOM, id));
            let orderId = playerOrders.length;
            currentCompPower -= 7;
            updatePowerCircle(currentCompPower / player.computingPower, currentCompPower);

            createOrderCard(ACTIONS.RANSOM, 7, orderId, id)
        } else {
            showMessage("Not enough computing power for this action!");
        }
    }
}

function payRansom(id) {
    hideServerPanel();
    if (servers[id].ransom.isRansomed && servers[id].owner === player.playerId) {
        let ransomCost = Math.ceil(servers[id].computingPower * 0.5) + 7;
        if (currentCompPower >= ransomCost) {
            playerOrders.push(new Order(ACTIONS.PAY_RANSOM, id));
            let orderId = playerOrders.length;
            currentCompPower -= ransomCost;
            updatePowerCircle(currentCompPower / player.computingPower, currentCompPower);

            createOrderCard(ACTIONS.PAY_RANSOM, ransomCost, orderId, id)
        } else {
            showMessage("Not enough computing power for this action!");
        }
    }
}

function scanServer(id) {
    hideServerPanel();
    let scanCost = 6;
    if (currentCompPower >= scanCost) {
        playerOrders.push(new Order(ACTIONS.SCAN, id));
        let orderId = playerOrders.length;
        currentCompPower -= scanCost;
        updatePowerCircle(currentCompPower / player.computingPower, currentCompPower);

        createOrderCard(ACTIONS.SCAN, scanCost, orderId, id)
    } else {
        showMessage("Not enough computing power for this action!");
    }
}

function createOrderCard(type, cost, orderId, id) {
    let orderType = "";
    let icon = "";

    switch (type) {
        case ACTIONS.DEFEND:
            orderType = "Defend";
            icon = "/images/defendServerIcon.svg";
            break;
        case ACTIONS.ACQUIRE:
            orderType = "Acquire";
            icon = "/images/acquireServerIcon.svg";
            break;
        case ACTIONS.RANSOM:
            orderType = "Deploy Ransomware";
            icon = "/images/ransomIcon.svg";
            break;
        case ACTIONS.PAY_RANSOM:
            orderType = "Pay Ransom";
            icon = "/images/payRansomIcon.svg";
            break;
        case ACTIONS.SCAN:
            orderType = "Scan Server";
            icon = "/images/scanServerIcon.svg";
            break;
    }

    let html = "<div class='orderCard' + id='order" + orderId + "'>\n" +
        "                <img src='" + icon + "' height='100%'>\n" +
        "                <div class='orderText'>\n" +
        "                    <h1>" + orderType + ": " + id + "</h1><br>\n" +
        "                    <h2>" + cost + " Computing Power</h2>\n" +
        "                </div>\n" +
        "                <span class='deleteX' onclick='removeOrder(" + orderId + ", " + cost + ")'>X</span>\n" +
        "            </div>";

    let orderHolder = $("#orderHolder");
    orderHolder.prepend(html);
    orderHolder.scrollTop();
    orderHolder.css("width", "80%");
    orderHolder.css("width", "auto");
}

function removeOrder(id, compPower) {
    $("#order" + id).remove();
    currentCompPower += compPower;
    playerOrders[id - 1] = null;

    updatePowerCircle(currentCompPower / player.computingPower, currentCompPower)
}

function updatePowerCircle(percentage, computingPower) {
    let powerCircle = $('.circlechart');
    powerCircle.html(makesvg(percentage, computingPower));
    powerCircle.css("display", "block");
}

function submitOrders() {
    socket.emit('submitOrders', JSON.stringify(playerOrders));
}

let terminal = $('#terminalInput');
let terminalTitle = $('#terminalTitleBar');
let terminalContent = $("#terminalContent");
let terminalUser = $('#currentTerminalUser');
let terminalHistoryDisplay = $('#terminalHistoryDisplay');
let terminalHistory = Array();
let terminalHistoryIndex = 0;
let terminalServer = "local";

function submitTerminalCommand() {
    let command = terminal.val();
    terminalHistory.push(command);
    terminalHistoryIndex = terminalHistory.length;

    terminalHistoryDisplay.append("<b>" + terminalUser.text() + "</b> " + command + "<br/>");
    terminal.val("");
    terminalContent.scrollTop(99999999999);

    let commandParams = command.split(/\s+/);
    //TODO: only allow terminal operations on servers that the player should have access to
    if (commandParams.length > 0) {
        let command = commandParams[0].toLowerCase();
        switch (commandParams[0]) {
            case "chsvr" :
                if (stringIsValidServer(commandParams[1])) {
                    terminalServer = commandParams[1].toString();
                    if (terminalServer.toLowerCase() !== "local") {
                        terminalServer = terminalServer.toUpperCase();
                    }

                    updateTerminalServer()
                } else {
                    printToTerminal("USAGE: Expected server in form [a-d][0-9] (e.g. chsvr A3)");
                }
                break;
            case "findkey":
                socket.emit('findKey', JSON.stringify(new Order(command, terminalServer)));
                printToTerminal("Searching for key...");
                break;
            case "mvkey":
                if (stringIsValidServer(commandParams[1])) {
                    socket.emit('moveKey', JSON.stringify(new Order(command, terminalServer + "," + commandParams[1].toString().toUpperCase())));
                    printToTerminal("Key moved successfully");
                } else {
                    printToTerminal("USAGE: Expected server in form [a-d][0-9] (e.g. mvkey A3)");
                }
                break;
            case "man":
            //fallthrough to "HELP"
            case "help":
                printTerminalHelp();
                break;
            case "cls":
            //fallthrough to "CLEAR"
            case "clear":
                terminalHistoryDisplay.text("");
                break;
            case "sudo":
                printToTerminal("<a href='https://xkcd.com/149/' target='_blank'>Make your own sandwich!</a>");
                break;
            default:
                printToTerminal(commandParams[0] + ": command not found");
                break;
        }

        terminalContent.scrollTop(99999999999);
    }
}

function updateTerminalServer() {
    terminalUser.text(player.name + "@" + terminalServer + ">>");
    terminalTitle.html("&nbsp;>_ Terminal - Server " + terminalServer);
}

function printTerminalHelp() {
    //https://stackoverflow.com/questions/8515365/are-there-other-whitespace-codes-like-nbsp-for-half-spaces-em-spaces-en-space
    printToTerminal("chsvr [a-d][0-9]:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Select active server for receipt of terminal commands<br/>"
        + "clear:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#8239;&#8239;Clear terminal history<br/>"
        + "findkey:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#8239;&#8239;Search the server for a key file<br/>"
        + "man:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Display list of terminal commands<br/>"
        + "mvkey [a-d][0-9]:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#8239;&#8239;Move a key to another server"
    );
}

function printToTerminal(message) {
    terminalHistoryDisplay.append(message + "<br/>");
    terminal.val("");
    terminalContent.scrollTop(99999999999);
}

$("#terminalContainer").click(function () {
    terminal.focus();
});

function stringIsValidServer(string) {
    return string === "local"
        || (string.length === 2)
        && /[a-d]/.test(string.toLowerCase().substr(0, 1))
        && /[0-9]/.test(string.toLowerCase().substr(1))
}

let ENTER_KEY = 13;
let LEFT_KEY = 37;
let RIGHT_KEY = 39;
let UP_KEY = 38;
let DOWN_KEY = 40;
$(document).on('keydown', function (e) {
    if (e.which === ENTER_KEY && terminal.val() !== "") {
        submitTerminalCommand();
    } else if (terminal.is(":focus") && terminalHistory.length > 0) {
        if (e.which === UP_KEY) {
            if (terminalHistoryIndex > 0) {
                terminal.val(terminalHistory[--terminalHistoryIndex]);
            } else {
                terminalHistoryIndex = 0;
            }

            setTimeout(function () {
                terminal[0].setSelectionRange(terminal.val().length * 2, terminal.val().length * 2)
            }, 1);
        } else if (e.which === DOWN_KEY) {
            if (terminalHistoryIndex < terminalHistory.length - 1) {
                terminal.val(terminalHistory[++terminalHistoryIndex]);
            } else {
                terminal.val("");
                terminalHistoryIndex = terminalHistory.length;
            }

            setTimeout(function () {
                terminal[0].setSelectionRange(terminal.val().length * 2, terminal.val().length * 2)
            }, 1);
        }
    }
});

function Order(action, object) {
    this.action = action;
    this.object = object;
}

$(function () {
    socket.emit('requestUpdate', '');
    printTerminalHelp();
});