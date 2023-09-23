'use strict';

module.exports = class ServerError extends Error {
  
  constructor(e, statusCode) {
    super(e);
    this.statusCode = statusCode;
  }
  
}