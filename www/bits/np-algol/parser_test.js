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
			let readableIr = {};
			for(p in ir) {
				let proc = ir[p];
				if(!proc.exported) {
					continue;
				}
				if(proc.inline) {
					readableIr[p] = {inline: InstrNames[proc.inline]};
				}
				else if(proc.code) {
					readableIr[p] = {code: ir_almost_pretty_print(proc.code, 0)};
				}
			}
			console.log('Readable IR:', readableIr);
			let test_mod = ir_to_assembler(ir);
			let [bytes, printable] = assemble(test_mod);
			console.log('WASM code: ', printable);
			console.log('Raw bytes: ', bytes);
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