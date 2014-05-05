/*global describe, it*/
"use strict";
var compute = require("../src/compute");
require("should");

describe("compute", function() {
	var c = compute(123);
	describe("as a value holder", function() {
		it("should return the computed value", function() {
			c().should.eql(123);
		});
		it("should take updates", function() {
			c.set(456);
			c.get().should.eql(456);
		});
		it("should notify listeners when the value changes", function() {
			var changes = 0;
			function countChange() {
				changes++;
			}
			c.onChange(countChange);
			c.set("hi");
			c.get().should.eql("hi");
			c.set("whoa");
			c.set("whoa");
			changes.should.eql(2);
			c.offChange(countChange);
		});
	});

	describe("as compute based on other values", function() {
		var a = compute(4);
		var b = compute(2);

		var ab = compute(function() {
			return a() * (b() % 3);
		});

		it("should reflect the latest values", function() {
			ab().should.eql(8);
			a.set(1);
			ab().should.eql(2);
		});
		it("should notify on change", function() {
			var changes = 0;
			function countChange() {
				changes++;
			}
			a.set(3);
			ab.onChange(countChange);
			ab.get().should.eql(6);
			a.set(4);
			ab.get().should.eql(8);
			changes.should.eql(1);
			ab.offChange(countChange);
		});

		it("should notify with nested computes", function() {
			var nested = compute(function() {
				return ab() / b();
			});
			a.set(4);
			var changes = 0;
			function countChange() {
				changes++;
			}
			nested.onChange(countChange, "countChange");
			a.set(5);
			nested.get().should.eql(5);
			changes.should.eql(1);

			// changing b wont change the result
			b.set(1);
			nested.get().should.eql(5);
			changes.should.eql(1);

			nested.offChange("countChange");
		});

		it("should stop notifications", function() {
			var changes = 0;
			function countChange() {
				changes++;
			}
			ab.onChange(countChange);
			a.set(3);
			ab.offChange(countChange);
			a.set(4);
			changes.should.eql(1);
		});
		it("should rebind on change", function() {
			var rebind = compute(function() {
				return b() > 5 ? ab() : a();
			});
			var changes = 0;
			function countChange() {
				changes++;
			}
			rebind.onChange(countChange, "countChange");
			a.set(10);
			changes.should.eql(1);
			rebind().should.eql(a());

			b.set(6);
			changes.should.eql(2);
			rebind().should.eql(ab());
			rebind.offChange("countChange");
		});
	});

	describe("batching", function() {
		var c2 = compute(function() {
			return c() * 2;
		});
		it("does not cache values", function() {
			c2.onChange(function() {}, "noop");
			compute.startBatch();
			c.set(123);
			c.set(456);
			c.get().should.eql(456);
			c2.get().should.eql(456 * 2);
			compute.endBatch();
			c.get().should.eql(456);
			c2.get().should.eql(456 * 2);
			c2.offChange("noop");
		});
		it("suspends events", function() {
			var changes = 0;
			function count() {
				changes++;
			}
			
			c.set(1);

			compute.startBatch();

			c2.onChange(count);
			changes.should.eql(0);
			c.set(123);
			c2.get().should.eql(123 * 2);
			changes.should.eql(0);
			c.set(456);
			c2.get().should.eql(456 * 2);
			changes.should.eql(0);

			compute.endBatch();
			c2.get().should.eql(456 * 2);
			changes.should.eql(1);

			c2.offChange(count);
		});
		it("supresses flapping", function() {
			var changes = 0;
			function count() {
				changes++;
			}
			
			c.set(123);
			c.onChange(count);

			compute.startBatch();
			
			c.set(456);
			c.set(789);
			c.set(123);

			compute.endBatch();

			changes.should.eql(0);

			c.offChange(count);
		});
	});
});