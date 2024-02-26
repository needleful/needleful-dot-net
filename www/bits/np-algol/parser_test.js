function testParser() {
	let text = document.getElementById("algol-text").value;
	let results = document.getElementById("parser-results");
	results.innerText = "parsing...";
	try {
		let parseTree = parseAlgol(text, {multiWordIdents:true});
		console.log("Parsing results:", parseTree);
		results.innerText = "Your program, sir:";
		function show(list, item) {
			function add_item(text) {
				let li = makeChild(list, "li");
				li.innerText = text;
				return li;
			}

			if("block" in item) {
				let li = add_item("Begin:");
				for(let i2 of item.block) {
					let list2 = makeChild(li, "ul");
					show(list2, i2);
				}
			}
			if("declare" in item) {
				add_item((item.own? "own " : "" ) + item.declare + " "+item.vars.join(", ") + ";");
			}
		}
		show(makeChild(results, "ul"), parseTree);
	}
	catch(error) {
		results.innerText = "Failed to parse!";
		let p1 = makeChild(results, "p");
		console.log("Parsing error:", error);
		p1.innerText = `At line ${error.location.line}, column ${error.location.column}: ${error.text}`;
	}
}