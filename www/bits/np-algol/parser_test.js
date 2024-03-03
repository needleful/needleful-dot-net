let npa_results = {};

function compileAndRun() {
	let text = document.getElementById("algol-text").value;
	let results = document.getElementById("parser-results");
	results.innerText = "parsing...";
	try {
		npa_results = {};
		npa_results.parseTree = parseAlgol(text, {multiWordIdents:true});
	}
	catch(error) {
		results.innerText = "Failed to parse!";
		let p1 = makeChild(results, "p");
		console.log("Parsing error:", error);
		p1.innerText = `At line ${error.location.line}, column ${error.location.column}: ${error.text}`;
		throw error;
	}
	try {
		npa_results.ir = analyze(text, npa_results.parseTree);
		npa_results.readableIr = {};
		for(p in npa_results.ir) {
			let proc = npa_results.ir[p];
			if(proc.inline) {
				npa_results.readableIr[p] = {inline: wasmInstrNames[proc.inline]};
			}
			else if(proc.code) {
				npa_results.readableIr[p] = {code: ir_almost_pretty_print(proc.code, 0)};
			}
			else if('import' in proc) {
				npa_results.readableIr[p] = {import: proc.import};
			}
		}
	}
	catch(error) {
		console.log("Analysis failed with error: ", error);
		throw error;
	}
	try {
		npa_results.test_mod = ir_to_assembler(npa_results.ir);
		[npa_results.bytes, npa_results.wasmCode] = assemble(npa_results.test_mod);
		let wasm_platform = {
			io:{
				outinteger: (c,e) => console.log('integer', e, c),
				outreal: (c, r) => console.log('real', r, c),
				outboolean: (c, b) => console.log('boolean ', Boolean(b), c)
			}
		}
		WebAssembly.instantiate(npa_results.bytes, wasm_platform).then((result) => {
			npa_results.wasm = result;
			results.innerText = 'Success! Check the developer console';
		});
	}
	catch(error) {
		console.log('Assembly failed with error', error);
		throw error;
	}
}