let wasm_module = {}

function compile() {
	document.getElementById("result").innerText = "Compiling...";

	let text = document.getElementById("byte_text").value;
	const header = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

	text = text.replace(/\(.*\)/g, "").toLowerCase().replace(/^[0-9a-f]+/g, "").replace(/\s+/g, "");

	if (text.length % 2 != 0) {
		console.log("WARNING: odd number of hex digits! Ignoring the last digit, but this is likely not correct.");
	}

	const body = new Uint8Array(text.length/2);
	for(let i = 0; i < body.length; i++) {
		let high = i*2;
		let low = i*2 + 1;
		body[i] = parseInt(text[high] + text[low], 16);
	}

	let bytes = new Uint8Array(header.length + body.length);
	bytes.set(header);
	bytes.set(body, header.length);

	console.log(bytes)
	WebAssembly.instantiate(bytes).then(
		(result) =>
		{
			var results = document.getElementById("result");
			results.innerText = "Compiled!";
			var p1 = makeChild(results, 'p');
			p1.innerText = "Exports:"
			var ul = makeChild(results, 'ul', {class:'compile-results'});
			Object.keys(result.instance.exports).map((key) =>{
				var a = result.instance.exports[key].length;
				makeChild(ul, 'li').innerText = `${key}(${a} ${a == 1 ? " arg" : " args"})`;
			});
			wasm_module = result
		});
}