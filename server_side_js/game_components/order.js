module.exports = Order;

function Order(order, sessionId) {
    this.action = order.action;
    this.object = order.object;
    this.sessionId = sessionId;
}