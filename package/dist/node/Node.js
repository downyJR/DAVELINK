"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
const RESTClient_1 = require("../rest/RESTClient");
const WebSocketClient_1 = require("../ws/WebSocketClient");
const EventEmitter_1 = require("../core/EventEmitter");
const helpers_1 = require("../utils/helpers");
class Node extends EventEmitter_1.TypedEventEmitter {
    id;
    options;
    rest;
    ws;
    constructor(options, userAgent = "DALink/1.0.0") {
        super();
        this.id = options.id ?? (0, helpers_1.generateId)("node");
        this.options = options;
        this.rest = new RESTClient_1.RESTClient(options, userAgent);
        this.ws = new WebSocketClient_1.WebSocketClient(options, userAgent);
    }
    connect(userId) {
        this.ws.setUserId(userId);
        this.ws.connect();
    }
    disconnect() {
        this.ws.destroy();
    }
    destroy() {
        this.disconnect();
        this.rest.destroy();
        this.removeAllListeners();
    }
}
exports.Node = Node;
//# sourceMappingURL=Node.js.map