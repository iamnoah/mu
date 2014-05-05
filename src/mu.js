(function() {
	"use strict";

	var Lens = require("./lens"),
		Atom = require("./atom");

	function deepFreeze(obj) {
		Object.freeze(obj);
		for(var p in obj) {
			if (typeof obj[p] === "object") {
				deepFreeze(obj[p]);
			}
		}
	}

	module.exports = {
		Atom: Atom,
		deepFreeze: deepFreeze,
		Lens: Lens
	};
})();