function LCDevice( device ) {

	this._device = device;
	this.state = {};
	
	this.log = function() {
		this.emit.bind(this, 'log').apply( this, arguments );
	}

	this.getState = function( callback ){
		this._get('/state', function( err, result ){
			if( err ) {
				console.error( err );
				return callback( new Error("Could not get the device's state. Is it online?") );
			}

			result = result.split('\n');

			var resultObj = {};
			result = result.map(function(line){
				line = line.split('=');
				if( line.length !== 2 ) return;
				resultObj[ line[0] ] = line[1];
			});

			this.state = {
				id: resultObj.id,
				version: parseInt(resultObj.version),
				mode: resultObj.mode,
				on: ( resultObj.on === 'true' ),
				name: resultObj.name,
				pixels: parseInt(resultObj.pixels),
				effect: resultObj.effect,
				gradient_pixels: resultObj.gradient_pixels,
				gradient_source: resultObj.gradient_source,
				brightness: parseInt(resultObj.brightness)
			}
			
			this.log('state', this.state);		

			callback( null, this.state );
		}.bind(this));
	}

	this.getName = function(){
		return this.state.name;
	}

	this.setName = function( name, callback ){
		this._put('/name', name, function( err, result ){
			if( err ) return callback( new Error("Could not set the device's name. Is it online?") );
			this.state.name = name;
			callback( null );
		}.bind(this));
	}
	
	this.setOn = function( on, callback ) {
		this._put('/on', ( on ) ? 'true' : 'false', function( err, result ){
			if( err ) return callback( new Error("Could not turn the device " + (( on ) ? "on" : "off") + ". Is it online?") );
			callback( null );
		}.bind(this));		
	}
	
	this.setBrightness = function( brightness, callback ) {
		this._put('/brightness', brightness, function( err, result ){
			if( err ) return callback( new Error("Could not set the device's brightness. Is it online?") );
			callback( null );
		}.bind(this));
	}

	this.setGradient = function( colors, callback ){
		
		var pixels = colorsToPixels( colors, this.getNumPixels() );
				
		this._put('/gradient', colors.join(',') + ';' + pixels.join(','), function( err, result ){
			if( err ) return callback( new Error("Could not set the device's colors. Is it online?") );
			callback( null );
		}.bind(this));
	}
	
	this.setEffect = function( effectId, callback ) {
		this._put('/effect', effectId, function( err, result ){
			if( err ) return callback( new Error("Could not set the device's effect. Is it online?") );
			callback( null );
		}.bind(this));		
	}
	
	this.getNumPixels = function() {
		return this._device.pixels || this.state.pixels || 60;
	}
	
	this.setNumPixels = function( numPixels, callback ) {
		this._put('/numpixels', numPixels, function( err, result ){
			if( err ) return callback( new Error("Could not set the device's number of pixels. Is it online?") );
			callback( null );
		}.bind(this));		
	}

	this._call = function( method, path, data, callback, tries ) {	
		
		tries = tries || 0;
					
		var req = new XMLHttpRequest();
			req.timeout = 2000;
			req.addEventListener('readystatechange', onReadyStateChange.bind(this));
			req.addEventListener('error', onError.bind(this))
			req.open( method, 'http://' + this._device.address + path + '?_=' + Date.now() );
			req.setRequestHeader('Content-type', 'text/plain');
			req.send( data );

		function onReadyStateChange() {
			if( req.readyState === 4 ) {
				if( req.status === 200 ) {
					callback && callback( null, req.responseText );
					callback = undefined;
				} else {				
					
					if( tries < 3 )
						return this._call( method, path, data, callback, tries+1 );
							
					callback && callback( new Error( req.responseText || 'unknown_error' ) );
					callback = undefined;
				}
			}
		}

		function onError() {
					
			if( tries < 3 )
				return this._call( method, path, data, callback, tries+1 );
			
			callback && callback( new Error('unknown_error') );
			callback = undefined;
		}

		return req;
	}

	this._get = function( path, callback ) {
		return this._call( 'GET', path, undefined, callback );
	}

	this._post = function( path, body, callback ) {
		return this._call( 'POST', path, body, callback );
	}

	this._put = function( path, body, callback ) {
		return this._call( 'PUT', path, body, callback );
	}

	this._delete = function( path, callback ) {
		return this._call( 'DELETE', path, undefined, callback );
	}

}
heir.inherit(LCDevice, EventEmitter);