function testParser() {
	let text = document.getElementById("algol-text").value;
	let results = document.getElementById("parser-results");
	results.innerText = "parsing...";
	try {
		let parseTree = parseAlgol(text, {multiWordIdents:true});
		console.log("Parsing results:", parseTree);
		results.innerText = "Your program, sir: "+JSON.stringify(parseTree);
	}
	catch(error) {
		results.innerText = "Failed to parse!";
		let p1 = makeChild(results, "p");
		console.log("Parsing error:", error);
		p1.innerText = `At line ${error.location.line}, column ${error.location.column}: ${error.text}`;
		throw error;
	}
}