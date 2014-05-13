/*global describe, it*/
var Lens = require("../src/lens");
require("should");

describe("Lens", function() {
	"use strict";
	describe("#nth", function() {
		var array = [1, 2, 3];

		var _2 = Lens.nth(2);

		it("should get the right value", function() {
			_2.get(array).should.eql(3);
		});
		it("should obey the lens laws", function() {
			_2.get(_2.set(array, 4)).should.eql(4);
			_2.set(array, _2.get(array)).should.eql(array);
			_2.set(_2.set(array, 1000), 3).should.eql(array);
		});
	});

	describe("#prop", function() {
		var foo = {
			bar: 123
		};
		var bar = Lens.prop("bar");
		it("should get the right value", function() {
			bar.get(foo).should.eql(123);
		});

		it("should obey the lens laws", function() {
			bar.get(bar.set(foo, 4)).should.eql(4);
			bar.set(foo, bar.get(foo)).should.eql(foo);
			bar.set(bar.set(foo, 987), 654).bar.should.eql(654);
		});
	});

	describe("#Last", function() {
		var array = [1, 2, 3];

		var last = Lens.Last;

		it("should get the right value", function() {
			last.get(array).should.eql(3);
		});
		it("should obey the lens laws", function() {
			last.get(last.set(array, 4)).should.eql(4);
			last.set(array, last.get(array)).should.eql(array);
			last.set(last.set(array, 1000), 3).should.eql(array);
		});
	});

	describe("#path", function() {
		var foo = {
			bar: [{
				baz: {
					qux: 123
				},
				other: {}
			}]
		};

		var qux = Lens.path("bar", 0, "baz", "qux");

		it("should get the right value", function() {
			qux.get(foo).should.eql(123);
		});

		it("should obey the lens laws", function() {
			qux.get(qux.set(foo, 4)).should.eql(4);
			qux.set(foo, qux.get(foo)).should.eql(foo);
			qux.set(qux.set(foo, 987), 654).bar[0].baz.qux.should.eql(654);
		});

		it("should compose lenses", function() {
			var bar1 = Lens.path("bar", 0);
			var barsQux = Lens.path("baz", "qux");

			var q = Lens.path(bar1, barsQux);

			q.get(q.set(foo, 4)).should.eql(4);
			q.set(foo, q.get(foo)).should.eql(foo);
			q.set(q.set(foo, 987), 654).bar[0].baz.qux.should.eql(654);
		});
	});

	describe("#typed", function() {
		function Baz(data) {
			if(data instanceof Baz) {
				return data;
			}
			Object.defineProperty(this, "qux", {
				enumerable: true,
				get: function() {
					return data && (data.quxx || data.qux);
				}
			});
			Object.defineProperty(this, "quxx", {
				enumerable: false,
				get: function() {
					return 999;
				}
			});

			Object.freeze(this);
		}
		var foo = {
			bar: [{
				baz: new Baz({
					qux: 123
				}),
				other: {}
			}]
		};
		var baz = Lens.path("bar", 0, "baz", Lens.typed(Baz));
		var qux = Lens.path("bar", 0, "baz", Lens.typed(Baz), "qux");

		it("should exchange with a new instance", function() {
			// exchange with a new instance
			baz.get(foo).should.be.an.instanceOf(Baz);
			baz.set(foo, new Baz({qux: 456})).bar[0].baz.should.be.an.instanceOf(Baz);
			baz.set(foo, new Baz({qux: 456})).bar[0].baz.qux.should.eql(456);
			baz.set(foo, {qux: 456}).bar[0].baz.should.be.an.instanceOf(Baz);
		});
		
		it("should create a new instance when setting a sub-prop", function() {
			qux.set(foo, 789).bar[0].baz.should.be.an.instanceOf(Baz);
			qux.set(foo, 789).bar[0].baz.qux.should.eql(789);
		});
			
		it("should creates new instances with no existing data", function() {
			qux.set({}, 789).bar[0].baz.should.be.an.instanceOf(Baz);
			qux.set({}, 789).bar[0].baz.qux.should.eql(789);
		});

		it("should obey the lens laws", function() {
			baz.get(baz.set(foo, new Baz({ qux: 4 }))).qux.should.eql(4);
			baz.set(foo, baz.get(foo)).should.eql(foo);
			baz.set(baz.set(foo, new Baz({ qux: 4 })), new Baz({ qux: 654 })).
				bar[0].baz.qux.should.eql(654);
		});

		it("should obey the lens laws for nested props", function() {
			qux.get(qux.set(foo, 4)).should.eql(4);
			qux.set(foo, qux.get(foo)).should.eql(foo);
			qux.set(qux.set(foo, 4), 654).bar[0].baz.qux.should.eql(654);
			qux.set(qux.set(foo, 4), 654).bar[0].baz.should.be.an.instanceOf(Baz);
		});
	});
});
