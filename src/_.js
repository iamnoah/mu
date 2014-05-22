(function() {
	"use strict";

	var slice = [].slice;
	var has = Object.prototype.hasOwnProperty;

	module.exports = {
		extend: function(obj) {
			slice.call(arguments, 1).forEach(function(source) {
				if (source) {
					for (var prop in source) {
						obj[prop] = source[prop];
					}
				}
			});
			return obj;
		},
		isArray: function(thing) {
			return Array.isArray(thing);
		},
		has: function(o, p) {
			return has.call(o, p);
		},
		toArray: function(thing) {
			return slice.call(thing);
		}
	};
})();