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

	function makeAccessor(lens, computed) {
		function getterSetter(newValue) {
			if (arguments.length) {
				var result = lens.set(computed(), newValue);
				deepFreeze(result);
				var oldData = computed();
				computed(interceptors.reduce(function(newData, fn) {
					return fn(newData, oldData);
				}, result));
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
		var interceptors = [];
		/**
		 * Usage:
		 	// your interceptor will be called before any change is applied
			atom.beforeChange(function(newData, oldData) {
				// remember that newData is immutable so you will need to 
				// copy it
				// mu.Lens can be very helpful
				return modifiedData;
			});
		 */	
		getterSetter.beforeChange = function(interceptor) {
			interceptors.push(interceptor);
		};		
		return getterSetter;
	}

	/**
	 * Creates a getter-setter combining the given Lens with the given compute.
	 *
	 * @param {Lens} lens
	 * @param {compute} computed
	 * @return a function like that returned by atom(...) suitable for 
	 * creating a compute.
	 */
	function compose(lens, computed, options) {
		var getterSetter = makeAccessor(lens, computed);
		getterSetter.del = function() {
			var value = options.parent.get();
			var result;
			var key = options.parentKey;
			if (typeof key === "number") {
				 result = value.slice(0);
				 result.splice(key, 1);
			} else {
				result = _.extend({}, value);
				delete result[key];
			}
			options.parent.set(result);
		};
		getterSetter.push = function(value) {
			var result = (getterSetter.get() || []).slice(0);
			if (!_.isArray(result)) {
				throw new Error("target is not an array!");
			}
			result.push(value);
			getterSetter.set(result);
		};
		getterSetter.update = function(updater) {
			// create a new atom that holds a copy of the current state to be 
			// modified, pass it to the updater, and update ourselves with the 
			// result
			var atom = new Atom(getterSetter.get(), options.convert);
			updater(atom);
			getterSetter.set(atom());
		};
		getterSetter.focus = focuser(getterSetter, options);
		return getterSetter;
	}

	function focuser(computed, options) {
		return function() {
			// insert converters along the path so that our lens correctly sets values
			var definition = _.toArray(arguments).reduce(function(state, prop) {
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
				convert: options.convert,
				path: [],
			});

			return compose(Lens.path.apply(Lens, definition.path), computed, {
				convert: definition.convert,
				parent: makeAccessor(
					Lens.path.apply(Lens, definition.path.slice(
						0, definition.path.length  - 1)), computed),
				parentKey: _.last(definition.path.filter(function(path) {
					return typeof path === "number" ||
						typeof path === "string";
				}))
			});
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
		var root = compose(Lens.I, computed, {
			convert: convert,
		});
		// deleting the root is a little weird but we can manage it by setting
		// the computed to null
		// some computed implementations will not understand setting it to 
		// undefined
		root.del = function() {
			computed(null);
		};
		return root;
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

	module.exports = Atom;
})();
