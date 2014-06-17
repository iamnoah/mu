/**
 * @jsx React.DOM
 */
(function() {
	/*global document */
	"use strict";
	var React = require("react");

	var mu = require("../src/mu");
	var muReact = require("../src/react");

	var compute = muReact.stateCompute("atom");
	compute({
		name: "World"
	});
	var atom = mu.Atom(compute);

	var Demo = React.createClass({
		componentWillMount: function() {
			this.props.state.attach(this);
		},
		render: function() {
			return <div>
				Hi {this.state.atom.name}
				<br/>
				<input onChange={this._setName} />
			</div>;
		},
		_setName: function(ev) {
			atom.focus("name").set(ev.target.value);
		}
	});

	React.renderComponent(<Demo state={compute}/>, document.getElementById("content"));
	
})();