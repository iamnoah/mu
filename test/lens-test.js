/*global describe, it*/
var Lens = require("../src/lens");
var should = require("should");

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
			_2.set(array, 3).should.exactly(array);
			_2.set(array, _2.get(array)).should.eql(array);
			_2.set(_2.set(array, 1000), 3).should.eql(array);
		});
		it("should handle nulls", function() {
			var last = Lens.nth(-1);
			should(last.get(null)).eql(void 0);
			last.set(null, 2).should.eql([2]);
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
			bar.set(foo, 123).should.exactly(foo);
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
			last.set(array, 3).should.exactly(array);
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
			qux.set(foo, qux.get(foo)).should.exactly(foo);
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

	describe("#Delete", function() {
		var foo = {
			bar: [{
				baz: {
					qux: 123
				},
				other: {}
			}, {
				foo: 123,
			}]
		};

		var baz = Lens.path("bar", 0, "baz");
		var bar2 = Lens.path("bar", 1);
		var qux = Lens.path(baz, "qux");

		it("should delete keys in an object", function() {
			baz.get(qux.set(foo, Lens.Delete)).should.not.have.property("qux");
		});

		it("should splice elements from an array", function() {
			bar2.set(foo, Lens.Delete).bar.should.have.length(1);
		});
	});

});
