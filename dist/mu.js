(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
	"use strict";

	var Lens = require("./lens"),
		_ = require("lodash");
	/**
	 * Creates a getter-setter combining the given Lens with the given compute.
	 *
	 * @param {Lens} lens
	 * @param {compute} computed
	 * @return a function like that returned by atom(...) suitable for 
	 * creating a compute.
	 */
	function compose(lens, computed) {
		function getterSetter(newValue) {
			if (arguments.length) {
				computed(Object.freeze(lens.set(computed(), newValue)));
				return;
			}
			return lens.get(computed());
		}
		getterSetter.get = function() {
			return getterSetter();
		};
		getterSetter.set = function(newValue) {
			getterSetter(newValue);
		};
		return getterSetter;
	}

	/**
	 * Wraps a computed function. computed is presumably an observable
	 * that has the following semantics:
		computed() => return the current value
		computed(newValue) => sets the current value
	 * 
	 * Atom provides the following semantics:

		var state = Atom(stateCompute);
		var baz = state("foo", "bar", 3, "baz");
		baz.get() => stateCompute().foo.bar[3].baz
		baz() => shorthand for get
		baz.set(123) => sets stateCompute().foo.bar[3].baz to 123,
			stateCompute will be updated
		baz(123) => shorthand for set
	 *
	 * The property function returned by Atom#get is suitable for creating a CanJS compute.
	 * KnockoutJS users can do a simple translation:
		ko.computed({ read: baz.get, write: baz.set })
	 *
	 * Recommendation: Object.freeze the initial value your compute/observed
	 * contains to prevent non-atomic modifications.
	 *
	 * Any modifications to objects or arrays will use simple copy operations. 
	 * If you are using something other than plain objects and arrays, your 
	 * data will end up converted to plain objects.
	 */
	function Atom(computed) {
		return function() {
			return compose(Lens.path.apply(Lens, arguments), computed);
		};
	}

	/**
	 * Creates a converter lens
	 *
	 * @param {function(JSON): T} fromJSON
	 * @param {?function(T): JSON} toJSON
	 */
	// function convert(fromJSON, toJSON) {
	// 	toJSON = toJSON || function(value) {
	// 		return value && value.toJSON && value.toJSON() ||
	// 			_.clone(value, true);
	// 	};

	// 	return new Lens(toJSON, function(oldData, newData) {
	// 		return fromJSON(newData);
	// 	});
	// }

	/**
	 * Convenience for wrapping an instance of a serializable class.
	 * Assumptions:
	 *
	 * 1. Class will be invoked by calling new Class(rawData)
	 * 2. If toJSON is not specified and the class does not have a toJSON method,
	 *    it will be deep cloned via _.clone(instance, true)
	 * 3. If Class is not specified, computed() will be invoked to discover the class.
	 *   If computed initially returns null, this will blow up.
	 *
	 * @param {compute} computed
	 * @param {?function(): *} Class the constructor for creating new 
	 * instances of the  class.
	 * @param {?function(T): JSON} toJSON function to serialize the class 
	 * instances.
	 * @return {Atom} a new atom.
	 */
	// Atom.wrapClass = function(computed, Class, toJSON) {
	// 	if (!Class) {
	// 		Class = computed().constructor;
	// 	}

	// 	return new Atom(compose(convert(function(data) {
	// 		return new Class(data);
	// 	}, toJSON), computed));
	// };

	module.exports = Atom;
})();

},{"./lens":2}],2:[function(require,module,exports){
(function() {
	"use strict";

	var _ = require("lodash");

	function Lens(get, set) {
		this.get = get;
		this.set = set;
	}

	Lens.prototype.mod = function(a, f) {
		return this.set(a, f(this.get(a)));
	};
	Lens.prototype.andThen = function(lensB) {
		return Lens.compose(this, lensB);
	};

	Lens.compose = function(a, b) {
		return new Lens(function(o) {
			return b.get(a.get(o));
		}, function(o, val) {
			return a.mod(o, function(o2) {
				return b.set(o2, val);
			});
		});
	};

	Lens.I = new Lens(function(a) {
		return a;
	}, function(a, b) {
		return b;
	});

	Lens.nth = function(n) {
		var index = n < 0 ? function(array) {
			return array.length + n;
		} : function() {
			return n;
		};
		return new Lens(function(array) {
			return array && array[index(array)];
		}, function(array, val) {
			var copy = (array || []).slice(0);
			copy[index(array)] = val;
			return copy;
		});
	};

	Lens.Last = Lens.nth(-1);

	Lens.prop = function(property) {
		return new Lens(function(obj) {
			return obj && obj[property];
		}, function(obj, val) {
			// shallow copy and write
			var copy = _.clone(obj);
			copy[property] = val;
			return copy;
		});
	};

	Lens.path = function() {
		return _.reduce(arguments, function(lens, prop) {
			return lens.andThen(prop instanceof Lens ? prop :
				typeof prop === "number" ?
					Lens.nth(prop) : Lens.prop(prop));
		}, Lens.I);
	};

	module.exports = Lens;
})();

},{}],3:[function(require,module,exports){
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
},{"./atom":1,"./lens":2}]},{},[3])