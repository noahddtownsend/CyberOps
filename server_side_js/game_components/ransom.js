module.exports = Ransom;

function Ransom(playerId, isRansomed = true) {
    this.isRansomed = isRansomed;
    this.playerId = playerId;
}