(function() {
	"use strict";

	var Lens = require("./lens"),
		_ = require("./_");

	// TODO don't freeze in production mode
	var deepFreeze = function(obj) {
		if (typeof obj !== "object" || obj == null) {
			return;
		}
		Object.freeze(obj);
		for(var p in obj) {
			if (_.has(obj, p)) {
				deepFreeze(obj[p]);
			}
		}
	};

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
				deepFreeze(result);
				computed(result);
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
		getterSetter.del = function(key) {
			var value = getterSetter.get();
			var result = _.isArray(value) ? value.slice(0) : _.extend({}, value);
			delete result[key];
			getterSetter.set(result);
		};
		getterSetter.push = function(value) {
			var result = (getterSetter.get() || []).slice(0);
			if (!_.isArray(result)) {
				throw new Error("target is not an array!");
			}
			result.push(value);
			getterSetter.set(result);
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
		deepFreeze(computed());
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
