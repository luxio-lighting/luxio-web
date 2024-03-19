export default class LuxioSerial {

  constructor({ device }) {
    this.device = device;
    this.reader = null;
    this.writer = null;

    this.buffer = '';

    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();

    this.requestId = 1;
    this.requests = new Map();

    this.eventListeners = new Map();
  }

  debug(...props) {
    console.log('[LuxioSerial]', ...props);
  }

  async open() {
    await this.device.open({ baudRate: 115200 });
    this.reader = this.device.readable.getReader();
    this.writer = this.device.writable.getWriter();

    Promise.resolve().then(async () => {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;

        for (const char of this.decoder.decode(value)) {
          if (char === '\n') {
            try {
              const json = JSON.parse(this.buffer);
              if (json.debug) {
                this.debug('[debug]', json.debug);
              } else if (json.event) {
                this.debug('[event]', json.event, json.data);

                if (this.eventListeners.has(json.event)) {
                  this.eventListeners.get(json.event).forEach(callback => {
                    callback(json.data);
                  });
                }
              } else if (json.id) {
                const request = this.requests.get(json.id);
                if (!request) return this.debug(`No request found for id: ${json.id}`);

                if (request.timeout) {
                  clearTimeout(request.timeout);
                }

                if (json.error) {
                  request.reject(new Error(json.error));
                } else {
                  request.resolve(json.result);
                }

                this.requests.delete(json.id);
              }
            } catch (err) {
              this.debug(`Could Not Parse JSON: ${err.message}`);
            }
            this.buffer = '';
          } else {
            this.buffer += char;
          }
        }
      }
    }).catch(err => this.debug(err));
  }

  async close() {
    await this.device.close();
  }

  async write(data) {
    if (!this.writer || !this.reader) {
      throw new Error('Device not open');
    }

    await this.writer.write(this.encoder.encode(JSON.stringify(data) + '\n'));
  }

  async request(method, params = {}, timeout = 2500) {
    const requestId = ++this.requestId % 256;

    const data = {
      method,
      params,
      id: requestId,
    };

    let requestPromiseResolve;
    let requestPromiseReject;
    const requestPromise = new Promise((resolve, reject) => {
      requestPromiseResolve = resolve;
      requestPromiseReject = reject;
    });

    this.requests.set(requestId, {
      resolve: requestPromiseResolve,
      reject: requestPromiseReject,
      timeout: setTimeout(() => {
        requestPromiseReject(new Error(`Timeout after ${timeout}ms`));
      }, timeout),
    });

    // this.debug(`Request ${requestId} = ${method}`);
    await this.write(data).catch(err => {
      this.requests.delete(requestId);
      throw err;
    });

    return requestPromise;
  }

  // Methods
  system = {
    getName: async () => {
      return this.request('system.get_name');
    },

    setName: async ({ name }) => {
      return this.request('system.set_name', { name });
    },
  };

  wifi = {
    getState: async () => {
      return this.request('wifi.get_state');
    },

    scanNetworks: async () => {
      return this.request('wifi.scan_networks');
    },

    getNetworks: async () => {
      return this.request('wifi.get_networks');
    },

    connect: async ({ ssid, pass }) => {
      return this.request('wifi.connect', { ssid, pass });
    },

    disconnect: async () => {
      return this.request('wifi.disconnect');
    },
  };

  led = {
    setColor: async ({ r, g, b, w }) => {
      return this.request('led.set_color', { r, g, b, w });
    },

    setGradient: async ({ pixels = [] }) => {
      return this.request('led.set_gradient', { pixels });
    },

    getType: async () => {
      return this.request('led.get_type');
    },

    setType: async ({ type }) => {
      return this.request('led.set_type', { type });
    },

    getCount: async () => {
      return this.request('led.get_count');
    },

    setCount: async ({ count }) => {
      return this.request('led.set_count', { count });
    },

    getPin: async () => {
      return this.request('led.get_pin');
    },

    setPin: async ({ pin }) => {
      return this.request('led.set_pin', { pin });
    },
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (!this.eventListeners.has(event)) return;

    const listeners = this.eventListeners.get(event);
    listeners.delete(callback);
  }

  once(event, callback) {
    const onceCallback = (...props) => {
      this.off(event, onceCallback);
      callback(...props);
    };

    this.on(event, onceCallback);
  }
}