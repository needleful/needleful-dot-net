let test_results = {};

function testParser() {
	let text = document.getElementById("algol-text").value;
	let results = document.getElementById("parser-results");
	results.innerText = "parsing...";
	try {
		test_results = {};
		test_results.parseTree = parseAlgol(text, {multiWordIdents:true});
	}
	catch(error) {
		results.innerText = "Failed to parse!";
		let p1 = makeChild(results, "p");
		console.log("Parsing error:", error);
		p1.innerText = `At line ${error.location.line}, column ${error.location.column}: ${error.text}`;
		throw error;
	}
	try {
		test_results.ir = analyze(text, test_results.parseTree);
		test_results.readableIr = {};
		for(p in test_results.ir) {
			let proc = test_results.ir[p];
			if(proc.inline) {
				test_results.readableIr[p] = {inline: wasmInstrNames[proc.inline]};
			}
			else if(proc.code) {
				test_results.readableIr[p] = {code: ir_almost_pretty_print(proc.code, 0)};
			}
			else if('import' in proc) {
				test_results.readableIr[p] = {import: proc.import};
			}
		}
	}
	catch(error) {
		console.log("Analysis failed with error: ", error);
		throw error;
	}
	try {
		test_results.test_mod = ir_to_assembler(test_results.ir);
		[test_results.bytes, test_results.wasmCode] = assemble(test_results.test_mod);
		let wasm_platform = {
			io:{
				outinteger: (c,e) => console.log('integer', e, c),
				outreal: (c, r) => console.log('real', r, c),
				outboolean: (c, b) => console.log('boolean ', Boolean(b), c)
			}
		}
		WebAssembly.instantiate(test_results.bytes, wasm_platform).then((result) => {
			test_results.wasm = result;
			results.innerText = 'Success! Check the developer console';
		});
	}
	catch(error) {
		console.log('Assembly failed with error', error);
		throw error;
	}
}