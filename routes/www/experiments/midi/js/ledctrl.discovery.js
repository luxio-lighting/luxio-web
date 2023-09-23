var POLL_INTERVAL = 5000;

function LCDiscovery( opts ) {
	
	this._opts = opts;
	this._devices = {};
	this._discoverInterval;
	this._initialDiscovery = true;

	this.init = function(){
		this._discoverInterval = setInterval( this._discover.bind(this), POLL_INTERVAL);
		this._discover();
	}

	this._discover = function(){

		var req = new XMLHttpRequest();
			req.timeout = 5000;
			req.addEventListener('readystatechange', onReadyStateChange.bind(this));
			req.addEventListener('error', onError.bind(this))
			req.open( 'GET', this._opts.url );
			req.setRequestHeader('Content-type', 'application/json');
			req.send();

		function onReadyStateChange() {
			if( req.readyState === 4 ) {
				if( req.status === 200 ) {
					
					var now = Math.round((new Date()).getTime() / 1000);

					try {
						var body = JSON.parse( req.responseText );
						var devices = body.message;

						for( var deviceId in devices ) {
							if( typeof this._devices[ deviceId ] === 'undefined' ) {
								this.emit('device_found', deviceId, devices[deviceId]);
							}
						}
						
						for( var deviceId in this._devices ) {
							if( typeof devices[ deviceId ] === 'undefined' ) {
								this.emit('device_unfound', deviceId);								
							}
						}

						this._devices = devices;
						
						if( this._initialDiscovery ) {
							this._initialDiscovery = false;
							
							if( Object.keys(this._devices).length === 0 ) {
								this.emit('error', new Error("No devices found.\n\nMake sure you are connected to the same Wi-Fi network."));
							}
						}

					} catch( err ) {
						return this.emit('error', err);
					}

				} else {
					onError( new Error( req.responseText || 'unknown_error' ) );
				}
			}
		}

		function onError( err ) {
			
			if( this._initialDiscovery ) {			
				this.emit('error', err || new Error('unknown_error') );
			}
		}

		return req;

	}

}

heir.inherit(LCDiscovery, EventEmitter);