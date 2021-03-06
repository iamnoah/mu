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
	 * Also, note the special value of Lens.Delete
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
			if (val === Delete) {
				copy.splice(index(array), 1);
			} else {
				copy[index(array)] = val;
			}
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

	/**
	 * Delete is a special case for objects and arrays. It's not enough to just
	 * set a value to undefined because the key will still be enumerable/counted.
	 *
	 * Passing Lens.Delete to set() for any built-in lens is equivalent to 
	 * deleting that key on an object, or splicing it out of an array.
	 *
	 * If you implement your own lens, be sure that it will handle Delete 
	 * properly.
	 */
	var Delete = {};
	Object.defineProperty(Delete, "valueOf", {
		value: function() {},
	});
	Object.defineProperty(Lens, "Delete", {
		value: Object.freeze(Delete),
	});

	Lens.prop = function(property) {
		return new Lens(function(obj) {
			return obj && obj[property];
		}, function(obj, val) {
			// shallow copy and write
			var copy = copyObj(obj || {});
			if (val === Delete) {
				delete copy[property];
			} else {
				copy[property] = val;
			}
			return copy;
		});
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
