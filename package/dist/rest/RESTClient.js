"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESTClient = void 0;
const errors_1 = require("../errors");
class RESTClient {
    constructor(_node, _userAgent = "DALink/1.0.0") {
    }
    destroy() {
        // Cleanup
    }
    async loadTracks(_identifier) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async decodeTrack(_encodedTrack) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async getInfo() {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async getStats() {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async healthCheck() {
        return false;
    }
    async updatePlayer(_sessionId, _guildId, _options, _noReplace) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async destroyPlayer(_sessionId, _guildId) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async setFilters(_sessionId, _guildId, _filters) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async seek(_sessionId, _guildId, _position) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
    async updateSession(_sessionId, _config) {
        throw new errors_1.RESTError("Not implemented", errors_1.ErrorCode.REST_REQUEST_FAILED);
    }
}
exports.RESTClient = RESTClient;
//# sourceMappingURL=RESTClient.js.map