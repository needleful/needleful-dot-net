let test_wasm = {};

function testParser() {
	let text = document.getElementById("algol-text").value;
	let results = document.getElementById("parser-results");
	results.innerText = "parsing...";
	try {
		let parseTree = parseAlgol(text, {multiWordIdents:true});
		console.log("Parsing results:", parseTree);
		results.innerText = "Your program, sir: "+JSON.stringify(parseTree);
		try {
			let ir = analyze(text, parseTree);
			console.log('Analysis: ', ir);

			let test_mod = ir_to_assembler(ir);
			console.log('Assembly:', test_mod);
			let bytes = assemble(test_mod);
			console.log('Bytes: ', bytes);
			WebAssembly.instantiate(bytes).then((result) => {
				test_wasm = result;
				console.log("WASM module:", test_wasm);
			});
		}
		catch(error) {
			console.log("Analysis failed with error: ", error);
		}
	}
	catch(error) {
		results.innerText = "Failed to parse!";
		let p1 = makeChild(results, "p");
		console.log("Parsing error:", error);
		p1.innerText = `At line ${error.location.line}, column ${error.location.column}: ${error.text}`;
		throw error;
	}
}