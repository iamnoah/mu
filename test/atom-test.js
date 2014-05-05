/*global describe, it*/
"use strict";
var Atom = require("../src/atom");
var _ = require("lodash");
require("should");

describe("Atom", function() {
	var mockVal;
	function mockCompute(val) {
		if (arguments.length) {
			mockVal = val;
		}
		return mockVal;
	}

	var state = new Atom(mockCompute);
	mockCompute({
		bar: 123
	});
	it("should reflect changes to the compute", function() {
		state().get().bar.should.eql(123);
		var bar = state("bar");
		bar.get().should.eql(123);

		// now change it and see
		mockCompute({
			bar: "hi"
		});
		bar.get().should.eql("hi");
	});

	it("should change the compute when a property is set", function() {
		state().set({
			bar: 123
		});
		state("baz").set("hi!");
		mockCompute().should.eql({
			bar: 123,
			baz: "hi!"
		});
	});

	// describe("#wrapClass", function() {
	// 	it("should convert to/from my class", function() {
	// 		function MyState(data) {
	// 			_.extend(this, data);
	// 		}
	// 		mockCompute(new MyState({
	// 			foo: "bar"
	// 		}));
	// 		var state = Atom.wrapClass(mockCompute);


	// 		state().get().should.eql({
	// 			foo: "bar"
	// 		});
	// 		mockCompute().should.be.instanceOf(MyState);

	// 		state().set({
	// 			foo: "baz"
	// 		});
	// 		state().get().should.eql({
	// 			foo: "baz"
	// 		});
	// 		state().get().should.not.be.instanceOf(MyState);
	// 		mockCompute().should.be.instanceOf(MyState);
	// 		mockCompute().foo.should.eql("baz");
	// 	});
	// });
});
