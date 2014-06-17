(function() {
	"use strict";

	function makeHolder(){
		return {
			state: {},
			setState: function(s) {
				this.state = s;
			}
		};
	}

	module.exports = {
		stateCompute: function(key) {
			var component = makeHolder();
			function compute(newValue) {
				if (arguments.length) {
					var s = {};
					s[key] = newValue;
					component.setState(s);
					return;
				}
				return component.state[key];
			}
			compute.attach = function(c) {
				// save the current value and restore it to the new component
				var value = compute();
				component = c;
				compute(value);
			};
			compute.detach = function() {
				compute.attach(makeHolder());
			};
			return compute;
		}
	};
})();