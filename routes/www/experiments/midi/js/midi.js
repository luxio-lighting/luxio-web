window.addEventListener('load', function(){

	let devicesEl = document.getElementById('devices');
	let devices = {};
	let device = null;
	let numPixels;
	let pixels = [];
	
	function setDevice(id) {		
		device = devices[id];
		device.setOn(true, () => {
			device.setBrightness(255, () => {
				numPixels = device.getNumPixels();
				for( let i = 0; i < numPixels; i++ ) {
					pixels[i] = '000000';
				}
				syncGradient();
			});
		});
		window.location.hash = id;
		devicesEl.value = id;
	}
	
	devicesEl.addEventListener('input', function(){
		let id = devicesEl.value;
		setDevice(id);
	});
		
	navigator.requestMIDIAccess()
		.then(function(access) {
	
		const inputs = access.inputs.values();
		
		for( let input of inputs ) {
			input.addEventListener('midimessage', onMidiMessage);
		}
	     
	});
	
	let discovery = new LCDiscovery({
		url: 'http://nupnp.ledctrl.eu'
	});
	discovery.init();
	discovery.on('device_found', ( id, deviceObj ) => {
		
		let optionEl = document.createElement('option');
			optionEl.value = id;
			optionEl.textContent = deviceObj.name;
		devicesEl.appendChild(optionEl);
		
		devices[id] = new LCDevice(deviceObj);
		
		if( window.location.hash === '#' + id ) {
			setDevice(id);
		}
	})
	
	function onMidiMessage(e) {
		let action = e.data[0];
		if( action === 144 ) action = 'down';
		if( action === 128 ) action = 'up';
		let key = e.data[1];
		let pixelIndex = numPixels - ( key - 23 );
		
		let min = 48;
		let max = 84;
		let value = (key-min)/(max-min);
			
		let color = HSVtoRGB(value, 1, 1);
			color = RGBtoHEX(color.r, color.g, color.b);
		
		pixels[pixelIndex] = ( action === 'down' ) ? color : '000000';
		syncGradientThrottle();
		
		document.getElementById('status').innerHTML = '<span>key ' + key + ' ' + action + '<br /><span style="color: #' + color + '">#' + color + '</span></span>';
	}
	
	function syncGradient() {
		if( device ) {
			device.setGradient(pixels, err => {
				if( err ) return console.error(err);
			})
		}
	}
	
	var syncGradientThrottle = _.debounce(_.throttle(syncGradient, 100), 50);
	
	function RGBtoHEX(r,g,b) {
		
		return ( padZero(r.toString(16)) + padZero(g.toString(16)) + padZero(b.toString(16)) ).toUpperCase()
		
		function padZero(input) {
			if( input.length < 2 )
				return '0' + input;
			return input;
		}
	}
	
	/* accepts parameters
	 * h  Object = {h:x, s:y, v:z}
	 * OR 
	 * h, s, v
	*/
	function HSVtoRGB(h, s, v) {
	    var r, g, b, i, f, p, q, t;
	    if (arguments.length === 1) {
	        s = h.s, v = h.v, h = h.h;
	    }
	    i = Math.floor(h * 6);
	    f = h * 6 - i;
	    p = v * (1 - s);
	    q = v * (1 - f * s);
	    t = v * (1 - (1 - f) * s);
	    switch (i % 6) {
	        case 0: r = v, g = t, b = p; break;
	        case 1: r = q, g = v, b = p; break;
	        case 2: r = p, g = v, b = t; break;
	        case 3: r = p, g = q, b = v; break;
	        case 4: r = t, g = p, b = v; break;
	        case 5: r = v, g = p, b = q; break;
	    }
	    return {
	        r: Math.round(r * 255),
	        g: Math.round(g * 255),
	        b: Math.round(b * 255)
	    };
	}

});