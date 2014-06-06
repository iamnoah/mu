!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.mu=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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

},{}],2:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var Lens = _dereq_("./lens"),
		_ = _dereq_("./_");
	/**
	 * Creates a getter-setter combining the given Lens with the given compute.
	 *
	 * @param {Lens} lens
	 * @param {compute} computed
	 * @return a function like that returned by atom(...) suitable for 
	 * creating a compute.
	 */
	function compose(lens, computed, convert) {
		function getterSetter(newValue) {
			if (arguments.length) {
				var result = lens.set(computed(), newValue);
				computed(result == null ? result : Object.freeze(result));
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
		getterSetter.focus = focuser(getterSetter, convert);
		return getterSetter;
	}

	function focuser(computed, convert) {
		return function() {
			// insert converters along the path so that our lens correctly sets values
			var path = _.toArray(arguments).reduce(function(state, prop) {
				var convert = state.convert || {};
				// array, so the converter applies to each item
				// pass it along as is so it will be applied next
				if (typeof prop === "number") {
					return {
						convert: convert,
						path: state.path.concat([prop]),
					};
				// convert the current object, then get the prop and its converters
				} else if (convert.$this) {
					return {
						convert: convert[prop],
						path: state.path.concat([Lens.typed(convert.$this), prop]),
					};
				// no converter for the current object, but keep descending
				} else {
					return {
						convert: convert[prop],
						path: state.path.concat([prop]),
					};
				}
			}, {
				convert: convert,
				path: [],
			}).path;
			return compose(Lens.path.apply(Lens, path), computed);
		};
	}

	/**
	 * Wraps a computed function. computed is presumably an observable
	 * that has the following semantics:
		computed() => return the current value
		computed(newValue) => sets the current value
	 * 
	 * Atom provides the following semantics:

		var state = Atom(stateCompute);
		var baz = state.focus("foo", "bar", 3, "baz");
		baz.get() => stateCompute().foo.bar[3].baz
		baz() => shorthand for get
		baz.set(123) => sets stateCompute().foo.bar[3].baz to 123,
			stateCompute will be updated
		baz(123) => shorthand for set

		baz.focus("futher", "refinement")
	 *
	 * The get/set function returned by Atom is suitable for creating a CanJS compute.
	 * KnockoutJS users can do a simple translation:
		ko.computed({ read: baz.get, write: baz.set })
	 *
	 * Recommendation: Object.freeze the initial value your compute/observed
	 * contains to prevent non-atomic modifications.
	 */
	function Atom(computed, convert) {
		if (typeof computed !== "function") {
			var val = computed;
			computed = function(newVal) {
				if (arguments.length) {
					val = newVal;
				}
				return val;
			};
		}
		return compose(Lens.I, computed, convert);
	}

	Atom.convert = function(Class, props) {
		return _.extend({
			"$this": Class
		}, props);
	};

	Atom.convert.scalar = Lens.typed.scalar;

	function from(obj, convert) {
		if (!convert) {
			return obj;
		}
		if (_.isArray(obj)) {
			return obj.map(function(data) {
				return from(data, convert);
			});
		}
		var result = {};
		for (var prop in obj) {
			if (_.has(obj, prop)) {
				result[prop] = from(obj[prop], convert[prop]);
			}
		}
		return convert.$this ? new convert.$this(result) : result;
	}


	Atom.define = function() {
		var convert = Atom.convert.apply(Atom, arguments);
		function AtomType(computed) {
			return new Atom(computed, convert);
		}
		AtomType.fromJSON = function(data) {
			return from(data, convert);
		};
		return AtomType;
	};

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

},{"./_":1,"./lens":3}],3:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var _ = _dereq_("./_");

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

	function copyObj(obj) {
		var copy = {};
		for(var p in obj) {
			if (_.has(obj, p)) {
				copy[p] = obj[p];
			}
		}
		return copy;
	}

	Lens.prop = function(property) {
		return new Lens(function(obj) {
			return obj && obj[property];
		}, function(obj, val) {
			// shallow copy and write
			var copy = copyObj(obj || {});
			copy[property] = val;
			return copy;
		});
	};

	// XXX this isn't really so bad. a shallow copy will be made of the 
	// enumerable properties of the class, then a new instance will be 
	// constructed from that.
	/**
	 * Create a lens that ensures that the value set is of the given type (by
	 * instantiating a new instance of the Type.)
	 */
	Lens.typed = function(Class) {
		return new Lens(function(instance) {
			return instance;
		}, function(oldInstance, newData) {
			var result = new Class(newData);
			return result instanceof Scalar ? result.value : result;
		});
	};

	function Scalar(value) {
		this.value = value;
	}

	/**
	 * Lens.typed creates a new instance via new Class(newData). If you need a
	 * scalar value (string, number, etc.) you cannot return it from a 
	 * constructor. So return Lens.typed.scalar(value) instead.
	 */
	Lens.typed.scalar = function(value) {
		return new Scalar(value);
	};

	Lens.path = function() {
		return _.toArray(arguments).reduce(function(lens, prop) {
			return lens.andThen(prop instanceof Lens ? prop :
				typeof prop === "number" ?
					Lens.nth(prop) : Lens.prop(prop));
		}, Lens.I);
	};

	module.exports = Lens;
})();

},{"./_":1}],4:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var Lens = _dereq_("./lens"),
		Atom = _dereq_("./atom");

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
},{"./atom":2,"./lens":3}]},{},[4])
(4)
});