(function() {
	"use strict";

	var _ = require("./_");

	/**
	 * Lens Laws:
	 *
	 * 1. You get back what you put in.
		l.get(l.set(o, v)) === v
	 * Any custom lens probably does this by default, but you can screw it up, 
	 * so be careful.
	 * 2. Putting back what you got doesn't change anything:		
		l.set(o, l.get(o)) === o
	 * This is enforced by Lens, but if you violated #1, it could break it.
	 * 3. Setting twice is the same as setting once:
		l.set(l.set(o, v) v2) === l.set(o, v2)
	 * To violate this one, your lens would probably need to have some sort of 
	 * state, or impure input or something like that. So just don't do that.
	 *
	 * To summarize: Make sure your lenses are pure functions, and don't
	 * transform what gets put in by set in a way that isn't fully reversible.
	 */
	function Lens(get, set) {
		this.get = get;
		this.set = function(target, newValue) {
			// 2nd lens law: putting back what you got doesn't change anything
			// so we should preserve object references whenever possible.
			if (get.call(this, target) === newValue) {
				return target;
			}
			return set.call(this, target, newValue);
		};
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
			return (array && array.length + n) || 0;
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
	 * This violates the first lens law and is probably not a good idea.
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
