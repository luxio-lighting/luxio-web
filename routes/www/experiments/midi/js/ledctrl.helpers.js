/*
	Selector methods
*/
function limit(canvas, x, y) {
	var radians = Math.atan2(y - canvas.center[1], x - canvas.center[0])
    var dist = distance([x, y], canvas.center);

    var resultObj = {
	    x: x,
	    y: y,
	    color: getColor( radians, dist, canvas.radius )
    }

    if( dist <= canvas.radius ) {
        return resultObj;
    } else {
		resultObj.x = Math.cos(radians) * canvas.radius + canvas.center[0];
	    resultObj.y = Math.sin(radians) * canvas.radius + canvas.center[1];
	    return resultObj;
    }
}

function distance(dot1, dot2) {
    var x1 = dot1[0],
        y1 = dot1[1],
        x2 = dot2[0],
        y2 = dot2[1];
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function getColor( radians, dist, maxDist ){

	dist = Math.min( dist, maxDist );
	var deg = ( radToDeg( radians ) + 360 + 90 ) % 360;

	var rgb = HSVtoRGB( deg/360, dist/maxDist, 1 );
	var hex = padZero( rgb.r.toString(16), 2 )
			+ padZero( rgb.g.toString(16), 2 )
			+ padZero( rgb.b.toString(16), 2 )

	return hex;
}

function radToDeg(angle) {
	return angle * (180 / Math.PI);
}

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

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function padZero(str, len, c){
    var c = c || '0';
    while(str.length < len) str = c + str;
    return str;
}

function preventDefault( e ) {
	e.preventDefault();
}

function stopPropagation( e ) {
	e.stopPropagation();
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Converts from degrees to radians.
function degToRad(degrees) {
  return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees.
function radToDeg(radians) {
  return radians * 180 / Math.PI;
};

function colorsToPixels( colors, numPixels ) {

	var c = document.createElement('canvas');
		c.width = numPixels;
		c.height = 1;

	var ctx = c.getContext('2d');
	
	var fillStyle;
	if( colors.length === 1 ) {
		fillStyle = '#' + colors[0];
	} else {
		fillStyle = ctx.createLinearGradient(0, 0, c.width, c.height);
		colors.forEach(function(color, i){
			fillStyle.addColorStop( i/(colors.length-1), '#' + color );
		});
	}

	ctx.fillStyle = fillStyle;
	ctx.fillRect(0, 0, c.width, c.height);

	var pixels = [];
	for( var i = 0; i < numPixels; i++ ) {
		var p = ctx.getImageData(i, 0, 1, 1).data;
		var hex = ("000000" + rgbToHex(p[0], p[1], p[2])).slice(-6).toUpperCase();
		pixels.push( hex );
	}

	return pixels;

}

function getElementIndex(el) {
    var children = el.parentNode.childNodes,
        i = 0;
    for (; i < children.length; i++) {
        if (children[i] == el) {
            return i;
        }
    }
    return -1;
}